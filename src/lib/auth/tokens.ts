import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { authTokens } from "@/lib/db/schema";
import { generateSecretToken, hashSecret } from "@/lib/ids";

export type TokenPurpose = (typeof authTokens.$inferSelect)["purpose"];

const LIFETIME_MS: Record<TokenPurpose, number> = {
  verify_email: 48 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

/**
 * Creates a single-purpose secret for an email link. Older tokens for the same
 * purpose are revoked so only the most recent email works.
 */
export async function createEmailToken(userId: string, purpose: TokenPurpose) {
  const token = generateSecretToken();
  await db
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)));
  await db.insert(authTokens).values({
    id: hashSecret(token),
    userId,
    purpose,
    expiresAt: new Date(Date.now() + LIFETIME_MS[purpose]),
  });
  return token;
}

/** Looks a token up without using it (for showing the reset password form). */
export async function peekEmailToken(token: string, purpose: TokenPurpose) {
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.id, hashSecret(token)),
        eq(authTokens.purpose, purpose),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Uses a token exactly once. Returns the user id it belonged to. */
export async function consumeEmailToken(token: string, purpose: TokenPurpose) {
  if (!token || token.length > 100) return null;
  const [row] = await db
    .delete(authTokens)
    .where(and(eq(authTokens.id, hashSecret(token)), eq(authTokens.purpose, purpose)))
    .returning();
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return row.userId;
}
