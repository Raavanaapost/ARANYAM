import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthCard, AuthCardSkeleton } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/forms";
import { ButtonLink } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { isResetTokenValid } from "@/lib/services/accounts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.reset.title };
}

type Params = PageProps<"/[lang]/reset-password/[token]">["params"];

export default function ResetPasswordPage({ params }: PageProps<"/[lang]/reset-password/[token]">) {
  return (
    <Suspense fallback={<AuthCardSkeleton fields={1} />}>
      <ResetContent params={params} />
    </Suspense>
  );
}

async function ResetContent({ params }: { params: Params }) {
  await connection();
  const { locale, t } = await getI18n();
  const { token } = await params;

  if (!(await isResetTokenValid(token))) {
    return (
      <AuthCard title={t.auth.reset.invalidTitle} subtitle={t.auth.reset.invalidBody}>
        <ButtonLink href={`/${locale}/forgot-password`} className="w-full">
          <LinkIcon className="size-4" aria-hidden="true" />
          {t.auth.reset.requestNew}
        </ButtonLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t.auth.reset.title} subtitle={t.auth.reset.subtitle}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
