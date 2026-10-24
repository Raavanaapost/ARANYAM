import { aliasedTable, and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, posts, users, type UserRole, type UserStatus } from "@/lib/db/schema";
import { countOpenReports } from "./reports";

export async function getModerationStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [[members], [waiting], openReports, [postsWeek]] = await Promise.all([
    db.select({ value: count() }).from(users).where(eq(users.status, "approved")),
    db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.status, "pending"), eq(users.emailVerified, true))),
    countOpenReports(),
    db
      .select({ value: count() })
      .from(posts)
      .where(and(isNull(posts.removedAt), sql`${posts.createdAt} >= ${weekAgo.toISOString()}::timestamptz`)),
  ]);
  return {
    members: members?.value ?? 0,
    waiting: waiting?.value ?? 0,
    reports: openReports,
    postsWeek: postsWeek?.value ?? 0,
  };
}

export type MemberTab = "waiting" | "unverified" | "all" | "suspended";

export function isMemberTab(value: unknown): value is MemberTab {
  return value === "waiting" || value === "unverified" || value === "all" || value === "suspended";
}

const inviter = aliasedTable(users, "inviter");

export type ModerationMember = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  joinNote: string;
  location: string;
  avatarHue: number;
  createdAt: Date;
  approvedAt: Date | null;
  invitedByName: string | null;
};

/** Accounts for the moderation screens, including what moderators need to decide. */
export async function listMembersForModeration(tab: MemberTab, query = ""): Promise<ModerationMember[]> {
  const conditions: (SQL | undefined)[] = [];
  switch (tab) {
    case "waiting":
      conditions.push(eq(users.status, "pending"), eq(users.emailVerified, true));
      break;
    case "unverified":
      conditions.push(eq(users.emailVerified, false));
      break;
    case "suspended":
      conditions.push(eq(users.status, "suspended"));
      break;
    case "all":
      conditions.push(eq(users.status, "approved"));
      break;
  }
  const search = query.trim().slice(0, 100);
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(users.displayName, pattern), ilike(users.email, pattern)));
  }
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      status: users.status,
      emailVerified: users.emailVerified,
      joinNote: users.joinNote,
      location: users.location,
      avatarHue: users.avatarHue,
      createdAt: users.createdAt,
      approvedAt: users.approvedAt,
      invitedByName: inviter.displayName,
    })
    .from(users)
    .leftJoin(inviter, eq(inviter.id, users.invitedById))
    .where(and(...conditions))
    .orderBy(tab === "all" ? asc(users.displayName) : asc(users.createdAt))
    .limit(200);
}

const actor = aliasedTable(users, "actor");
const targetUser = aliasedTable(users, "target_user");

export async function listAuditLog(limit = 100) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      createdAt: auditLogs.createdAt,
      actorName: actor.displayName,
      targetName: targetUser.displayName,
    })
    .from(auditLogs)
    .leftJoin(actor, eq(actor.id, auditLogs.actorId))
    .leftJoin(targetUser, and(eq(auditLogs.targetType, "user"), eq(targetUser.id, auditLogs.targetId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
