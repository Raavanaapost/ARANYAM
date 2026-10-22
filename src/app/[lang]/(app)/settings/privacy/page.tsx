import { Download, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeleteAccountForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/frame";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardSection, SectionTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.settings.tabs.privacy };
}

export default async function PrivacySettingsPage() {
  const { locale, t } = await getI18n();
  return (
    <SettingsFrame active="privacy">
      <Card>
        <CardSection className="flex gap-4">
          <ShieldCheck className="mt-1 size-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <SectionTitle className="mb-1">{t.settings.privacyTitle}</SectionTitle>
            <p className="text-muted">{t.settings.privacyBody}</p>
            <Link href={`/${locale}/privacy`} className="mt-2 inline-block font-semibold text-primary hover:underline">
              {t.settings.privacyLink}
            </Link>
          </div>
        </CardSection>
      </Card>

      <Card>
        <CardSection>
          <SectionTitle className="mb-1">{t.settings.exportTitle}</SectionTitle>
          <p className="mb-4 text-muted">{t.settings.exportBody}</p>
          <a href="/api/export" download className={buttonClasses("secondary")}>
            <Download className="size-4" aria-hidden="true" />
            {t.settings.exportButton}
          </a>
        </CardSection>
      </Card>

      <Card className="border-danger/40">
        <CardSection>
          <h2 className="mb-1 text-lg text-danger">{t.settings.deleteTitle}</h2>
          <p className="mb-5 text-muted">{t.settings.deleteBody}</p>
          <Suspense fallback={<Skeleton className="h-36 w-full" />}>
            <DeleteAccount />
          </Suspense>
        </CardSection>
      </Card>
    </SettingsFrame>
  );
}

async function DeleteAccount() {
  const viewer = await requireUser();
  return <DeleteAccountForm email={viewer.email} />;
}
