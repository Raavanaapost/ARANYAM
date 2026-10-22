"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { hitRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { POST_KINDS } from "@/lib/db/schema";
import type { FormState } from "@/lib/form-state";
import { isReactionKind } from "@/lib/services/common";
import { createPost, deletePost, togglePostReaction, updatePost } from "@/lib/services/posts";
import { memberForAction } from "./guard";
import { actionLocale, checked, oneOf, text } from "./helpers";

const MAX_POST = 5000;

export async function createPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const body = text(formData, "body", MAX_POST + 1);
  const kind = oneOf(formData, "kind", POST_KINDS, "thought");
  const audience = text(formData, "audience", 40);
  const isAnonymous = checked(formData, "anonymous");
  const values = { body, kind, audience, anonymous: isAnonymous ? "on" : "" };

  if (!body) return { status: "error", fieldErrors: { body: t.posts.emptyBody }, values };
  if (body.length > MAX_POST) return { status: "error", fieldErrors: { body: t.posts.tooLong }, values };

  const limit = await hitRateLimit(RATE_LIMITS.postPerUser, viewer.id);
  if (!limit.allowed) return { status: "error", message: t.common.rateLimited, values };

  const id = await createPost(viewer, {
    body,
    kind,
    groupId: audience && audience !== "all" ? audience : null,
    isAnonymous,
  });
  if (!id) return { status: "error", message: t.common.notAllowed, values };
  refresh();
  return { status: "success", data: { id } };
}

export async function updatePostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const id = text(formData, "id", 40);
  const body = text(formData, "body", MAX_POST + 1);
  const kind = oneOf(formData, "kind", POST_KINDS, "thought");
  const values = { body, kind };
  if (!body) return { status: "error", fieldErrors: { body: t.posts.emptyBody }, values };
  if (body.length > MAX_POST) return { status: "error", fieldErrors: { body: t.posts.tooLong }, values };
  if (!(await updatePost(viewer, id, { body, kind }))) {
    return { status: "error", message: t.common.notAllowed, values };
  }
  redirect(`/${locale}/posts/${id}`);
}

export async function deletePostAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const id = text(formData, "id", 40);
  await deletePost(viewer, id);
  // On the post's own page there is nothing left to show.
  if (text(formData, "from", 20) === "post") redirect(`/${locale}/feed`);
  refresh();
}

export async function reactToPostAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const kind = formData.get("kind");
  if (!isReactionKind(kind)) return;
  await togglePostReaction(viewer, text(formData, "id", 40), kind);
  refresh();
}
