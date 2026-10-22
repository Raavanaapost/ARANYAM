"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { clearSessionCookie, getRequestMeta, readSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { getViewer } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/params";
import { checkPasswordStrength, PASSWORD_MAX_LENGTH } from "@/lib/auth/password";
import { hitRateLimit, RATE_LIMITS, resetRateLimit } from "@/lib/auth/rate-limit";
import { createSession, invalidateSessionToken } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import {
  authenticate,
  findUserById,
  findUserByResetToken,
  findUsableInvite,
  normalizeEmail,
  registerAccount,
  requestPasswordReset,
  resetPasswordWithToken,
  sendVerificationEmail,
} from "@/lib/services/accounts";
import { actionLocale, checked, invalid, isEmail, passwordMessage, rawText, text } from "./helpers";

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const email = normalizeEmail(text(formData, "email", 254));
  const password = rawText(formData, "password");
  const next = safeNextPath(text(formData, "next", 500));
  const values = { email };

  const errors = invalid(
    {
      email: !email ? t.auth.errors.required : !isEmail(email) ? t.auth.errors.invalidEmail : undefined,
      password: password ? undefined : t.auth.errors.required,
    },
    values,
  );
  if (errors) return errors;

  const { ip, userAgent } = await getRequestMeta();
  const [perEmail, perIp] = await Promise.all([
    hitRateLimit(RATE_LIMITS.loginPerEmail, email),
    hitRateLimit(RATE_LIMITS.loginPerIp, ip),
  ]);
  if (!perEmail.allowed || !perIp.allowed) {
    return { status: "error", message: t.common.rateLimited, values };
  }

  // No account can have a longer password, so skip the expensive check.
  const user = password.length <= PASSWORD_MAX_LENGTH ? await authenticate(email, password) : null;
  if (!user) return { status: "error", message: t.auth.login.invalid, values };
  if (user.status === "suspended") return { status: "error", message: t.auth.login.suspended, values };

  await resetRateLimit(RATE_LIMITS.loginPerEmail, email);
  // Replace any earlier session in this browser rather than leaving it behind.
  const previous = await readSessionCookie();
  if (previous) await invalidateSessionToken(previous);
  const session = await createSession(user.id, userAgent);
  await setSessionCookie(session.token, session.expiresAt);

  if (!user.emailVerifiedAt) redirect(`/${locale}/verify-email`);
  if (user.status !== "approved") redirect(`/${locale}/pending`);
  redirect(`/${locale}${next ?? "/feed"}`);
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const displayName = text(formData, "displayName", 200);
  const email = normalizeEmail(text(formData, "email", 254));
  const password = rawText(formData, "password");
  const joinNote = text(formData, "joinNote", 5000);
  const inviteCode = text(formData, "invite", 40);
  const values = { displayName, email, joinNote, agree: checked(formData, "agree") ? "on" : "" };

  const passwordIssue = checkPasswordStrength(password, email);
  const errors = invalid(
    {
      displayName:
        displayName.length < 2 || displayName.length > 50 ? t.auth.errors.nameLength : undefined,
      email: !email ? t.auth.errors.required : !isEmail(email) ? t.auth.errors.invalidEmail : undefined,
      password: passwordIssue ? passwordMessage(t, passwordIssue) : undefined,
      joinNote: joinNote.length > 1000 ? t.auth.errors.noteTooLong : undefined,
      agree: values.agree ? undefined : t.auth.errors.mustAgree,
    },
    values,
  );
  if (errors) return errors;

  const { ip } = await getRequestMeta();
  const limit = await hitRateLimit(RATE_LIMITS.registerPerIp, ip);
  if (!limit.allowed) return { status: "error", message: t.common.rateLimited, values };

  const invite = inviteCode ? await findUsableInvite(inviteCode) : null;
  await registerAccount({
    displayName,
    email,
    password,
    joinNote,
    locale,
    inviteCode: invite ? inviteCode : undefined,
  });
  // The same answer whether or not the email already had an account.
  return { status: "success", data: { email } };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = actionLocale(formData);
  const email = normalizeEmail(text(formData, "email", 254));
  const values = { email };
  const errors = invalid(
    { email: !email ? t.auth.errors.required : !isEmail(email) ? t.auth.errors.invalidEmail : undefined },
    values,
  );
  if (errors) return errors;

  const { ip } = await getRequestMeta();
  const perIp = await hitRateLimit(RATE_LIMITS.resetPerIp, ip);
  if (!perIp.allowed) return { status: "error", message: t.common.rateLimited, values };
  const perEmail = await hitRateLimit(RATE_LIMITS.resetPerEmail, email);

  // Sent after the response, so the reply takes the same time for every address.
  if (perEmail.allowed) after(() => requestPasswordReset(email));
  return { status: "success", message: t.auth.forgot.sent, values };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const token = text(formData, "token", 100);
  const password = rawText(formData, "password");

  const user = await findUserByResetToken(token);
  if (!user) return { status: "error", message: t.auth.reset.invalidBody };
  const issue = checkPasswordStrength(password, user.email);
  if (issue) return { status: "error", fieldErrors: { password: passwordMessage(t, issue) } };

  const updated = await resetPasswordWithToken(token, password);
  if (!updated) return { status: "error", message: t.auth.reset.invalidBody };
  // Every session was ended, including this browser's.
  await clearSessionCookie();
  redirect(`/${locale}/login?reset=1`);
}

export async function resendVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/login`);
  if (viewer.emailVerified) redirect(`/${locale}/feed`);

  const limit = await hitRateLimit(RATE_LIMITS.verifyResendPerEmail, viewer.email);
  if (!limit.allowed) return { status: "error", message: t.common.rateLimited };
  const user = await findUserById(viewer.id);
  if (user) await sendVerificationEmail(user);
  return { status: "success", message: t.auth.verify.resent };
}
