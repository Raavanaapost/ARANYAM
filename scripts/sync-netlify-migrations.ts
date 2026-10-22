import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Netlify Database applies the SQL files in netlify/database/migrations on
 * every deploy. Drizzle writes migrations to drizzle/, so this copies each one
 * across. `npm run db:generate` runs it, and a unit test checks the copies.
 */
const source = path.resolve("drizzle");
const target = path.resolve("netlify/database/migrations");
const journal = JSON.parse(readFileSync(path.join(source, "meta/_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};

mkdirSync(target, { recursive: true });
for (const { tag } of journal.entries) {
  copyFileSync(path.join(source, `${tag}.sql`), path.join(target, `${tag}.sql`));
}
console.info(`Copied ${journal.entries.length} migration(s) to netlify/database/migrations.`);
