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

export function LoginForm({ next }: { next: string | null }) {
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
    </form>
  );
}

export function RegisterForm({ invite }: { invite: string | null }) {
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
