"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PasswordInput, SubmitButton } from "@/components/ui/client";
import { Checkbox, describedBy, Field, Input, Textarea } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
} from "@/lib/actions/auth";
import type { SocialProvider } from "@/lib/constants";
import { initialFormState, type FormState } from "@/lib/form-state";

function LangField() {
  const { locale } = useI18n();
  return <input type="hidden" name="lang" value={locale} />;
}

function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>;
}

function EmailField({ state, hint }: { state: FormState; hint?: string }) {
  const { t } = useI18n();
  const error = state.fieldErrors?.email;
  return (
    <Field id="email" label={t.auth.email} hint={hint} error={error}>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.values?.email}
        invalid={Boolean(error)}
        aria-describedby={describedBy("email", hint, error)}
      />
    </Field>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#ffffff" />
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"
      />
    </svg>
  );
}

/**
 * "Continue with Google / Facebook": extra submit buttons of the same form, so
 * the join page's agreement and note travel with them.
 */
function SocialButtons({ providers, hint }: { providers: SocialProvider[]; hint?: string }) {
  const { t } = useI18n();
  if (providers.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t.auth.social.or}
        <span className="h-px flex-1 bg-line" />
      </div>
      {providers.map((provider) => (
        <button
          key={provider}
          type="submit"
          name="provider"
          value={provider}
          className={
            provider === "google"
              ? "flex w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-surface px-5 py-3 font-semibold text-ink transition-colors hover:bg-sunken"
              : "flex w-full items-center justify-center gap-3 rounded-full bg-[#1877F2] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#166fe0]"
          }
        >
          {provider === "google" ? <GoogleMark /> : <FacebookMark />}
          {t.auth.social[provider]}
        </button>
      ))}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function LoginForm({ next, socialProviders = [] }: { next: string | null; socialProviders?: SocialProvider[] }) {
  const { locale, t } = useI18n();
  const [state, action] = useActionState(loginAction, initialFormState);
  const passwordError = state.fieldErrors?.password;
  return (
    <form action={action} noValidate className="space-y-5">
      <LangField />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <EmailField state={state} />
      <Field id="password" label={t.auth.password} error={passwordError}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          invalid={Boolean(passwordError)}
          aria-describedby={describedBy("password", null, passwordError)}
        />
      </Field>
      <div className="flex justify-end">
        <Link href={`/${locale}/forgot-password`} className="text-sm font-semibold text-primary hover:underline">
          {t.auth.login.forgot}
        </Link>
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel={t.common.loading}>
        {t.auth.login.submit}
      </SubmitButton>
      <SocialButtons providers={socialProviders} />
    </form>
  );
}

export function RegisterForm({
  invite,
  socialProviders = [],
}: {
  invite: string | null;
  socialProviders?: SocialProvider[];
}) {
  const { locale, t } = useI18n();
  const [state, action] = useActionState(registerAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  if (state.status === "success") {
    return (
      <div className="space-y-4 text-center" role="status">
        <MailCheck className="mx-auto size-12 text-primary" aria-hidden="true" />
        <h2 className="text-xl">{t.auth.register.checkEmailTitle}</h2>
        <p className="text-muted">{format(t.auth.register.checkEmailBody, { email: state.data?.email ?? "" })}</p>
        <p className="text-muted">{t.auth.register.checkEmailNext}</p>
        <ButtonLink href={`/${locale}/login`} variant="secondary" className="mt-2">
          {t.auth.register.loginLink}
        </ButtonLink>
      </div>
    );
  }

  const [agreeBefore, agreeAfter] = t.auth.register.agree.split("{link}");
  return (
    <form action={action} noValidate className="space-y-5">
      <LangField />
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}
      <FormMessage state={state} />
      <Field
        id="displayName"
        label={t.auth.register.displayName}
        hint={t.auth.register.displayNameHint}
        error={errors.displayName}
      >
        <Input
          id="displayName"
          name="displayName"
          autoComplete="nickname"
          required
          maxLength={50}
          defaultValue={state.values?.displayName}
          invalid={Boolean(errors.displayName)}
          aria-describedby={describedBy("displayName", true, errors.displayName)}
        />
      </Field>
      <EmailField state={state} hint={t.auth.register.emailHint} />
      <Field id="password" label={t.auth.password} hint={t.auth.register.passwordHint} error={errors.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          invalid={Boolean(errors.password)}
          aria-describedby={describedBy("password", true, errors.password)}
        />
      </Field>
      {invite ? null : (
        <Field
          id="joinNote"
          label={t.auth.register.joinNote}
          hint={t.auth.register.joinNoteHint}
          optionalLabel={t.common.optional}
          error={errors.joinNote}
        >
          <Textarea
            id="joinNote"
            name="joinNote"
            maxLength={1000}
            rows={3}
            defaultValue={state.values?.joinNote}
            invalid={Boolean(errors.joinNote)}
            aria-describedby={describedBy("joinNote", true, errors.joinNote)}
          />
        </Field>
      )}
      <div>
        <Checkbox
          id="agree"
          name="agree"
          defaultChecked={state.values?.agree === "on"}
          label={
            <>
              {agreeBefore}
              <Link
                href={`/${locale}/guidelines`}
                target="_blank"
                className="font-semibold text-primary underline underline-offset-2"
              >
                {t.auth.register.agreeLink}
              </Link>
              {agreeAfter}
            </>
          }
        />
        {errors.agree ? (
          <p className="mt-1.5 text-sm font-medium text-danger" role="alert">
            {errors.agree}
          </p>
        ) : null}
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel={t.common.loading}>
        {t.auth.register.submit}
      </SubmitButton>
      <SocialButtons providers={socialProviders} hint={t.auth.social.joinHint} />
    </form>
  );
}

export function ForgotPasswordForm() {
  const { locale, t } = useI18n();
  const [state, action] = useActionState(forgotPasswordAction, initialFormState);
  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <FormMessage state={state} />
        <ButtonLink href={`/${locale}/login`} variant="secondary" className="w-full">
          {t.auth.forgot.backToLogin}
        </ButtonLink>
      </div>
    );
  }
  return (
    <form action={action} noValidate className="space-y-5">
      <LangField />
      <FormMessage state={state} />
      <EmailField state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel={t.common.loading}>
        {t.auth.forgot.submit}
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(resetPasswordAction, initialFormState);
  const error = state.fieldErrors?.password;
  return (
    <form action={action} noValidate className="space-y-5">
      <LangField />
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field id="password" label={t.auth.reset.newPassword} hint={t.auth.register.passwordHint} error={error}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          invalid={Boolean(error)}
          aria-describedby={describedBy("password", true, error)}
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel={t.common.saving}>
        {t.auth.reset.submit}
      </SubmitButton>
    </form>
  );
}

export function ResendVerificationForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(resendVerificationAction, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <LangField />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="w-full" pendingLabel={t.common.loading}>
        {t.auth.verify.resend}
      </SubmitButton>
    </form>
  );
}
