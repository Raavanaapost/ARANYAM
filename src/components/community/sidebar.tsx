import { HeartHandshake } from "lucide-react";
import Link from "next/link";
import { Card, CardSection, SectionTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDate } from "@/i18n/format";
import type { Viewer } from "@/lib/auth/viewer";
import { env } from "@/lib/env";
import { listArticles } from "@/lib/services/articles";
import { listUpcomingForSidebar } from "@/lib/services/events";
import { listMyGroups } from "@/lib/services/groups";
import { GroupIcon } from "./basics";
import { EventRow } from "./cards";

function SeeAll({ href, t }: { href: string; t: Dictionary }) {
  return (
    <Link href={href} className="text-sm font-semibold text-primary hover:underline">
      {t.common.seeAll}
    </Link>
  );
}

/** The gentle reminder about children's privacy, shown next to places where people write. */
export function PrivacyReminder({ t }: { t: Dictionary }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-primary-soft p-5">
      <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold text-primary">{t.sidebar.reminderTitle}</p>
        <p className="mt-1 text-[0.95rem] text-ink">{t.posts.privacyReminder}</p>
      </div>
    </div>
  );
}

/** Upcoming events, the member's groups and the latest news, beside the home feed. */
export async function FeedSidebar({ viewer, locale, t }: { viewer: Viewer; locale: Locale; t: Dictionary }) {
  const [events, groups, news] = await Promise.all([
    listUpcomingForSidebar(viewer, 3),
    listMyGroups(viewer),
    listArticles(viewer, { type: "news", limit: 3 }),
  ]);
  const activeGroups = groups.filter((group) => group.myStatus === "active").slice(0, 6);

  return (
    <div className="space-y-5">
      <Card>
        <CardSection>
          <SectionTitle as="h2" action={<SeeAll href={`/${locale}/events`} t={t} />}>
            {t.sidebar.upcomingEvents}
          </SectionTitle>
          {events.length ? (
            <ul className="space-y-3.5">
              {events.map((event) => (
                <li key={event.id}>
                  <EventRow event={event} locale={locale} t={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.95rem] text-muted">{t.sidebar.noEvents}</p>
          )}
        </CardSection>
      </Card>

      <Card>
        <CardSection>
          <SectionTitle as="h2" action={<SeeAll href={`/${locale}/groups`} t={t} />}>
            {t.sidebar.yourGroups}
          </SectionTitle>
          {activeGroups.length ? (
            <ul className="space-y-2">
              {activeGroups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/${locale}/groups/${group.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-sunken"
                  >
                    <GroupIcon icon={group.icon} color={group.color} size="sm" />
                    <span className="truncate font-semibold text-ink">{group.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3">
              <p className="text-[0.95rem] text-muted">{t.sidebar.noGroups}</p>
              <Link href={`/${locale}/groups`} className="text-sm font-semibold text-primary hover:underline">
                {t.sidebar.browseGroups}
              </Link>
            </div>
          )}
        </CardSection>
      </Card>

      <Card>
        <CardSection>
          <SectionTitle as="h2" action={<SeeAll href={`/${locale}/news`} t={t} />}>
            {t.sidebar.latestNews}
          </SectionTitle>
          {news.items.length ? (
            <ul className="space-y-3">
              {news.items.map((item) => (
                <li key={item.id}>
                  <Link href={`/${locale}/news/${item.id}`} className="font-semibold leading-snug text-ink hover:underline">
                    {item.title}
                  </Link>
                  {item.publishedAt ? (
                    <p className="text-sm text-muted">{formatDate(item.publishedAt, locale, env.timezone)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.95rem] text-muted">{t.sidebar.noNews}</p>
          )}
        </CardSection>
      </Card>

      <PrivacyReminder t={t} />
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
    </div>
  );
}
