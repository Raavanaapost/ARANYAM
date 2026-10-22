import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, comments, events, posts, users } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { isActiveMember, isModerator, type Viewer } from "@/lib/auth/viewer";
import { getArticle } from "./articles";
import { audit } from "./audit";
import { authorView, type AuthorView } from "./common";
import { getEvent } from "./events";
import { notify } from "./notifications";
import { getPost } from "./posts";

export type CommentTarget = { type: "post" | "article" | "event"; id: string };

export type CommentView = {
  id: string;
  body: string;
  isAnonymous: boolean;
  createdAt: Date;
  author: AuthorView;
  isMine: boolean;
  canDelete: boolean;
  canRemove: boolean;
};

function targetColumn(target: CommentTarget) {
  switch (target.type) {
    case "post":
      return comments.postId;
    case "article":
      return comments.articleId;
    case "event":
      return comments.eventId;
  }
}

/** Comments on something the caller has already checked the viewer may see. */
export async function listComments(viewer: Viewer, target: CommentTarget): Promise<CommentView[]> {
  const rows = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      body: comments.body,
      isAnonymous: comments.isAnonymous,
      createdAt: comments.createdAt,
      authorName: users.displayName,
      authorHue: users.avatarHue,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(targetColumn(target), target.id), isNull(comments.removedAt)))
    .orderBy(asc(comments.createdAt))
    .limit(500);
  return rows.map((row) => {
    const isMine = row.authorId === viewer.id;
    return {
      id: row.id,
      body: row.body,
      isAnonymous: row.isAnonymous,
      createdAt: row.createdAt,
      author: authorView(row),
      isMine,
      canDelete: isMine,
      canRemove: !isMine && isModerator(viewer),
    };
  });
}

/** Who should hear about a new comment, and where it is. Null if the viewer may not comment. */
async function resolveTarget(viewer: Viewer, target: CommentTarget) {
  if (target.type === "post") {
    const post = await getPost(viewer, target.id);
    if (!post || post.removed) return null;
    const [row] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, target.id));
    return { ownerId: row?.authorId, link: `/posts/${target.id}`, type: "comment_on_post" as const, title: "" };
  }
  if (target.type === "article") {
    const article = await getArticle(viewer, target.id);
    if (!article || article.removed || article.status !== "published") return null;
    const [row] = await db.select({ authorId: articles.authorId }).from(articles).where(eq(articles.id, target.id));
    const section = article.type === "news" ? "news" : "blogs";
    return {
      ownerId: row?.authorId,
      link: `/${section}/${target.id}`,
      type: "comment_on_article" as const,
      title: article.title,
    };
  }
  const event = await getEvent(viewer, target.id);
  if (!event || event.removed) return null;
  const [row] = await db.select({ createdById: events.createdById }).from(events).where(eq(events.id, target.id));
  return { ownerId: row?.createdById, link: `/events/${target.id}`, type: "comment_on_event" as const, title: event.title };
}

export async function addComment(
  viewer: Viewer,
  target: CommentTarget,
  input: { body: string; isAnonymous: boolean },
): Promise<string | null> {
  if (!isActiveMember(viewer)) return null;
  const resolved = await resolveTarget(viewer, target);
  if (!resolved) return null;
  const id = newId();
  await db.insert(comments).values({
    id,
    authorId: viewer.id,
    postId: target.type === "post" ? target.id : null,
    articleId: target.type === "article" ? target.id : null,
    eventId: target.type === "event" ? target.id : null,
    body: input.body,
    isAnonymous: input.isAnonymous,
  });
  if (resolved.ownerId) {
    await notify({
      userId: resolved.ownerId,
      type: resolved.type,
      actorId: viewer.id,
      actorAnonymous: input.isAnonymous,
      link: resolved.link,
      data: resolved.title ? { title: resolved.title.slice(0, 80) } : {},
    });
  }
  return id;
}

/** Authors delete their own comments; moderators remove other people's. */
export async function deleteComment(viewer: Viewer, id: string): Promise<boolean> {
  const [own] = await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.authorId, viewer.id)))
    .returning({ id: comments.id });
  if (own) return true;
  if (!isModerator(viewer)) return false;
  return removeComment(viewer, id);
}

export async function removeComment(moderator: Viewer, id: string) {
  if (!isModerator(moderator)) return false;
  const [removed] = await db
    .update(comments)
    .set({ removedAt: new Date(), removedById: moderator.id })
    .where(and(eq(comments.id, id), isNull(comments.removedAt)))
    .returning({ id: comments.id });
  if (removed) await audit(moderator.id, "content.remove", { type: "comment", id });
  return Boolean(removed);
}
