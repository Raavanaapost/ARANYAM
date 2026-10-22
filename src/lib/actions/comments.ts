"use server";

import { refresh } from "next/cache";
import { hitRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import type { FormState } from "@/lib/form-state";
import { addComment, deleteComment } from "@/lib/services/comments";
import { memberForAction } from "./guard";
import { actionLocale, checked, oneOf, text } from "./helpers";

const MAX_COMMENT = 2000;
const TARGETS = ["post", "article", "event"] as const;

export async function addCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const body = text(formData, "body", MAX_COMMENT + 1);
  const isAnonymous = checked(formData, "anonymous");
  const values = { body, anonymous: isAnonymous ? "on" : "" };
  if (!body) return { status: "error", fieldErrors: { body: t.comments.emptyBody }, values };
  if (body.length > MAX_COMMENT) return { status: "error", fieldErrors: { body: t.comments.tooLong }, values };

  const limit = await hitRateLimit(RATE_LIMITS.commentPerUser, viewer.id);
  if (!limit.allowed) return { status: "error", message: t.common.rateLimited, values };

  const id = await addComment(
    viewer,
    { type: oneOf(formData, "targetType", TARGETS, "post"), id: text(formData, "targetId", 40) },
    { body, isAnonymous },
  );
  if (!id) return { status: "error", message: t.common.notAllowed, values };
  refresh();
  return { status: "success", data: { id } };
}

export async function deleteCommentAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await deleteComment(viewer, text(formData, "id", 40));
  refresh();
}
