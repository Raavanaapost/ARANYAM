import path from "node:path";
import type { MigrationConfig } from "drizzle-orm/migrator";
import type { DatabaseContext } from "./index";

export const migrationsFolder = path.resolve(process.cwd(), "drizzle");

export async function runMigrations(context: DatabaseContext) {
  // Netlify Database applies netlify/database/migrations itself, before each
  // deploy goes live. Running Drizzle's migrator as well would apply them twice.
  if (context.kind === "netlify") return;
  const config: MigrationConfig = { migrationsFolder };
  if (context.kind === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(context.db as never, config);
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(context.db as never, config);
  }
}
