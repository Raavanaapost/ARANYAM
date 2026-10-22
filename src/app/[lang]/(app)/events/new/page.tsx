import type { Metadata } from "next";
import { Suspense } from "react";
import { EventForm } from "@/components/community/editors";
import { PrivacyReminder } from "@/components/community/sidebar";
import { Card, CardSection } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { timeZoneName } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireMember } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { firstParam } from "@/lib/params";
import { listPostableGroups } from "@/lib/services/groups";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.events.formTitleNew };
}

export default async function NewEventPage({ searchParams }: PageProps<"/[lang]/events/new">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageHeader title={t.events.formTitleNew} subtitle={t.events.subtitle} className="mb-0" />
      <PrivacyReminder t={t} />
      <Card>
        <CardSection>
          <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
            <NewEvent searchParams={searchParams} />
          </Suspense>
        </CardSection>
      </Card>
    </div>
  );
}

async function NewEvent({ searchParams }: Pick<PageProps<"/[lang]/events/new">, "searchParams">) {
  const viewer = await requireMember();
  const { locale } = await getI18n();
  const groups = await listPostableGroups(viewer);
  const requested = firstParam((await searchParams).group);
  const defaultGroupId = groups.some((group) => group.id === requested) ? requested : undefined;
  return (
    <EventForm
      groups={groups}
      defaultGroupId={defaultGroupId}
      zoneName={timeZoneName(env.timezone, locale)}
      cancelHref={defaultGroupId ? `/${locale}/groups/${defaultGroupId}?tab=events` : `/${locale}/events`}
    />
  );
}
