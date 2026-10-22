import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forms";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.forgot.title };
}

export default async function ForgotPasswordPage() {
  const { locale, t } = await getI18n();
  return (
    <AuthCard
      title={t.auth.forgot.title}
      subtitle={t.auth.forgot.subtitle}
      footer={
        <Link href={`/${locale}/login`} className="font-semibold text-primary hover:underline">
          {t.auth.forgot.backToLogin}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
