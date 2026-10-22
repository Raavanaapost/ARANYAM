import { and, arrayContains, count, desc, eq, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  articleReactions,
  articles,
  comments,
  users,
  type ArticleType,
  type ArticleVisibility,
  type ReactionKind,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { isActiveMember, isModerator, type Viewer } from "@/lib/auth/viewer";
import { audit } from "./audit";
import { addReactionRow, authorView, emptyReactions, type AuthorView, type ReactionSummary } from "./common";

export type ArticleListItem = {
  id: string;
  type: ArticleType;
  title: string;
  summary: string;
  tags: string[];
  visibility: ArticleVisibility;
  status: "draft" | "published";
  isAnonymous: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  author: AuthorView;
  isMine: boolean;
  readingMinutes: number;
  commentCount: number;
};

export type ArticleDetail = ArticleListItem & {
  body: string;
  sourceUrl: string;
  removed: boolean;
  reactions: ReactionSummary;
  canEdit: boolean;
  canRemove: boolean;
};

const wordCount = sql<number>`coalesce(array_length(regexp_split_to_array(trim(${articles.body}), '\\s+'), 1), 0)`;
// Conditions inside these subqueries are nested SQL on purpose: in a select without
// joins, Drizzle drops table names from columns written directly in the template,
// and an unqualified "id" would then match the inner table instead of the outer one.
const commentCount = sql<number>`(select count(*) from ${comments} where ${and(eq(comments.articleId, articles.id), isNull(comments.removedAt))})`;

const listFields = {
  id: articles.id,
  type: articles.type,
  authorId: articles.authorId,
  title: articles.title,
  summary: articles.summary,
  tags: articles.tags,
  visibility: articles.visibility,
  status: articles.status,
  isAnonymous: articles.isAnonymous,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  words: wordCount,
  commentCount,
  authorName: users.displayName,
  authorHue: users.avatarHue,
};

type ListRow = {
  id: string;
  type: ArticleType;
  authorId: string;
  title: string;
  summary: string;
  tags: string[];
  visibility: ArticleVisibility;
  status: "draft" | "published";
  isAnonymous: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  words: number;
  commentCount: number;
  authorName: string | null;
  authorHue: number | null;
};

function toListItem(row: ListRow, viewer: Viewer | null): ArticleListItem {
  const isMine = viewer?.id === row.authorId;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    tags: row.tags,
    visibility: row.visibility,
    status: row.status,
    isAnonymous: row.isAnonymous,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    // Visitors never learn who wrote a public news item.
    author: isActiveMember(viewer) ? authorView(row) : null,
    isMine,
    readingMinutes: Math.max(1, Math.round(Number(row.words) / 200)),
    commentCount: Number(row.commentCount),
  };
}

/** Published and not removed. */
const visibleNow = and(eq(articles.status, "published"), isNull(articles.removedAt), isNotNull(articles.publishedAt));

/** Public news for the welcome page, readable by visitors. */
export async function listPublicNews(limit = 3) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      summary: articles.summary,
      publishedAt: sql<Date>`${articles.publishedAt}`.mapWith(articles.publishedAt),
    })
    .from(articles)
    .where(and(eq(articles.type, "news"), eq(articles.visibility, "public"), visibleNow))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

export type ArticleListOptions = {
  type: ArticleType;
  tag?: string;
  /** Show one member's writing (anonymous pieces are left out, except to the author). */
  authorId?: string;
  before?: Date;
  limit?: number;
};

export async function listArticles(viewer: Viewer | null, options: ArticleListOptions) {
  const limit = options.limit ?? 20;
  const conditions: (SQL | undefined)[] = [eq(articles.type, options.type), visibleNow];
  if (!isActiveMember(viewer)) {
    // Visitors only ever see news that moderators marked public.
    if (options.type !== "news") return { items: [], hasMore: false };
    conditions.push(eq(articles.visibility, "public"));
  }
  if (options.tag) conditions.push(arrayContains(articles.tags, [options.tag]));
  if (options.authorId) {
    conditions.push(eq(articles.authorId, options.authorId));
    if (options.authorId !== viewer?.id) conditions.push(eq(articles.isAnonymous, false));
  }
  if (options.before) conditions.push(lt(articles.publishedAt, options.before));

  const rows = await db
    .select(listFields)
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt))
    .limit(limit + 1);
  return {
    items: rows.slice(0, limit).map((row) => toListItem(row, viewer)),
    hasMore: rows.length > limit,
  };
}

/** The viewer's own blogs or news, drafts included. */
export async function listOwnArticles(viewer: Viewer, type: ArticleType) {
  const rows = await db
    .select(listFields)
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(and(eq(articles.type, type), eq(articles.authorId, viewer.id), isNull(articles.removedAt)))
    .orderBy(desc(articles.updatedAt))
    .limit(100);
  return rows.map((row) => toListItem(row, viewer));
}

/** The most used topics, for the filter chips on the blog list. */
export async function listPopularTags(type: ArticleType, limit = 12): Promise<string[]> {
  const rows = await db
    .select({ tags: articles.tags })
    .from(articles)
    .where(and(eq(articles.type, type), visibleNow))
    .orderBy(desc(articles.publishedAt))
    .limit(300);
  const counts = new Map<string, number>();
  for (const { tags } of rows) for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function canEditArticle(viewer: Viewer, article: { type: ArticleType; authorId: string }) {
  if (article.authorId === viewer.id) return isActiveMember(viewer);
  // Any moderator may correct a news item.
  return article.type === "news" && isModerator(viewer);
}

export async function getArticle(viewer: Viewer | null, id: string): Promise<ArticleDetail | null> {
  const [row] = await db
    .select({ ...listFields, body: articles.body, sourceUrl: articles.sourceUrl, removedAt: articles.removedAt })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(eq(articles.id, id))
    .limit(1);
  if (!row) return null;

  const isAuthor = viewer?.id === row.authorId;
  if (!isActiveMember(viewer)) {
    if (!(row.type === "news" && row.visibility === "public" && row.status === "published" && !row.removedAt)) {
      return null;
    }
  } else {
    if (row.status === "draft" && !canEditArticle(viewer, row)) return null;
    // Removed content stays visible only to its author, with a notice.
    if (row.removedAt && !isAuthor) return null;
  }

  let reactions = emptyReactions();
  if (isActiveMember(viewer)) {
    const map = new Map<string, ReactionSummary>();
    const reactionRows = await db
      .select({
        id: articleReactions.articleId,
        kind: articleReactions.kind,
        total: count(),
        mine: sql<boolean>`bool_or(${articleReactions.userId} = ${viewer.id})`,
      })
      .from(articleReactions)
      .where(eq(articleReactions.articleId, id))
      .groupBy(articleReactions.articleId, articleReactions.kind);
    for (const reaction of reactionRows) addReactionRow(map, reaction);
    reactions = map.get(id) ?? reactions;
  }

  return {
    ...toListItem(row, viewer),
    body: row.body,
    sourceUrl: row.sourceUrl,
    removed: row.removedAt !== null,
    reactions,
    canEdit: viewer ? canEditArticle(viewer, row) && !row.removedAt : false,
    canRemove: isModerator(viewer) && !isAuthor && !row.removedAt,
  };
}

/** For the edit form: the article as stored, when the viewer may edit it. */
export async function getEditableArticle(viewer: Viewer, id: string) {
  const [row] = await db.select().from(articles).where(and(eq(articles.id, id), isNull(articles.removedAt))).limit(1);
  if (!row || !canEditArticle(viewer, row)) return null;
  return row;
}

export type ArticleInput = {
  title: string;
  summary: string;
  body: string;
  tags: string[];
  visibility: ArticleVisibility;
  isAnonymous: boolean;
  sourceUrl: string;
  publish: boolean;
};

/** Blogs are always members-only and news is never anonymous. */
function normalizeInput(type: ArticleType, input: ArticleInput) {
  return {
    title: input.title,
    summary: input.summary,
    body: input.body,
    tags: input.tags,
    visibility: type === "news" ? input.visibility : ("members" as const),
    isAnonymous: type === "blog" ? input.isAnonymous : false,
    sourceUrl: type === "news" ? input.sourceUrl : "",
  };
}

export function canWrite(viewer: Viewer, type: ArticleType) {
  return type === "news" ? isModerator(viewer) : isActiveMember(viewer);
}

export async function createArticle(viewer: Viewer, type: ArticleType, input: ArticleInput): Promise<string | null> {
  if (!canWrite(viewer, type)) return null;
  const id = newId();
  const now = new Date();
  await db.insert(articles).values({
    id,
    type,
    authorId: viewer.id,
    ...normalizeInput(type, input),
    status: input.publish ? "published" : "draft",
    publishedAt: input.publish ? now : null,
  });
  return id;
}

export async function updateArticle(viewer: Viewer, id: string, input: ArticleInput): Promise<boolean> {
  const existing = await getEditableArticle(viewer, id);
  if (!existing) return false;
  const now = new Date();
  await db
    .update(articles)
    .set({
      ...normalizeInput(existing.type, input),
      status: input.publish ? "published" : "draft",
      publishedAt: input.publish ? (existing.publishedAt ?? now) : existing.publishedAt,
      updatedAt: now,
    })
    .where(eq(articles.id, id));
  return true;
}

/** Authors delete their own writing; moderators delete news. */
export async function deleteArticle(viewer: Viewer, id: string): Promise<ArticleType | null> {
  const existing = await getEditableArticle(viewer, id);
  if (!existing) return null;
  await db.delete(articles).where(eq(articles.id, id));
  return existing.type;
}

/** Moderators hide someone else's blog or news item; the author still sees it, with a notice. */
export async function removeArticle(moderator: Viewer, id: string) {
  if (!isModerator(moderator)) return false;
  const [removed] = await db
    .update(articles)
    .set({ removedAt: new Date(), removedById: moderator.id })
    .where(and(eq(articles.id, id), isNull(articles.removedAt)))
    .returning({ id: articles.id });
  if (removed) await audit(moderator.id, "content.remove", { type: "article", id });
  return Boolean(removed);
}

export async function toggleArticleReaction(viewer: Viewer, id: string, kind: ReactionKind) {
  const article = await getArticle(viewer, id);
  if (!article || article.removed || article.status !== "published" || !isActiveMember(viewer)) return false;
  const deleted = await db
    .delete(articleReactions)
    .where(
      and(eq(articleReactions.articleId, id), eq(articleReactions.userId, viewer.id), eq(articleReactions.kind, kind)),
    )
    .returning({ kind: articleReactions.kind });
  if (deleted.length === 0) {
    await db.insert(articleReactions).values({ articleId: id, userId: viewer.id, kind }).onConflictDoNothing();
  }
  return true;
}

export function parseTags(value: string): string[] {
  const tags = value
    .split(/[,،、]/)
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase().slice(0, 30))
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 8);
}
