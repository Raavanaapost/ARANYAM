import "./_env";
import { getDatabaseContext } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";

const context = getDatabaseContext();
await runMigrations(context);
console.info(`Database is up to date (${context.kind}).`);
await context.close();
