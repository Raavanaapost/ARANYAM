import "./_env";
import { eq } from "drizzle-orm";
import { getDatabaseContext } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";
import { users } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/services/accounts";

/**
 * Makes an existing account an approved admin with a confirmed email, e.g.
 * for the very first moderator of a new installation:
 *
 *   npm run admin:promote -- you@example.com
 */
const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run admin:promote -- you@example.com");
  process.exit(1);
}

const context = getDatabaseContext();
await runMigrations(context);
const now = new Date();
const [user] = await context.db
  .update(users)
  .set({ role: "admin", status: "approved", emailVerifiedAt: now, approvedAt: now, updatedAt: now })
  .where(eq(users.email, normalizeEmail(email)))
  .returning({ id: users.id, displayName: users.displayName });

if (user) {
  console.info(`${user.displayName} <${normalizeEmail(email)}> is now an admin.`);
} else {
  console.error(`No account found for ${email}. Sign up on the site first, then run this again.`);
  process.exitCode = 1;
}
await context.close();
