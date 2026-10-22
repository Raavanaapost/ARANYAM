"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/dal";
import { hitRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { REPORT_REASONS, REPORT_TARGETS, USER_ROLES } from "@/lib/db/schema";
import type { FormState } from "@/lib/form-state";
import {
  approveMember,
  createResetLinkFor,
  declineMember,
  findUserById,
  markEmailVerified,
  reinstateMember,
  sendVerificationEmail,
  setMemberRole,
  suspendMember,
} from "@/lib/services/accounts";
import { removeArticle } from "@/lib/services/articles";
import { removeComment } from "@/lib/services/comments";
import { removeEvent } from "@/lib/services/events";
import { removePost } from "@/lib/services/posts";
import { createReport, resolveReport, revealReportAuthor, type ReportAction } from "@/lib/services/reports";
import { adminForAction, memberForAction, moderatorForAction } from "./guard";
import { actionLocale, oneOf, text } from "./helpers";

/* ------------------------------ Members ------------------------------- */

export async function moderateMemberAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const moderator = await moderatorForAction(locale);
  const userId = text(formData, "userId", 40);
  switch (formData.get("intent")) {
    case "approve":
      await approveMember(moderator.id, userId);
      break;
    case "decline":
      await declineMember(moderator.id, userId);
      break;
    case "suspend":
      await suspendMember(moderator.id, userId);
      break;
    case "reinstate":
      await reinstateMember(moderator.id, userId);
      break;
    case "verify":
      await markEmailVerified(moderator.id, userId);
      break;
    case "resend": {
      const user = await findUserById(userId);
      if (user) await sendVerificationEmail(user);
      break;
    }
  }
  refresh();
}

export async function setRoleAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const admin = await adminForAction(locale);
  const role = oneOf(formData, "role", USER_ROLES, "member");
  await setMemberRole(admin.id, text(formData, "userId", 40), role);
  refresh();
}

export async function createResetLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const admin = await adminForAction(locale);
  const link = await createResetLinkFor(admin.id, text(formData, "userId", 40));
  if (!link) return { status: "error", message: t.common.genericError };
  return { status: "success", data: { url: link } };
}

/* ------------------------------ Reports ------------------------------- */

export async function createReportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const limit = await hitRateLimit(RATE_LIMITS.reportPerUser, viewer.id);
  if (!limit.allowed) return { status: "error", message: t.common.rateLimited };
  const ok = await createReport(viewer, {
    targetType: oneOf(formData, "targetType", REPORT_TARGETS, "post"),
    targetId: text(formData, "targetId", 40),
    reason: oneOf(formData, "reason", REPORT_REASONS, "other"),
    details: text(formData, "details", 1000),
  });
  if (!ok) return { status: "error", message: t.common.genericError };
  return { status: "success", message: t.report.thanks };
}

export async function resolveReportAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const moderator = await moderatorForAction(locale);
  const actions: readonly ReportAction[] = ["remove", "dismiss", "suspend"];
  await resolveReport(moderator, text(formData, "reportId", 40), oneOf(formData, "intent", actions, "dismiss"));
  refresh();
}

export async function revealAuthorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const moderator = await moderatorForAction(locale);
  const author = await revealReportAuthor(moderator, text(formData, "reportId", 40));
  if (!author) return { status: "error", message: t.admin.contentMissing };
  return { status: "success", data: { name: author.name, id: author.id } };
}

/**
 * Moderators can remove a post, comment, blog, news item or event straight from
 * where they see it. On the item's own page they are sent back to its list.
 */
export async function removeContentAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const moderator = await moderatorForAction(locale);
  const id = text(formData, "id", 40);
  switch (formData.get("type")) {
    case "post":
      await removePost(moderator, id);
      break;
    case "comment":
      await removeComment(moderator, id);
      break;
    case "article":
      await removeArticle(moderator, id);
      break;
    case "event":
      await removeEvent(moderator, id);
      break;
  }
  const next = safeNextPath(formData.get("next"));
  if (next) redirect(`/${locale}${next}`);
  refresh();
}
