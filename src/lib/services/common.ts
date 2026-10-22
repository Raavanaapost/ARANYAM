import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, REACTION_KINDS, type ReactionKind } from "@/lib/db/schema";

/** How an author is shown to other members. Null means "shared without a name". */
export type AuthorView = { id: string; displayName: string; avatarHue: number } | null;

/**
 * Anonymous content shows no author to anyone, moderators included. The only
 * place a moderator can see who wrote it is a report about that content.
 */
export function authorView(
  row: { authorId: string; isAnonymous: boolean; authorName: string | null; authorHue: number | null },
): AuthorView {
  if (row.isAnonymous || row.authorName === null) return null;
  return { id: row.authorId, displayName: row.authorName, avatarHue: row.authorHue ?? 150 };
}

export type ReactionSummary = {
  counts: Record<ReactionKind, number>;
  mine: ReactionKind[];
};

export function emptyReactions(): ReactionSummary {
  return { counts: { support: 0, hug: 0, same: 0 }, mine: [] };
}

export function isReactionKind(value: unknown): value is ReactionKind {
  return typeof value === "string" && (REACTION_KINDS as readonly string[]).includes(value);
}

/** Ids of the groups the viewer is an active member of. */
export async function activeGroupIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active")));
  return rows.map((row) => row.groupId);
}

export async function isActiveGroupMember(userId: string, groupId: string): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.status, "active")),
    );
  return (row?.value ?? 0) > 0;
}

/** Adds one database row of reaction counts to a per-item summary map. */
export function addReactionRow(
  map: Map<string, ReactionSummary>,
  row: { id: string; kind: ReactionKind; total: number; mine: boolean },
) {
  const summary = map.get(row.id) ?? emptyReactions();
  summary.counts[row.kind] = Number(row.total);
  if (row.mine) summary.mine.push(row.kind);
  map.set(row.id, summary);
}
