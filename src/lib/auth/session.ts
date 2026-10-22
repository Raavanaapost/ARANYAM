import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { generateSecretToken, hashSecret } from "@/lib/ids";
import { SESSION_DURATION_MS } from "./constants";

export { SESSION_COOKIE, SESSION_DURATION_MS } from "./constants";

const DAY = 24 * 60 * 60 * 1000;
/** Sessions are extended when they have less than this much time left. */
const RENEWAL_THRESHOLD_MS = 15 * DAY;

export type SessionRecord = typeof sessions.$inferSelect;

export type ValidatedSession = {
  session: SessionRecord;
  user: User;
  /** True when the expiry should be pushed forward (done after the response). */
  shouldRenew: boolean;
};

export async function createSession(userId: string, userAgent = "") {
  const token = generateSecretToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({
    id: hashSecret(token),
    userId,
    expiresAt,
    userAgent: userAgent.slice(0, 300),
  });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  if (!token || token.length > 100) return null;
  const id = hashSecret(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row) return null;
  const now = Date.now();
  if (row.session.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return {
    session: row.session,
    user: row.user,
    shouldRenew: row.session.expiresAt.getTime() - now < RENEWAL_THRESHOLD_MS,
  };
}

export async function renewSession(sessionId: string) {
  await db
    .update(sessions)
    .set({ expiresAt: new Date(Date.now() + SESSION_DURATION_MS), lastUsedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function invalidateSessionToken(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashSecret(token)));
}

export async function invalidateAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Signs a member out everywhere except the device they are using. */
export async function invalidateOtherSessions(userId: string, currentSessionId: string) {
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)));
}

export async function listActiveSessions(userId: string) {
  return db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(sessions.createdAt);
}

export async function deleteExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
