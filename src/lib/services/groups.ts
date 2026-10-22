import { and, asc, count, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { GROUP_COLORS, GROUP_ICONS, type GroupColor } from "@/lib/constants";
import { db } from "@/lib/db";
import { groupMembers, groups, users, type GroupPrivacy, type GroupRole } from "@/lib/db/schema";
import { newId, newInviteCode } from "@/lib/ids";
import { isActiveMember, isAdmin, type Viewer } from "@/lib/auth/viewer";
import { audit } from "./audit";
import { notify } from "./notifications";

export { GROUP_COLORS, GROUP_ICONS, type GroupColor } from "@/lib/constants";

export type GroupSummary = {
  id: string;
  name: string;
  description: string;
  privacy: GroupPrivacy;
  icon: string;
  color: GroupColor;
  memberCount: number;
  myRole: GroupRole | null;
  myStatus: "active" | "pending" | null;
};

export type GroupDetail = GroupSummary & {
  createdAt: Date;
  isGroupAdmin: boolean;
  isOwner: boolean;
  /** Only for group admins, who can share it. */
  inviteCode: string | null;
  pendingCount: number;
};

const memberCount = sql<number>`(select count(*) from ${groupMembers} where ${groupMembers.groupId} = ${groups.id} and ${groupMembers.status} = 'active')`;

function summaryFields(viewer: Viewer) {
  return {
    id: groups.id,
    name: groups.name,
    description: groups.description,
    privacy: groups.privacy,
    icon: groups.icon,
    color: groups.color,
    memberCount,
    myRole: sql<GroupRole | null>`(select ${groupMembers.role} from ${groupMembers} where ${groupMembers.groupId} = ${groups.id} and ${groupMembers.userId} = ${viewer.id})`,
    myStatus: sql<"active" | "pending" | null>`(select ${groupMembers.status} from ${groupMembers} where ${groupMembers.groupId} = ${groups.id} and ${groupMembers.userId} = ${viewer.id})`,
  };
}

type SummaryRow = {
  id: string;
  name: string;
  description: string;
  privacy: GroupPrivacy;
  icon: string;
  color: string;
  memberCount: number;
  myRole: GroupRole | null;
  myStatus: "active" | "pending" | null;
};

function toSummary(row: SummaryRow): GroupSummary {
  return {
    ...row,
    color: (GROUP_COLORS as readonly string[]).includes(row.color) ? (row.color as GroupColor) : "green",
    memberCount: Number(row.memberCount),
    // A pending request does not carry a role yet.
    myRole: row.myStatus === "active" ? row.myRole : null,
  };
}

/** Groups the viewer belongs to or has asked to join. */
export async function listMyGroups(viewer: Viewer): Promise<GroupSummary[]> {
  if (!isActiveMember(viewer)) return [];
  const rows = await db
    .select(summaryFields(viewer))
    .from(groups)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, viewer.id)))
    .orderBy(asc(groupMembers.status), asc(groups.name));
  return rows.map(toSummary);
}

/** Open and private groups the viewer is not part of. Hidden groups are never listed. */
export async function listDiscoverGroups(viewer: Viewer): Promise<GroupSummary[]> {
  if (!isActiveMember(viewer)) return [];
  const mine = db.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, viewer.id));
  const rows = await db
    .select(summaryFields(viewer))
    .from(groups)
    .where(and(ne(groups.privacy, "hidden"), notInArray(groups.id, mine)))
    .orderBy(desc(memberCount), asc(groups.name))
    .limit(60);
  return rows.map(toSummary);
}

export async function getGroup(viewer: Viewer, id: string): Promise<GroupDetail | null> {
  if (!isActiveMember(viewer)) return null;
  const [row] = await db
    .select({ ...summaryFields(viewer), inviteCode: groups.inviteCode, createdAt: groups.createdAt })
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1);
  if (!row) return null;
  const summary = toSummary(row);
  // Hidden groups do not exist for people outside them.
  if (summary.privacy === "hidden" && summary.myStatus !== "active") return null;
  const isGroupAdmin = summary.myRole === "owner" || summary.myRole === "admin";
  let pendingCount = 0;
  if (isGroupAdmin) {
    const [pending] = await db
      .select({ value: count() })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.status, "pending")));
    pendingCount = pending?.value ?? 0;
  }
  return {
    ...summary,
    createdAt: row.createdAt,
    isGroupAdmin,
    isOwner: summary.myRole === "owner",
    inviteCode: isGroupAdmin ? row.inviteCode : null,
    pendingCount,
  };
}

export type GroupInput = {
  name: string;
  description: string;
  privacy: GroupPrivacy;
  icon: string;
  color: GroupColor;
};

function cleanInput(input: GroupInput): GroupInput {
  return {
    ...input,
    icon: (GROUP_ICONS as readonly string[]).includes(input.icon) ? input.icon : "🌳",
    color: (GROUP_COLORS as readonly string[]).includes(input.color) ? input.color : "green",
  };
}

export async function createGroup(viewer: Viewer, input: GroupInput): Promise<string | null> {
  if (!isActiveMember(viewer)) return null;
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(groups).values({ id, ...cleanInput(input), inviteCode: newInviteCode(), createdById: viewer.id });
    await tx.insert(groupMembers).values({ groupId: id, userId: viewer.id, role: "owner", status: "active" });
  });
  return id;
}

async function myMembership(viewer: Viewer, groupId: string) {
  const [row] = await db
    .select({ role: groupMembers.role, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, viewer.id)))
    .limit(1);
  return row ?? null;
}

async function isGroupAdmin(viewer: Viewer, groupId: string) {
  const membership = await myMembership(viewer, groupId);
  return membership?.status === "active" && (membership.role === "owner" || membership.role === "admin");
}

export async function updateGroup(viewer: Viewer, id: string, input: GroupInput) {
  if (!(await isGroupAdmin(viewer, id))) return false;
  await db
    .update(groups)
    .set({ ...cleanInput(input), updatedAt: new Date() })
    .where(eq(groups.id, id));
  return true;
}

/** Owners can delete their group; site admins can delete any group. */
export async function deleteGroup(viewer: Viewer, id: string) {
  const membership = await myMembership(viewer, id);
  const isOwner = membership?.status === "active" && membership.role === "owner";
  if (!isOwner && !isAdmin(viewer)) return false;
  const [deleted] = await db.delete(groups).where(eq(groups.id, id)).returning({ id: groups.id });
  if (deleted && !isOwner) await audit(viewer.id, "group.delete", { type: "group", id });
  return Boolean(deleted);
}

async function groupAdminIds(groupId: string) {
  const rows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.status, "active"),
        inArray(groupMembers.role, ["owner", "admin"]),
      ),
    );
  return rows.map((row) => row.userId);
}

export type JoinResult = "joined" | "requested" | "unavailable";

/** Open groups can be joined directly; private groups need a group admin to approve. */
export async function joinGroup(viewer: Viewer, id: string, note = ""): Promise<JoinResult> {
  if (!isActiveMember(viewer)) return "unavailable";
  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group || group.privacy === "hidden") return "unavailable";
  const status = group.privacy === "open" ? "active" : "pending";
  const inserted = await db
    .insert(groupMembers)
    .values({ groupId: id, userId: viewer.id, role: "member", status, note: note.slice(0, 500) })
    .onConflictDoNothing()
    .returning({ status: groupMembers.status });
  if (inserted.length && status === "pending") {
    for (const adminId of await groupAdminIds(id)) {
      await notify({
        userId: adminId,
        type: "group_join_request",
        actorId: viewer.id,
        link: `/groups/${id}/manage`,
        data: { group: group.name.slice(0, 80) },
      });
    }
  }
  return status === "active" ? "joined" : "requested";
}

/** Joining with a group's private invite link works for every kind of group. */
export async function joinGroupByCode(viewer: Viewer, code: string): Promise<string | null> {
  if (!isActiveMember(viewer) || !code || code.length > 40) return null;
  const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.inviteCode, code)).limit(1);
  if (!group) return null;
  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId: viewer.id, role: "member", status: "active" })
    .onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.userId],
      set: { status: "active" },
    });
  return group.id;
}

export async function findGroupByCode(code: string) {
  if (!code || code.length > 40) return null;
  const [group] = await db
    .select({ id: groups.id, name: groups.name, icon: groups.icon, color: groups.color, description: groups.description })
    .from(groups)
    .where(eq(groups.inviteCode, code))
    .limit(1);
  return group ?? null;
}

/** Leaves a group, or withdraws a request to join. Owners cannot leave. */
export async function leaveGroup(viewer: Viewer, id: string) {
  const [left] = await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, viewer.id), ne(groupMembers.role, "owner")))
    .returning({ userId: groupMembers.userId });
  return Boolean(left);
}

export type GroupMemberView = {
  id: string;
  displayName: string;
  avatarHue: number;
  role: GroupRole;
  joinedAt: Date;
};

/** Members of a group, visible to the group's own members. */
export async function listGroupMembers(viewer: Viewer, groupId: string): Promise<GroupMemberView[]> {
  const membership = await myMembership(viewer, groupId);
  if (membership?.status !== "active") return [];
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarHue: users.avatarHue,
      role: groupMembers.role,
      joinedAt: groupMembers.createdAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")))
    .orderBy(sql`case ${groupMembers.role} when 'owner' then 0 when 'admin' then 1 else 2 end`, asc(users.displayName));
}

export async function listJoinRequests(viewer: Viewer, groupId: string) {
  if (!(await isGroupAdmin(viewer, groupId))) return [];
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarHue: users.avatarHue,
      note: groupMembers.note,
      requestedAt: groupMembers.createdAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "pending")))
    .orderBy(asc(groupMembers.createdAt));
}

export async function answerJoinRequest(viewer: Viewer, groupId: string, userId: string, approve: boolean) {
  if (!(await isGroupAdmin(viewer, groupId))) return false;
  const pendingRequest = and(
    eq(groupMembers.groupId, groupId),
    eq(groupMembers.userId, userId),
    eq(groupMembers.status, "pending"),
  );
  if (!approve) {
    const [declined] = await db.delete(groupMembers).where(pendingRequest).returning({ userId: groupMembers.userId });
    return Boolean(declined);
  }
  const [approved] = await db
    .update(groupMembers)
    .set({ status: "active", createdAt: new Date() })
    .where(pendingRequest)
    .returning({ userId: groupMembers.userId });
  if (approved) {
    const [group] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId));
    await notify({
      userId,
      type: "group_join_approved",
      actorId: viewer.id,
      link: `/groups/${groupId}`,
      data: { group: (group?.name ?? "").slice(0, 80) },
    });
  }
  return Boolean(approved);
}

/** Owners choose the group's admins. */
export async function setGroupRole(viewer: Viewer, groupId: string, userId: string, role: "admin" | "member") {
  const membership = await myMembership(viewer, groupId);
  if (membership?.role !== "owner" || userId === viewer.id) return false;
  const [updated] = await db
    .update(groupMembers)
    .set({ role })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, "active"),
        ne(groupMembers.role, "owner"),
      ),
    )
    .returning({ userId: groupMembers.userId });
  return Boolean(updated);
}

/** Group admins can remove members (but not the owner, and admins only by the owner). */
export async function removeGroupMember(viewer: Viewer, groupId: string, userId: string) {
  const membership = await myMembership(viewer, groupId);
  if (membership?.status !== "active" || userId === viewer.id) return false;
  const removable: GroupRole[] = membership.role === "owner" ? ["admin", "member"] : membership.role === "admin" ? ["member"] : [];
  if (removable.length === 0) return false;
  const [removed] = await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), inArray(groupMembers.role, removable)),
    )
    .returning({ userId: groupMembers.userId });
  return Boolean(removed);
}

export async function regenerateGroupInvite(viewer: Viewer, groupId: string) {
  if (!(await isGroupAdmin(viewer, groupId))) return false;
  await db.update(groups).set({ inviteCode: newInviteCode(), updatedAt: new Date() }).where(eq(groups.id, groupId));
  return true;
}

/** For moderators: every group's name, privacy and size, without any content. */
export async function listAllGroups() {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      privacy: groups.privacy,
      icon: groups.icon,
      color: groups.color,
      createdAt: groups.createdAt,
      memberCount,
      ownerName: sql<string | null>`(select ${users.displayName} from ${groupMembers} join ${users} on ${users.id} = ${groupMembers.userId} where ${groupMembers.groupId} = ${groups.id} and ${groupMembers.role} = 'owner' limit 1)`,
    })
    .from(groups)
    .orderBy(asc(groups.name));
  return rows.map((row) => ({ ...row, memberCount: Number(row.memberCount) }));
}

/** Groups where the viewer can post, for the composer's audience picker. */
export async function listPostableGroups(viewer: Viewer) {
  if (!isActiveMember(viewer)) return [];
  return db
    .select({ id: groups.id, name: groups.name, icon: groups.icon })
    .from(groups)
    .innerJoin(
      groupMembers,
      and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, viewer.id), eq(groupMembers.status, "active")),
    )
    .orderBy(asc(groups.name));
}

export function isGroupPrivacy(value: unknown): value is GroupPrivacy {
  return value === "open" || value === "private" || value === "hidden";
}

/** Used by the group page to decide what a non-member sees. */
export function canSeeGroupContent(group: Pick<GroupSummary, "myStatus">) {
  return group.myStatus === "active";
}

