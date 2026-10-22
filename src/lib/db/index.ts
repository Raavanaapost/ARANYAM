import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, Schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Either the root database or an open transaction. */
export type Executor = Database | Transaction;

export type DatabaseContext = {
  kind: "postgres" | "pglite";
  db: Database;
  close: () => Promise<void>;
};

export type DatabaseOptions = {
  /** PostgreSQL connection string. When empty, the embedded PGlite database is used. */
  url?: string;
  /** Directory for PGlite data, or "memory" for a throwaway in-memory database. */
  pgliteDir?: string;
};

/**
 * Creates a database connection. With DATABASE_URL set it talks to PostgreSQL;
 * otherwise it runs PGlite, a full PostgreSQL build that runs inside Node, so
 * the app works locally without installing a database server.
 */
export function createDatabase(options: DatabaseOptions = {}): DatabaseContext {
  const url = options.url ?? process.env.DATABASE_URL ?? "";
  if (url) {
    const client = postgres(url, {
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      onnotice: () => {},
    });
    return {
      kind: "postgres",
      db: drizzlePostgres({ client, schema }) as unknown as Database,
      close: () => client.end({ timeout: 5 }),
    };
  }

  const dir = options.pgliteDir ?? process.env.PGLITE_DIR ?? ".data/pglite";
  let client: PGlite;
  if (dir === "memory") {
    client = new PGlite();
  } else {
    // The data folder is chosen at runtime; it is not part of the app's files.
    const dataDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), dir);
    mkdirSync(dataDir, { recursive: true });
    client = new PGlite(dataDir);
  }
  return {
    kind: "pglite",
    db: drizzlePglite({ client, schema }) as unknown as Database,
    close: () => client.close(),
  };
}

const globalForDb = globalThis as unknown as {
  __aranyamDb?: DatabaseContext;
};

/** The shared connection, created on first use and reused across hot reloads. */
export function getDatabaseContext(): DatabaseContext {
  globalForDb.__aranyamDb ??= createDatabase();
  return globalForDb.__aranyamDb;
}

/** Lets tests and scripts point the app at a specific database. */
export function setDatabaseContext(context: DatabaseContext | undefined) {
  globalForDb.__aranyamDb = context;
}

/**
 * The application database. The connection opens lazily on first query, so
 * importing this module during a build never touches the database.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const real = getDatabaseContext().db;
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
