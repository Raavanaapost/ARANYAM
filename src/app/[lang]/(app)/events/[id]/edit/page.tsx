import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventForm } from "@/components/community/editors";
import { Card, CardSection } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { timeZoneName } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireMember } from "@/lib/auth/dal";
import type { EventFeature } from "@/lib/constants";
import { env } from "@/lib/env";
import { getEditableEvent } from "@/lib/services/events";
import { toZonedParts } from "@/lib/timezone";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.events.formTitleEdit };
}

export default async function EditEventPage({ params }: PageProps<"/[lang]/events/[id]/edit">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={t.events.formTitleEdit} />
      <Card>
        <CardSection>
          <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
            <EditEvent params={params} />
          </Suspense>
        </CardSection>
      </Card>
    </div>
  );
}

async function EditEvent({ params }: Pick<PageProps<"/[lang]/events/[id]/edit">, "params">) {
  const viewer = await requireMember();
  const { locale } = await getI18n();
  const { id } = await params;
  const event = await getEditableEvent(viewer, id);
  if (!event) notFound();
  const start = toZonedParts(event.startsAt, env.timezone);
  const end = event.endsAt ? toZonedParts(event.endsAt, env.timezone) : null;
  return (
    <EventForm
      event={{
        id: event.id,
        title: event.title,
        description: event.description,
        date: start.date,
        start: start.time,
        end: end?.time ?? "",
        mode: event.mode,
        city: event.city,
        venue: event.venue,
        onlineUrl: event.onlineUrl,
        capacity: event.capacity === null ? "" : String(event.capacity),
        features: event.features as EventFeature[],
      }}
      groups={[]}
      zoneName={timeZoneName(env.timezone, locale)}
      cancelHref={`/${locale}/events/${event.id}`}
    />
  );
}
