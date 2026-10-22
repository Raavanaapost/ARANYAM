import { and, count, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { comments, groups, postReactions, posts, users, type PostKind, type ReactionKind } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { isActiveMember, isModerator, type Viewer } from "@/lib/auth/viewer";
import { audit } from "./audit";
import {
  activeGroupIds,
  addReactionRow,
  authorView,
  emptyReactions,
  isActiveGroupMember,
  type AuthorView,
  type ReactionSummary,
} from "./common";

export type PostView = {
  id: string;
  kind: PostKind;
  body: string;
  isAnonymous: boolean;
  createdAt: Date;
  editedAt: Date | null;
  removed: boolean;
  author: AuthorView;
  isMine: boolean;
  group: { id: string; name: string; icon: string } | null;
  reactions: ReactionSummary;
  commentCount: number;
  canEdit: boolean;
  canDelete: boolean;
  /** A moderator removing someone else's post, rather than the author deleting it. */
  canRemove: boolean;
};

// Conditions inside these subqueries are nested SQL on purpose: in a select without
// joins, Drizzle drops table names from columns written directly in the template,
// and an unqualified "id" would then match the inner table instead of the outer one.
const commentCount = sql<number>`(select count(*) from ${comments} where ${and(eq(comments.postId, posts.id), isNull(comments.removedAt))})`;

const postFields = {
  id: posts.id,
  authorId: posts.authorId,
  kind: posts.kind,
  body: posts.body,
  isAnonymous: posts.isAnonymous,
  createdAt: posts.createdAt,
  editedAt: posts.editedAt,
  removedAt: posts.removedAt,
  groupId: posts.groupId,
  groupName: groups.name,
  groupIcon: groups.icon,
  authorName: users.displayName,
  authorHue: users.avatarHue,
  commentCount,
};

type PostRow = {
  id: string;
  authorId: string;
  kind: PostKind;
  body: string;
  isAnonymous: boolean;
  createdAt: Date;
  editedAt: Date | null;
  removedAt: Date | null;
  groupId: string | null;
  groupName: string | null;
  groupIcon: string | null;
  authorName: string | null;
  authorHue: number | null;
  commentCount: number;
};

async function reactionsFor(viewer: Viewer, ids: string[]) {
  const map = new Map<string, ReactionSummary>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      id: postReactions.postId,
      kind: postReactions.kind,
      total: count(),
      mine: sql<boolean>`bool_or(${postReactions.userId} = ${viewer.id})`,
    })
    .from(postReactions)
    .where(inArray(postReactions.postId, ids))
    .groupBy(postReactions.postId, postReactions.kind);
  for (const row of rows) addReactionRow(map, row);
  return map;
}

function toView(row: PostRow, viewer: Viewer, reactions: Map<string, ReactionSummary>): PostView {
  const isMine = row.authorId === viewer.id;
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    isAnonymous: row.isAnonymous,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    removed: row.removedAt !== null,
    author: authorView(row),
    isMine,
    group: row.groupId ? { id: row.groupId, name: row.groupName ?? "", icon: row.groupIcon ?? "🌳" } : null,
    reactions: reactions.get(row.id) ?? emptyReactions(),
    commentCount: Number(row.commentCount),
    canEdit: isMine && row.removedAt === null,
    canDelete: isMine,
    canRemove: !isMine && isModerator(viewer) && row.removedAt === null,
  };
}

export type FeedOptions = {
  /** Only posts shared in this group (the viewer must belong to it). */
  groupId?: string;
  /** Only posts by this member; anonymous posts are left out except for the author. */
  authorId?: string;
  kind?: PostKind;
  before?: Date;
  limit?: number;
};

/**
 * Posts the viewer may see: those shared with all members, plus those shared
 * in groups the viewer belongs to.
 */
export async function listPosts(viewer: Viewer, options: FeedOptions = {}) {
  if (!isActiveMember(viewer)) return { items: [] as PostView[], hasMore: false };
  const limit = options.limit ?? 15;
  const conditions: (SQL | undefined)[] = [isNull(posts.removedAt)];

  if (options.groupId) {
    if (!(await isActiveGroupMember(viewer.id, options.groupId))) return { items: [], hasMore: false };
    conditions.push(eq(posts.groupId, options.groupId));
  } else {
    const groupIds = await activeGroupIds(viewer.id);
    conditions.push(groupIds.length ? or(isNull(posts.groupId), inArray(posts.groupId, groupIds)) : isNull(posts.groupId));
  }
  if (options.authorId) {
    conditions.push(eq(posts.authorId, options.authorId));
    if (options.authorId !== viewer.id) conditions.push(eq(posts.isAnonymous, false));
  }
  if (options.kind) conditions.push(eq(posts.kind, options.kind));
  if (options.before) conditions.push(lt(posts.createdAt, options.before));

  const rows = await db
    .select(postFields)
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const reactions = await reactionsFor(viewer, page.map((row) => row.id));
  return { items: page.map((row) => toView(row, viewer, reactions)), hasMore: rows.length > limit };
}

/** One post, if the viewer may see it. Removed posts are only shown to their author. */
export async function getPost(viewer: Viewer, id: string): Promise<PostView | null> {
  if (!isActiveMember(viewer)) return null;
  const [row] = await db
    .select(postFields)
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(eq(posts.id, id))
    .limit(1);
  if (!row) return null;
  if (row.groupId && !(await isActiveGroupMember(viewer.id, row.groupId))) return null;
  if (row.removedAt && row.authorId !== viewer.id) return null;
  const reactions = await reactionsFor(viewer, [row.id]);
  return toView(row, viewer, reactions);
}

export type PostInput = { body: string; kind: PostKind; groupId: string | null; isAnonymous: boolean };

export async function createPost(viewer: Viewer, input: PostInput): Promise<string | null> {
  if (!isActiveMember(viewer)) return null;
  if (input.groupId && !(await isActiveGroupMember(viewer.id, input.groupId))) return null;
  const id = newId();
  await db.insert(posts).values({
    id,
    authorId: viewer.id,
    groupId: input.groupId,
    kind: input.kind,
    body: input.body,
    isAnonymous: input.isAnonymous,
  });
  return id;
}

export async function updatePost(viewer: Viewer, id: string, input: { body: string; kind: PostKind }) {
  const [updated] = await db
    .update(posts)
    .set({ body: input.body, kind: input.kind, editedAt: new Date() })
    .where(and(eq(posts.id, id), eq(posts.authorId, viewer.id), isNull(posts.removedAt)))
    .returning({ id: posts.id });
  return Boolean(updated);
}

/**
 * Authors delete their own posts completely. Moderators remove other people's
 * posts, which hides them but keeps a record for the author and the audit log.
 */
export async function deletePost(viewer: Viewer, id: string): Promise<"deleted" | "removed" | null> {
  const [own] = await db
    .delete(posts)
    .where(and(eq(posts.id, id), eq(posts.authorId, viewer.id)))
    .returning({ id: posts.id });
  if (own) return "deleted";
  if (!isModerator(viewer)) return null;
  const removed = await removePost(viewer, id);
  return removed ? "removed" : null;
}

export async function removePost(moderator: Viewer, id: string) {
  if (!isModerator(moderator)) return false;
  const [removed] = await db
    .update(posts)
    .set({ removedAt: new Date(), removedById: moderator.id })
    .where(and(eq(posts.id, id), isNull(posts.removedAt)))
    .returning({ id: posts.id });
  if (removed) await audit(moderator.id, "content.remove", { type: "post", id });
  return Boolean(removed);
}

export async function togglePostReaction(viewer: Viewer, id: string, kind: ReactionKind) {
  const post = await getPost(viewer, id);
  if (!post || post.removed) return false;
  const deleted = await db
    .delete(postReactions)
    .where(and(eq(postReactions.postId, id), eq(postReactions.userId, viewer.id), eq(postReactions.kind, kind)))
    .returning({ kind: postReactions.kind });
  if (deleted.length === 0) {
    await db.insert(postReactions).values({ postId: id, userId: viewer.id, kind }).onConflictDoNothing();
  }
  return true;
}

export async function countPostsSince(since: Date) {
  const [row] = await db
    .select({ value: count() })
    .from(posts)
    .where(and(isNull(posts.removedAt), sql`${posts.createdAt} >= ${since.toISOString()}::timestamptz`));
  return row?.value ?? 0;
}
