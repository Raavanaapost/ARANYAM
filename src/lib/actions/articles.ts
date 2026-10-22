"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { ARTICLE_TYPES, ARTICLE_VISIBILITY } from "@/lib/db/schema";
import type { FormState } from "@/lib/form-state";
import {
  canWrite,
  createArticle,
  deleteArticle,
  parseTags,
  toggleArticleReaction,
  updateArticle,
} from "@/lib/services/articles";
import { isReactionKind } from "@/lib/services/common";
import { memberForAction } from "./guard";
import { actionLocale, checked, invalid, isSafeHttpUrl, oneOf, text } from "./helpers";

const LIMITS = { title: 150, summary: 300, body: 50_000, source: 500 };

const section = (type: "blog" | "news") => (type === "news" ? "news" : "blogs");

export async function saveArticleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const type = oneOf(formData, "type", ARTICLE_TYPES, "blog");
  const id = text(formData, "id", 40);
  const publish = formData.get("intent") === "publish";
  const values = {
    title: text(formData, "title", LIMITS.title + 1),
    summary: text(formData, "summary", LIMITS.summary + 1),
    body: text(formData, "body", LIMITS.body + 1),
    tags: text(formData, "tags", 400),
    sourceUrl: text(formData, "sourceUrl", LIMITS.source + 1),
    visibility: oneOf(formData, "visibility", ARTICLE_VISIBILITY, "members"),
    anonymous: checked(formData, "anonymous") ? "on" : "",
  };
  if (!canWrite(viewer, type)) return { status: "error", message: t.common.notAllowed, values };

  const errors = invalid(
    {
      title: !values.title
        ? t.blogs.titleRequired
        : values.title.length > LIMITS.title
          ? t.common.tooLong
          : undefined,
      summary: values.summary.length > LIMITS.summary ? t.common.tooLong : undefined,
      body: publish && !values.body ? t.blogs.bodyRequired : values.body.length > LIMITS.body ? t.common.tooLong : undefined,
      sourceUrl:
        values.sourceUrl && (values.sourceUrl.length > LIMITS.source || !isSafeHttpUrl(values.sourceUrl))
          ? t.events.invalidUrl
          : undefined,
    },
    values,
  );
  if (errors) return errors;

  const input = {
    title: values.title,
    summary: values.summary,
    body: values.body,
    tags: parseTags(values.tags),
    visibility: values.visibility,
    isAnonymous: values.anonymous === "on",
    sourceUrl: values.sourceUrl,
    publish,
  };
  const savedId = id ? ((await updateArticle(viewer, id, input)) ? id : null) : await createArticle(viewer, type, input);
  if (!savedId) return { status: "error", message: t.common.notAllowed, values };
  redirect(`/${locale}/${section(type)}/${savedId}`);
}

export async function deleteArticleAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const type = await deleteArticle(viewer, text(formData, "id", 40));
  if (type) redirect(`/${locale}/${section(type)}`);
  refresh();
}

export async function reactToArticleAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const kind = formData.get("kind");
  if (!isReactionKind(kind)) return;
  await toggleArticleReaction(viewer, text(formData, "id", 40), kind);
  refresh();
}
