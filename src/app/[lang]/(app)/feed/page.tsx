import { Leaf } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Chips } from "@/components/community/basics";
import { PostCard } from "@/components/community/cards";
import { Composer } from "@/components/community/interactive";
import { FeedSidebar, SidebarSkeleton } from "@/components/community/sidebar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { EmptyState, ListSkeleton, Skeleton } from "@/components/ui/misc";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireMember } from "@/lib/auth/dal";
import { POST_KINDS } from "@/lib/constants";
import { dateParam, pickParam, queryString } from "@/lib/params";
import { listPostableGroups } from "@/lib/services/groups";
import { listPosts } from "@/lib/services/posts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.home };
}

export default async function FeedPage({ searchParams }: PageProps<"/[lang]/feed">) {
  const { t } = await getI18n();
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Suspense fallback={<FeedSkeleton />}>
        <Feed searchParams={searchParams} />
      </Suspense>
      <aside aria-label={t.sidebar.label} className="hidden lg:block">
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      </aside>
    </div>
  );
}

async function Feed({ searchParams }: Pick<PageProps<"/[lang]/feed">, "searchParams">) {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const kind = pickParam(params.kind, POST_KINDS);
  const before = dateParam(params.before);
  const [{ items, hasMore }, groups] = await Promise.all([
    listPosts(viewer, { kind, before }),
    listPostableGroups(viewer),
  ]);
  const firstName = viewer.displayName.trim().split(/\s+/)[0];
  const feedHref = (options: { kind?: string; before?: string }) => `/${locale}/feed${queryString(options)}`;
  const last = items.at(-1);

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">{format(t.feed.greeting, { name: firstName })}</h1>
        <p className="mt-1 text-muted">{t.feed.subtitle}</p>
      </div>

      <Card>
        <CardSection>
          <Composer groups={groups} />
        </CardSection>
      </Card>

      <Chips
        label={t.feed.filterLabel}
        items={[
          { href: feedHref({}), label: t.posts.filterAll, active: !kind },
          ...POST_KINDS.map((option) => ({
            href: feedHref({ kind: option }),
            label: t.posts.kinds[option],
            active: kind === option,
          })),
        ]}
      />

      {before ? (
        <Link href={feedHref({ kind })} className="inline-block font-semibold text-primary hover:underline">
          ← {t.common.backToLatest}
        </Link>
      ) : null}

      {items.length ? (
        <ul className="space-y-4">
          {items.map((post) => (
            <li key={post.id}>
              <PostCard post={post} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Leaf className="size-8" aria-hidden="true" />} title={t.posts.empty} />
      )}

      {hasMore && last ? (
        <div className="flex justify-center">
          <ButtonLink href={feedHref({ kind, before: last.createdAt.toISOString() })} variant="secondary">
            {t.common.showOlder}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

async function Sidebar() {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  return <FeedSidebar viewer={viewer} locale={locale} t={t} />;
}

function FeedSkeleton() {
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-52 w-full rounded-2xl" />
      <ListSkeleton rows={3} />
    </div>
  );
}
