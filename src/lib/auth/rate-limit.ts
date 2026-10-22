import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { hashSecret } from "@/lib/ids";

export type RateLimitRule = {
  /** Name of the action being limited, e.g. "login". */
  name: string;
  limit: number;
  windowMs: number;
};

export const RATE_LIMITS = {
  loginPerEmail: { name: "login-email", limit: 10, windowMs: 15 * 60 * 1000 },
  loginPerIp: { name: "login-ip", limit: 50, windowMs: 15 * 60 * 1000 },
  registerPerIp: { name: "register-ip", limit: 10, windowMs: 60 * 60 * 1000 },
  resetPerEmail: { name: "reset-email", limit: 3, windowMs: 60 * 60 * 1000 },
  resetPerIp: { name: "reset-ip", limit: 20, windowMs: 60 * 60 * 1000 },
  verifyResendPerEmail: { name: "verify-email", limit: 5, windowMs: 60 * 60 * 1000 },
  inviteLookupPerIp: { name: "invite-ip", limit: 30, windowMs: 60 * 60 * 1000 },
  postPerUser: { name: "post-user", limit: 30, windowMs: 60 * 60 * 1000 },
  commentPerUser: { name: "comment-user", limit: 120, windowMs: 60 * 60 * 1000 },
  reportPerUser: { name: "report-user", limit: 20, windowMs: 60 * 60 * 1000 },
  invitePerUser: { name: "invite-user", limit: 20, windowMs: 24 * 60 * 60 * 1000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Fixed-window counter stored in the database, so limits hold across server
 * instances. Identifiers (emails, IP addresses) are hashed before storage.
 */
export async function hitRateLimit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const key = `${rule.name}:${hashSecret(identifier.toLowerCase())}`;
  const now = new Date();
  const cutoff = sql`${new Date(now.getTime() - rule.windowMs).toISOString()}::timestamptz`;
  const nowSql = sql`${now.toISOString()}::timestamptz`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < ${cutoff} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < ${cutoff} then ${nowSql} else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  // Occasionally clear out old counters.
  if (Math.random() < 0.02) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  }

  const allowed = row.count <= rule.limit;
  const retryAfterMs = row.windowStart.getTime() + rule.windowMs - now.getTime();
  return { allowed, retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

/** Clears a counter, e.g. after a successful login. */
export async function resetRateLimit(rule: RateLimitRule, identifier: string) {
  const key = `${rule.name}:${hashSecret(identifier.toLowerCase())}`;
  await db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
}
