import { Plus, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupCard } from "@/components/community/cards";
import { PageSlides } from "@/components/page-slides";
import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { requireMember } from "@/lib/auth/dal";
import { listDiscoverGroups, listMyGroups } from "@/lib/services/groups";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.groups.title };
}

export default async function GroupsPage() {
  const { locale, t } = await getI18n();
  return (
    <>
      <PageSlides page="groups" className="mb-8" />
      <PageHeader
        title={t.groups.title}
        subtitle={t.groups.subtitle}
        actions={
          <ButtonLink href={`/${locale}/groups/new`}>
            <Plus className="size-4" aria-hidden="true" />
            {t.groups.create}
          </ButtonLink>
        }
      />
      <Suspense fallback={<GroupsSkeleton />}>
        <Groups />
      </Suspense>
    </>
  );
}

async function Groups() {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const [mine, discover] = await Promise.all([listMyGroups(viewer), listDiscoverGroups(viewer)]);
  return (
    <div className="space-y-10">
      <section aria-labelledby="my-groups">
        <SectionTitle>
          <span id="my-groups">{t.groups.myGroups}</span>
        </SectionTitle>
        {mine.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {mine.map((group) => (
              <li key={group.id}>
                <GroupCard group={group} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<UsersRound className="size-8" aria-hidden="true" />} title={t.groups.emptyMine} />
        )}
      </section>
      <section aria-labelledby="discover-groups">
        <SectionTitle>
          <span id="discover-groups">{t.groups.discover}</span>
        </SectionTitle>
        {discover.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {discover.map((group) => (
              <li key={group.id}>
                <GroupCard group={group} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.groups.emptyDiscover}</p>
        )}
      </section>
    </div>
  );
}

function GroupsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}
