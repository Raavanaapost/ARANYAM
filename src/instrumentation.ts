/**
 * Runs once when the server starts. Brings the database schema up to date, so
 * `npm run dev` works on a fresh checkout without any setup.
 * Set AUTO_MIGRATE=false to run migrations yourself (`npm run db:migrate`).
 * On Netlify Database nothing runs here: Netlify applies the migrations.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.AUTO_MIGRATE?.toLowerCase() === "false") return;
  const { getDatabaseContext } = await import("@/lib/db");
  const { runMigrations } = await import("@/lib/db/migrate");
  await runMigrations(getDatabaseContext());
}
