import { defineConfig } from "drizzle-kit";

// Migrations are generated from src/lib/db/schema.ts with `npm run db:generate`
// and applied with `npm run db:migrate` (PostgreSQL or the embedded PGlite).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
