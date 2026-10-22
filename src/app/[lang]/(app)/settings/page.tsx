import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/frame";
import { Card, CardSection, SectionTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth/dal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.settings.title };
}

export default function SettingsPage() {
  return (
    <SettingsFrame active="profile">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <Profile />
      </Suspense>
    </SettingsFrame>
  );
}

async function Profile() {
  const viewer = await requireUser();
  const { t } = await getI18n();
  return (
    <Card>
      <CardSection>
        <SectionTitle>{t.settings.profileTitle}</SectionTitle>
        <ProfileForm
          profile={{
            displayName: viewer.displayName,
            bio: viewer.bio,
            location: viewer.location,
            locale: viewer.locale,
          }}
        />
      </CardSection>
    </Card>
  );
}
