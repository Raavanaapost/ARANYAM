"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { locales } from "@/i18n/config";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { getViewer } from "@/lib/auth/dal";
import { checkPasswordStrength } from "@/lib/auth/password";
import { hitRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { invalidateOtherSessions } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import { changePassword, deleteAccount, updateProfile } from "@/lib/services/accounts";
import { createInvite, inviteUrl, revokeInvite } from "@/lib/services/invites";
import { markAllRead } from "@/lib/services/notifications";
import { memberForAction } from "./guard";
import { actionLocale, invalid, oneOf, passwordMessage, rawText, text } from "./helpers";

/** Settings are open to everyone who is logged in, including families still waiting for approval. */
async function userForAction(locale: (typeof locales)[number]) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/login`);
  return viewer;
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await userForAction(locale);
  const values = {
    displayName: text(formData, "displayName", 200),
    bio: text(formData, "bio", 1001),
    location: text(formData, "location", 81),
    locale: oneOf(formData, "locale", locales, viewer.locale),
  };
  const errors = invalid(
    {
      displayName:
        values.displayName.length < 2 || values.displayName.length > 50 ? t.auth.errors.nameLength : undefined,
      bio: values.bio.length > 1000 ? t.common.tooLong : undefined,
      location: values.location.length > 80 ? t.common.tooLong : undefined,
    },
    values,
  );
  if (errors) return errors;
  await updateProfile(viewer.id, values);
  refresh();
  return { status: "success", message: t.settings.profileSaved, values };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await userForAction(locale);
  const current = rawText(formData, "currentPassword");
  const next = rawText(formData, "newPassword");

  const limit = await hitRateLimit(RATE_LIMITS.loginPerEmail, viewer.email);
  if (!limit.allowed) return { status: "error", message: t.common.rateLimited };

  const issue = checkPasswordStrength(next, viewer.email);
  if (issue) return { status: "error", fieldErrors: { newPassword: passwordMessage(t, issue) } };
  if (!current || !(await changePassword(viewer.id, current, next))) {
    return { status: "error", fieldErrors: { currentPassword: t.auth.errors.wrongPassword } };
  }
  await invalidateOtherSessions(viewer.id, viewer.sessionId);
  return { status: "success", message: t.settings.passwordChanged };
}

export async function signOutOtherSessionsAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await userForAction(locale);
  await invalidateOtherSessions(viewer.id, viewer.sessionId);
  refresh();
}

export async function createInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const limit = await hitRateLimit(RATE_LIMITS.invitePerUser, viewer.id);
  if (!limit.allowed) return { status: "error", message: t.common.rateLimited };
  const code = await createInvite(viewer, text(formData, "note", 100));
  if (!code) return { status: "error", message: t.common.notAllowed };
  refresh();
  return { status: "success", message: t.settings.inviteCreated, data: { url: inviteUrl(locale, code) } };
}

export async function revokeInviteAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await revokeInvite(viewer, text(formData, "id", 40));
  refresh();
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await userForAction(locale);
  const limit = await hitRateLimit(RATE_LIMITS.loginPerEmail, viewer.email);
  if (!limit.allowed) return { status: "error", message: t.common.rateLimited };
  if (!(await deleteAccount(viewer.id, rawText(formData, "password")))) {
    return { status: "error", fieldErrors: { password: t.auth.errors.wrongPassword } };
  }
  await clearSessionCookie();
  redirect(`/${locale}`);
}

export async function markNotificationsReadAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await markAllRead(viewer.id);
  refresh();
}
