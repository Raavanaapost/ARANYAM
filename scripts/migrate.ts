import "./_env";
import { getDatabaseContext } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";

const context = getDatabaseContext();
await runMigrations(context);
console.info(
  context.kind === "netlify"
    ? "Netlify Database applies migrations itself when a deploy goes live, so there is nothing to do here."
    : `Database is up to date (${context.kind}).`,
);
await context.close();
