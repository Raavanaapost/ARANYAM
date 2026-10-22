import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  articles,
  comments,
  events,
  posts,
  reports,
  users,
  type ReportReason,
  type ReportTarget,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { isActiveMember, isModerator, type Viewer } from "@/lib/auth/viewer";
import { suspendMember } from "./accounts";
import { getArticle } from "./articles";
import { audit } from "./audit";
import { isActiveGroupMember } from "./common";
import { getEvent } from "./events";
import { getMemberProfile } from "./members";
import { getPost } from "./posts";

/** Can the reporter actually see what they are reporting? */
async function canSee(viewer: Viewer, type: ReportTarget, id: string): Promise<boolean> {
  switch (type) {
    case "post":
      return (await getPost(viewer, id)) !== null;
    case "article":
      return (await getArticle(viewer, id)) !== null;
    case "event":
      return (await getEvent(viewer, id)) !== null;
    case "user":
      return (await getMemberProfile(viewer, id)) !== null;
    case "comment": {
      const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
      if (!comment || comment.removedAt) return false;
      if (comment.postId) return canSee(viewer, "post", comment.postId);
      if (comment.articleId) return canSee(viewer, "article", comment.articleId);
      if (comment.eventId) return canSee(viewer, "event", comment.eventId);
      return false;
    }
  }
}

export async function createReport(
  viewer: Viewer,
  input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details: string },
): Promise<boolean> {
  if (!isActiveMember(viewer)) return false;
  if (!(await canSee(viewer, input.targetType, input.targetId))) return false;
  const [existing] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, viewer.id),
        eq(reports.targetType, input.targetType),
        eq(reports.targetId, input.targetId),
        eq(reports.status, "open"),
      ),
    )
    .limit(1);
  if (existing) return true;
  await db.insert(reports).values({
    id: newId(),
    reporterId: viewer.id,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details.slice(0, 1000),
  });
  return true;
}

type ReportedContent = {
  title: string;
  text: string;
  authorId: string | null;
  isAnonymous: boolean;
  removed: boolean;
  /** Where moderators can see it in context, when they have access. */
  link: string | null;
};

async function loadContent(type: ReportTarget, id: string, moderator: Viewer): Promise<ReportedContent | null> {
  switch (type) {
    case "post": {
      const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
      if (!row) return null;
      const inGroup = row.groupId ? await isActiveGroupMember(moderator.id, row.groupId) : true;
      return {
        title: "",
        text: row.body,
        authorId: row.authorId,
        isAnonymous: row.isAnonymous,
        removed: row.removedAt !== null,
        link: inGroup ? `/posts/${row.id}` : null,
      };
    }
    case "comment": {
      const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
      if (!row) return null;
      const link = row.postId
        ? `/posts/${row.postId}`
        : row.eventId
          ? `/events/${row.eventId}`
          : row.articleId
            ? `/blogs/${row.articleId}`
            : null;
      return {
        title: "",
        text: row.body,
        authorId: row.authorId,
        isAnonymous: row.isAnonymous,
        removed: row.removedAt !== null,
        link,
      };
    }
    case "article": {
      const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
      if (!row) return null;
      return {
        title: row.title,
        text: row.summary || row.body.slice(0, 600),
        authorId: row.authorId,
        isAnonymous: row.isAnonymous,
        removed: row.removedAt !== null,
        link: `/${row.type === "news" ? "news" : "blogs"}/${row.id}`,
      };
    }
    case "event": {
      const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
      if (!row) return null;
      return {
        title: row.title,
        text: row.description.slice(0, 600),
        authorId: row.createdById,
        isAnonymous: false,
        removed: row.removedAt !== null,
        link: `/events/${row.id}`,
      };
    }
    case "user": {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!row) return null;
      return {
        title: row.displayName,
        text: row.bio,
        authorId: row.id,
        isAnonymous: false,
        removed: row.status === "suspended",
        link: `/members/${row.id}`,
      };
    }
  }
}

export type ReportView = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string;
  createdAt: Date;
  reporterName: string | null;
  content: (ReportedContent & { authorName: string | null }) | null;
};

/** Open reports with the reported content. Names behind anonymous content stay hidden until revealed. */
export async function listOpenReports(moderator: Viewer): Promise<ReportView[]> {
  if (!isModerator(moderator)) return [];
  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      details: reports.details,
      createdAt: reports.createdAt,
      reporterName: users.displayName,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterId))
    .where(eq(reports.status, "open"))
    .orderBy(asc(reports.createdAt))
    .limit(100);
  const result: ReportView[] = [];
  for (const row of rows) {
    const content = await loadContent(row.targetType, row.targetId, moderator);
    let authorName: string | null = null;
    if (content?.authorId && !content.isAnonymous) {
      const [author] = await db
        .select({ name: users.displayName })
        .from(users)
        .where(eq(users.id, content.authorId));
      authorName = author?.name ?? null;
    }
    result.push({ ...row, content: content ? { ...content, authorName } : null });
  }
  return result;
}

export async function countOpenReports() {
  const [row] = await db.select({ value: count() }).from(reports).where(eq(reports.status, "open"));
  return row?.value ?? 0;
}

async function findOpenReport(id: string) {
  const [row] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.status, "open")))
    .limit(1);
  return row ?? null;
}

/**
 * Shows a moderator who wrote reported anonymous content. Every look is
 * written to the audit log, as promised on the privacy page.
 */
export async function revealReportAuthor(moderator: Viewer, reportId: string) {
  if (!isModerator(moderator)) return null;
  const report = await findOpenReport(reportId);
  if (!report) return null;
  const content = await loadContent(report.targetType, report.targetId, moderator);
  if (!content?.authorId) return null;
  const [author] = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(eq(users.id, content.authorId));
  if (!author) return null;
  await audit(moderator.id, "report.reveal", { type: report.targetType, id: report.targetId }, { report: reportId });
  return author;
}

async function removeTarget(moderator: Viewer, type: ReportTarget, id: string) {
  const now = new Date();
  const removal = { removedAt: now, removedById: moderator.id };
  switch (type) {
    case "post":
      await db.update(posts).set(removal).where(eq(posts.id, id));
      break;
    case "comment":
      await db.update(comments).set(removal).where(eq(comments.id, id));
      break;
    case "article":
      await db.update(articles).set(removal).where(eq(articles.id, id));
      break;
    case "event":
      await db.update(events).set(removal).where(eq(events.id, id));
      break;
    case "user":
      break;
  }
}

export type ReportAction = "remove" | "dismiss" | "suspend";

export async function resolveReport(moderator: Viewer, reportId: string, action: ReportAction) {
  if (!isModerator(moderator)) return false;
  const report = await findOpenReport(reportId);
  if (!report) return false;

  if (action === "dismiss") {
    await db
      .update(reports)
      .set({ status: "dismissed", resolvedById: moderator.id, resolvedAt: new Date(), resolution: "dismissed" })
      .where(eq(reports.id, reportId));
    await audit(moderator.id, "report.dismiss", { type: report.targetType, id: report.targetId }, { report: reportId });
    return true;
  }

  const content = await loadContent(report.targetType, report.targetId, moderator);
  await removeTarget(moderator, report.targetType, report.targetId);
  if (action === "suspend" && content?.authorId) {
    await suspendMember(moderator.id, content.authorId);
  }
  // Close every open report about the same thing.
  await db
    .update(reports)
    .set({ status: "resolved", resolvedById: moderator.id, resolvedAt: new Date(), resolution: action })
    .where(
      and(
        eq(reports.targetType, report.targetType),
        eq(reports.targetId, report.targetId),
        eq(reports.status, "open"),
      ),
    );
  await audit(moderator.id, "report.remove", { type: report.targetType, id: report.targetId }, { report: reportId, action });
  return true;
}
