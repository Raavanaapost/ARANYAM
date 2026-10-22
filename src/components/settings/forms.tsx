"use client";

import { Link2, Trash2 } from "lucide-react";
import { useActionState, useId } from "react";
import { Alert } from "@/components/ui/alert";
import { CopyButton, PasswordInput, SubmitButton } from "@/components/ui/client";
import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import {
  changePasswordAction,
  createInviteAction,
  deleteAccountAction,
  updateProfileAction,
} from "@/lib/actions/settings";
import { initialFormState, type FormState } from "@/lib/form-state";

function LangField() {
  const { locale } = useI18n();
  return <input type="hidden" name="lang" value={locale} />;
}

function Messages({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>;
}

export function ProfileForm({
  profile,
}: {
  profile: { displayName: string; bio: string; location: string; locale: Locale };
}) {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  const value = (name: keyof typeof profile) => state.values?.[name] ?? profile[name];
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <LangField />
      <Messages state={state} />
      <Field id={`${id}-name`} label={t.settings.displayName} error={errors.displayName}>
        <Input
          id={`${id}-name`}
          name="displayName"
          autoComplete="name"
          maxLength={50}
          defaultValue={value("displayName")}
          invalid={Boolean(errors.displayName)}
          aria-describedby={describedBy(`${id}-name`, null, errors.displayName)}
        />
      </Field>
      <Field id={`${id}-bio`} label={t.settings.bio} hint={t.settings.bioHint} error={errors.bio}>
        <Textarea
          id={`${id}-bio`}
          name="bio"
          rows={4}
          maxLength={1000}
          defaultValue={value("bio")}
          invalid={Boolean(errors.bio)}
          aria-describedby={describedBy(`${id}-bio`, true, errors.bio)}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-location`} label={t.settings.location} hint={t.settings.locationHint} error={errors.location}>
          <Input
            id={`${id}-location`}
            name="location"
            maxLength={80}
            defaultValue={value("location")}
            invalid={Boolean(errors.location)}
            aria-describedby={describedBy(`${id}-location`, true, errors.location)}
          />
        </Field>
        <Field id={`${id}-locale`} label={t.settings.language} hint={t.settings.languageHint}>
          <Select id={`${id}-locale`} name="locale" defaultValue={value("locale")} aria-describedby={`${id}-locale-hint`}>
            <option value="ta">{t.common.tamil}</option>
            <option value="en">{t.common.english}</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm({ email }: { email: string }) {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <LangField />
      {/* Lets password managers know which account this is for. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Messages state={state} />
      <Field id={`${id}-current`} label={t.settings.currentPassword} error={errors.currentPassword}>
        <PasswordInput
          id={`${id}-current`}
          name="currentPassword"
          autoComplete="current-password"
          invalid={Boolean(errors.currentPassword)}
          aria-describedby={describedBy(`${id}-current`, null, errors.currentPassword)}
        />
      </Field>
      <Field
        id={`${id}-new`}
        label={t.settings.newPassword}
        hint={t.auth.register.passwordHint}
        error={errors.newPassword}
      >
        <PasswordInput
          id={`${id}-new`}
          name="newPassword"
          autoComplete="new-password"
          invalid={Boolean(errors.newPassword)}
          aria-describedby={describedBy(`${id}-new`, true, errors.newPassword)}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel={t.common.saving}>{t.settings.passwordTitle}</SubmitButton>
      </div>
    </form>
  );
}

export function InviteForm() {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(createInviteAction, initialFormState);
  const url = state.status === "success" ? state.data?.url : undefined;
  return (
    <div className="space-y-5">
      {url ? (
        <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary-soft p-4" role="status">
          <p className="font-semibold text-primary">{state.message}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-surface px-3.5 py-2.5 text-sm text-ink" data-testid="invite-url">
              {url}
            </code>
            <CopyButton value={url} />
          </div>
        </div>
      ) : null}
      <form action={action} className="space-y-4" noValidate>
        <LangField />
        {state.status === "error" ? <Messages state={state} /> : null}
        <Field id={`${id}-note`} label={t.settings.inviteNote} hint={t.settings.inviteNoteHint} optionalLabel={t.common.optional}>
          <Input id={`${id}-note`} name="note" maxLength={100} aria-describedby={`${id}-note-hint`} />
        </Field>
        <SubmitButton pendingLabel={t.common.loading}>
          <Link2 className="size-4" aria-hidden="true" />
          {t.settings.createInvite}
        </SubmitButton>
      </form>
    </div>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(deleteAccountAction, initialFormState);
  const error = state.fieldErrors?.password;
  return (
    <form action={action} className="space-y-4" noValidate>
      <LangField />
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {state.status === "error" && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field id={`${id}-password`} label={t.settings.deletePassword} error={error}>
        <PasswordInput
          id={`${id}-password`}
          name="password"
          autoComplete="current-password"
          invalid={Boolean(error)}
          aria-describedby={describedBy(`${id}-password`, null, error)}
        />
      </Field>
      <SubmitButton variant="danger" confirm={t.settings.deleteConfirm} pendingLabel={t.common.loading}>
        <Trash2 className="size-4" aria-hidden="true" />
        {t.settings.deleteButton}
      </SubmitButton>
    </form>
  );
}
