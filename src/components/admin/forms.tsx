"use client";

import { Eye, KeyRound } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { CopyButton, SubmitButton } from "@/components/ui/client";
import { useI18n } from "@/i18n/client";
import { createResetLinkAction, revealAuthorAction } from "@/lib/actions/moderation";
import { initialFormState } from "@/lib/form-state";

function LangField() {
  const { locale } = useI18n();
  return <input type="hidden" name="lang" value={locale} />;
}

/** Shows who wrote anonymous reported content. Every use is written to the activity log. */
export function RevealAuthor({ reportId }: { reportId: string }) {
  const { locale, t } = useI18n();
  const [state, action] = useActionState(revealAuthorAction, initialFormState);
  if (state.status === "success" && state.data) {
    return (
      <p className="text-sm text-ink">
        <Link href={`/${locale}/members/${state.data.id}`} className="font-semibold text-primary hover:underline">
          {state.data.name}
        </Link>{" "}
        <span className="text-muted">— {t.admin.authorRevealed}</span>
      </p>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <LangField />
      <input type="hidden" name="reportId" value={reportId} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <SubmitButton variant="ghost" size="sm" confirm={t.admin.revealNote}>
        <Eye className="size-4" aria-hidden="true" />
        {t.admin.revealAuthor}
      </SubmitButton>
      <p className="text-xs text-muted">{t.admin.revealNote}</p>
    </form>
  );
}

/** A one-time password reset link an admin can pass on privately. */
export function ResetLink({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(createResetLinkAction, initialFormState);
  const url = state.status === "success" ? state.data?.url : undefined;
  if (url) {
    return (
      <div className="w-full space-y-2 rounded-xl bg-primary-soft p-3" role="status">
        <p className="text-sm font-semibold text-primary">{t.admin.resetLinkReady}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 text-xs text-ink">{url}</code>
          <CopyButton value={url} />
        </div>
        <p className="text-xs text-muted">{t.admin.resetLinkHint}</p>
      </div>
    );
  }
  return (
    <form action={action}>
      <LangField />
      <input type="hidden" name="userId" value={userId} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <SubmitButton variant="ghost" size="sm">
        <KeyRound className="size-4" aria-hidden="true" />
        {t.admin.resetLink}
      </SubmitButton>
    </form>
  );
}
