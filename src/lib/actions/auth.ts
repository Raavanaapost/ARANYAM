"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Locale } from "@/i18n/config";
import { authInternals, getAuth } from "@/lib/auth/auth";
import { clearSessionCookie, getRequestMeta } from "@/lib/auth/cookies";
import { getViewer } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/params";
import { checkPasswordStrength, PASSWORD_MAX_LENGTH } from "@/lib/auth/password";
import { hitRateLimit, RATE_LIMITS, resetRateLimit } from "@/lib/auth/rate-limit";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/constants";
import { env } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import {
  findUsableInvite,
  findUserById,
  findUserByResetToken,
  normalizeEmail,
  registerAccount,
  requestPasswordReset,
  sendVerificationEmail,
  resetPasswordWithToken,
} from "@/lib/services/accounts";
import { actionLocale, checked, invalid, isEmail, passwordMessage, rawText, text } from "./helpers";

/** The Google or Facebook button that submitted the form, if it is set up on this site. */
function chosenProvider(formData: FormData): SocialProvider | null {
  const value = formData.get("provider");
  const provider = SOCIAL_PROVIDERS.find((candidate) => candidate === value);
  return provider && env.socialProviders.includes(provider) ? provider : null;
}

/**
 * Sends the family to Google or Facebook. They come back to
 * /api/auth/callback/<provider>, which signs them in and continues at
 * /<language>/signed-in. Only the join page may create an account.
 */
async function startSocialSignIn(
  provider: SocialProvider,
  options: { locale: Locale; page: "login" | "register"; next?: string | null; joinNote?: string; inviteCode?: string },
): Promise<never> {
  const { locale, page, next } = options;
  const signUp = page === "register";
  const invite = signUp && options.inviteCode ? await findUsableInvite(options.inviteCode) : null;
  const back = new URLSearchParams({ social: provider });
  if (options.inviteCode) back.set("invite", options.inviteCode);
  const result = await getAuth().api.signInSocial({
    body: {
      provider,
      callbackURL: `/${locale}/signed-in${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      errorCallbackURL: `/${locale}/${page}?${back.toString()}`,
      requestSignUp: signUp,
      disableRedirect: true,
      additionalData: signUp
        ? { locale, joinNote: options.joinNote ?? "", ...(invite ? { inviteId: invite.invite.id } : {}) }
        : { locale },
    },
    headers: await headers(),
  });
  if (!result.url) throw new Error(`No sign-in address from ${provider}`);
  redirect(result.url);
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const provider = chosenProvider(formData);
  if (provider) {
    const { ip } = await getRequestMeta();
    if (!(await hitRateLimit(RATE_LIMITS.loginPerIp, ip)).allowed) return { status: "error", message: t.common.rateLimited };
    return startSocialSignIn(provider, { locale, page: "login", next: safeNextPath(text(formData, "next", 500)) });
  }
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

  const { ip } = await getRequestMeta();
  const [perEmail, perIp] = await Promise.all([
    hitRateLimit(RATE_LIMITS.loginPerEmail, email),
    hitRateLimit(RATE_LIMITS.loginPerIp, ip),
  ]);
  if (!perEmail.allowed || !perIp.allowed) {
    return { status: "error", message: t.common.rateLimited, values };
  }
  // No account can have a longer password, so skip the expensive check.
  if (password.length > PASSWORD_MAX_LENGTH) return { status: "error", message: t.auth.login.invalid, values };

  const requestHeaders = await headers();
  const auth = getAuth();
  // Replace any earlier session in this browser rather than leaving it behind.
  const previous = await auth.api.getSession({ headers: requestHeaders, query: { disableRefresh: true } }).catch(() => null);

  let userId: string;
  try {
    // Sets the session cookie through Better Auth's Next.js cookie plugin.
    const result = await auth.api.signInEmail({ body: { email, password, rememberMe: true }, headers: requestHeaders });
    userId = result.user.id;
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    // The password was right, but the account may not start a session:
    // Aranyam's session hook refuses paused (suspended) accounts.
    if (error.body?.code === "FAILED_TO_CREATE_SESSION") {
      return { status: "error", message: t.auth.login.suspended, values };
    }
    return { status: "error", message: t.auth.login.invalid, values };
  }

  await resetRateLimit(RATE_LIMITS.loginPerEmail, email);
  if (previous) await (await authInternals()).deleteSession(previous.session.token);

  const user = await findUserById(userId);
  if (!user?.emailVerified) redirect(`/${locale}/verify-email`);
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

  // Joining with Google or Facebook: they provide the name and email address.
  const provider = chosenProvider(formData);
  if (provider) {
    const socialErrors = invalid(
      {
        joinNote: joinNote.length > 1000 ? t.auth.errors.noteTooLong : undefined,
        agree: values.agree ? undefined : t.auth.errors.mustAgree,
      },
      values,
    );
    if (socialErrors) return socialErrors;
    const { ip } = await getRequestMeta();
    if (!(await hitRateLimit(RATE_LIMITS.registerPerIp, ip)).allowed) {
      return { status: "error", message: t.common.rateLimited, values };
    }
    return startSocialSignIn(provider, { locale, page: "register", joinNote, inviteCode: inviteCode || undefined });
  }

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

  await registerAccount({ displayName, email, password, joinNote, locale, inviteCode: inviteCode || undefined });
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
