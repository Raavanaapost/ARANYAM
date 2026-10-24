import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard, AuthFormSkeleton, firstParam } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/alert";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getViewer } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { findUsableInvite } from "@/lib/services/accounts";
import { socialError } from "@/lib/social-errors";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.register.title };
}

export default async function RegisterPage({ searchParams }: PageProps<"/[lang]/register">) {
  const { locale, t } = await getI18n();
  return (
    <AuthCard
      title={t.auth.register.title}
      subtitle={t.auth.register.subtitle}
      footer={
        <>
          {t.auth.register.haveAccount}{" "}
          <Link href={`/${locale}/login`} className="font-semibold text-primary hover:underline">
            {t.auth.register.loginLink}
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton fields={4} />}>
        <RegisterContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function RegisterContent({ searchParams }: Pick<PageProps<"/[lang]/register">, "searchParams">) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  if (await getViewer()) redirect(`/${locale}/feed`);

  const code = firstParam(params.invite)?.trim().toLowerCase();
  const invite = code ? await findUsableInvite(code) : null;
  const social = socialError(firstParam(params.social), firstParam(params.error));

  return (
    <>
      {social ? (
        <Alert tone={social.key === "cancelled" ? "info" : "warning"} className="mb-6">
          {format(t.auth.social[social.key], { provider: social.provider })}
        </Alert>
      ) : null}
      {invite ? (
        <div className="mb-6 flex gap-3 rounded-2xl bg-primary-soft px-4 py-3.5 text-primary">
          <HeartHandshake className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{format(t.auth.register.invitedBy, { name: invite.inviterName })}</p>
            {env.invitesSkipApproval ? <p className="text-[0.95rem] text-ink">{t.auth.register.invitedSkip}</p> : null}
          </div>
        </div>
      ) : code ? (
        <Alert tone="warning" className="mb-6">
          {t.auth.register.inviteInvalid}
        </Alert>
      ) : null}
      <RegisterForm invite={invite ? invite.invite.code : null} socialProviders={env.socialProviders} />
    </>
  );
}
