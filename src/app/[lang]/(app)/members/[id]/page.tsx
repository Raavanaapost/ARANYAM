import { CalendarHeart, MapPin, Pencil } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LinkTabs, RichText } from "@/components/community/basics";
import { ArticleCard, PostCard } from "@/components/community/cards";
import { ItemMenu } from "@/components/community/interactive";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { EmptyState, ListSkeleton, Skeleton } from "@/components/ui/misc";
import { format, formatDate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireMember } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { pickParam } from "@/lib/params";
import { listArticles } from "@/lib/services/articles";
import { getMemberProfile } from "@/lib/services/members";
import { listPosts } from "@/lib/services/posts";

const TABS = ["posts", "blogs"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.profile };
}

export default function MemberPage({ params, searchParams }: PageProps<"/[lang]/members/[id]">) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense
        fallback={
          <div className="space-y-6" aria-busy="true">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <ListSkeleton rows={2} />
          </div>
        }
      >
        <Member params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Member({ params, searchParams }: PageProps<"/[lang]/members/[id]">) {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const { id } = await params;
  const profile = await getMemberProfile(viewer, id);
  if (!profile) notFound();
  const tab = pickParam((await searchParams).tab, TABS) ?? "posts";
  const isSelf = profile.id === viewer.id;
  const base = `/${locale}/members/${profile.id}`;
  const [posts, blogs] = await Promise.all([
    tab === "posts" ? listPosts(viewer, { authorId: profile.id, limit: 20 }) : null,
    tab === "blogs" ? listArticles(viewer, { type: "blog", authorId: profile.id }) : null,
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardSection className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={profile.displayName} hue={profile.avatarHue} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl text-ink sm:text-3xl">{profile.displayName}</h1>
              {profile.role !== "member" ? <Badge tone="primary">{t.profile.roles[profile.role]}</Badge> : null}
            </div>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-muted">
              {profile.location ? (
                <li className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {profile.location}
                </li>
              ) : null}
              <li className="flex items-center gap-1.5">
                <CalendarHeart className="size-4" aria-hidden="true" />
                {format(t.profile.joined, { date: formatDate(profile.joinedAt, locale, env.timezone, { month: "long", year: "numeric" }) })}
              </li>
            </ul>
            <div className="mt-4">
              <h2 className="sr-only">{t.profile.aboutTitle}</h2>
              {profile.bio ? (
                <RichText text={profile.bio} className="text-ink" />
              ) : (
                <p className="text-muted">{t.profile.noBio}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {isSelf ? (
              <ButtonLink href={`/${locale}/settings`} variant="secondary" size="sm">
                <Pencil className="size-4" aria-hidden="true" />
                {t.profile.editProfile}
              </ButtonLink>
            ) : (
              <ItemMenu report={{ targetType: "user", targetId: profile.id }} />
            )}
          </div>
        </CardSection>
      </Card>

      <LinkTabs
        label={t.nav.profile}
        items={[
          { href: base, label: t.profile.posts, active: tab === "posts" },
          { href: `${base}?tab=blogs`, label: t.profile.blogs, active: tab === "blogs" },
        ]}
      />
      {isSelf ? <p className="text-sm text-muted">{t.profile.postsHint}</p> : null}

      {posts ? (
        posts.items.length ? (
          <ul className="space-y-4">
            {posts.items.map((post) => (
              <li key={post.id}>
                <PostCard post={post} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t.profile.emptyPosts} />
        )
      ) : null}

      {blogs ? (
        blogs.items.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {blogs.items.map((article) => (
              <li key={article.id}>
                <ArticleCard article={article} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t.profile.emptyBlogs} />
        )
      ) : null}
    </div>
  );
}
