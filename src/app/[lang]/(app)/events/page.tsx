import { CalendarDays, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LinkTabs } from "@/components/community/basics";
import { EventCard } from "@/components/community/cards";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireMember } from "@/lib/auth/dal";
import { pickParam } from "@/lib/params";
import { listEvents, type EventScope } from "@/lib/services/events";

const SCOPES = ["upcoming", "going", "past"] as const satisfies readonly EventScope[];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.events.title };
}

export default async function EventsPage({ searchParams }: PageProps<"/[lang]/events">) {
  const { locale, t } = await getI18n();
  return (
    <>
      <PageHeader
        title={t.events.title}
        subtitle={t.events.subtitle}
        actions={
          <ButtonLink href={`/${locale}/events/new`}>
            <Plus className="size-4" aria-hidden="true" />
            {t.events.create}
          </ButtonLink>
        }
      />
      <Suspense fallback={<EventsSkeleton />}>
        <Events searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Events({ searchParams }: Pick<PageProps<"/[lang]/events">, "searchParams">) {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const scope = pickParam((await searchParams).tab, SCOPES) ?? "upcoming";
  const events = await listEvents(viewer, { scope });
  const labels = { upcoming: t.events.upcoming, going: t.events.going, past: t.events.past };
  const empty = { upcoming: t.events.emptyUpcoming, going: t.events.emptyGoing, past: t.events.emptyPast };

  return (
    <div className="space-y-6">
      <LinkTabs
        label={t.events.tabsLabel}
        items={SCOPES.map((name) => ({
          href: name === "upcoming" ? `/${locale}/events` : `/${locale}/events?tab=${name}`,
          label: labels[name],
          active: scope === name,
        }))}
      />
      {events.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<CalendarDays className="size-8" aria-hidden="true" />} title={empty[scope]}>
          {scope === "past" ? null : (
            <ButtonLink href={`/${locale}/events/new`} variant="soft" size="sm">
              {t.events.create}
            </ButtonLink>
          )}
        </EmptyState>
      )}
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-11 w-72 max-w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
