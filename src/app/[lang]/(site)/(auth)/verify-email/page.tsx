import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard, AuthCardSkeleton } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/forms";
import { LogoutButton } from "@/components/auth/logout-button";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.verify.title };
}

/** Shown after logging in with an email address that is not confirmed yet. */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={1} />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

async function VerifyEmailContent() {
  const { locale, t } = await getI18n();
  const viewer = await requireUser();
  if (viewer.emailVerified) redirect(`/${locale}/feed`);

  return (
    <AuthCard
      title={t.auth.verify.title}
      footer={
        <div className="flex items-center justify-center gap-1">
          <span>{t.auth.verify.wrongAccount}</span>
          <LogoutButton locale={locale} label={t.nav.logout} />
        </div>
      }
    >
      <div className="space-y-4">
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <p className="text-ink">
          {format(t.auth.verify.body, { email: viewer.email })}
        </p>
        <p className="text-muted">{t.auth.verify.spam}</p>
        <ResendVerificationForm />
      </div>
    </AuthCard>
  );
}
