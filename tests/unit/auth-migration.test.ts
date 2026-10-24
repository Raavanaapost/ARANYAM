import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, setDatabaseContext, type DatabaseContext } from "@/lib/db";
import { getAuth } from "@/lib/auth/auth";
import { hashPassword } from "@/lib/auth/password";
import { findUserByEmail } from "@/lib/services/accounts";

/**
 * Accounts made before the switch to Better Auth (like the first sign-ups on
 * the live site) must keep working after migration 0001 runs.
 */
let context: DatabaseContext;

async function runMigrationFile(file: string) {
  for (const statement of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) {
    if (statement.trim()) await context.db.execute(sql.raw(statement));
  }
}

beforeAll(async () => {
  context = createDatabase({ url: "", pgliteDir: "memory" });
  setDatabaseContext(context);
  await runMigrationFile("0000_init.sql");
  const hash = await hashPassword("we joined early");
  await context.db.execute(sql`
    insert into users (id, email, email_verified_at, password_hash, display_name, status, role)
    values ('early1', 'early@example.com', now(), ${hash}, 'Early', 'approved', 'admin'),
           ('early2', 'waiting@example.com', null, ${hash}, 'Waiting', 'pending', 'member')`);
  await context.db.execute(sql`
    insert into sessions (id, user_id, expires_at) values ('old-session', 'early1', now() + interval '1 day')`);
  await runMigrationFile("0001_better_auth.sql");
});

afterAll(async () => {
  setDatabaseContext(undefined);
  await context.close();
});

describe("moving existing accounts to Better Auth", () => {
  it("keeps passwords, confirmations, roles and approval", async () => {
    const result = await getAuth().api.signInEmail({ body: { email: "early@example.com", password: "we joined early" } });
    expect(result.user.id).toBe("early1");
    expect(await findUserByEmail("early@example.com")).toMatchObject({
      emailVerified: true,
      role: "admin",
      status: "approved",
    });
    expect((await findUserByEmail("waiting@example.com"))?.emailVerified).toBe(false);
  });

  it("refuses wrong passwords for migrated accounts", async () => {
    await expect(
      getAuth().api.signInEmail({ body: { email: "waiting@example.com", password: "not the password" } }),
    ).rejects.toThrow();
  });

  it("signs everyone out once", async () => {
    const rows = await context.db.execute(sql`select id from sessions where id = 'old-session'`);
    expect(JSON.stringify(rows)).not.toContain("old-session");
  });
});
