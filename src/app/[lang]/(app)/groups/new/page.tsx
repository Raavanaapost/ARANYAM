import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupForm } from "@/components/community/editors";
import { MemberOnly } from "@/components/community/gate";
import { Card, CardSection } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.groups.formTitleNew };
}

export default async function NewGroupPage() {
  const { locale, t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={t.groups.formTitleNew} subtitle={t.groups.subtitle} />
      <Card>
        <CardSection>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <MemberOnly>
              <GroupForm cancelHref={`/${locale}/groups`} />
            </MemberOnly>
          </Suspense>
        </CardSection>
      </Card>
    </div>
  );
}
