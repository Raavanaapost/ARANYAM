import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard, AuthFormSkeleton } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/alert";
import { getI18n } from "@/i18n/server";
import { getViewer } from "@/lib/auth/dal";
import { firstParam, safeNextPath } from "@/lib/params";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.login.submit };
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const { locale, t } = await getI18n();
  return (
    <AuthCard
      title={t.auth.login.title}
      subtitle={t.auth.login.subtitle}
      footer={
        <>
          {t.auth.login.noAccount}{" "}
          <Link href={`/${locale}/register`} className="font-semibold text-primary hover:underline">
            {t.auth.login.registerLink}
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton fields={2} />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/[lang]/login">, "searchParams">) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));

  if (await getViewer()) redirect(`/${locale}${next ?? "/feed"}`);

  let notice = null;
  if (firstParam(params.verified)) {
    notice = <Alert tone="success">{t.auth.login.verifiedNotice}</Alert>;
  } else if (firstParam(params.verify) === "invalid") {
    notice = (
      <Alert tone="danger" title={t.auth.verify.invalidTitle}>
        {t.auth.verify.invalidBody}
      </Alert>
    );
  } else if (firstParam(params.reset)) {
    notice = <Alert tone="success">{t.auth.login.resetNotice}</Alert>;
  } else if (firstParam(params.loggedout)) {
    notice = <Alert tone="info">{t.auth.login.loggedOutNotice}</Alert>;
  } else if (next) {
    notice = <Alert tone="info">{t.auth.login.membersOnlyNotice}</Alert>;
  }

  return (
    <>
      {notice ? <div className="mb-5">{notice}</div> : null}
      <LoginForm next={next} />
    </>
  );
}
