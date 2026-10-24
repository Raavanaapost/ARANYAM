import { BookOpen, ExternalLink, Newspaper, PenLine, Plus } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSlides } from "@/components/page-slides";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { EmptyState, ListSkeleton, PageHeader, Skeleton } from "@/components/ui/misc";
import type { Dictionary } from "@/i18n/dictionaries";
import { format, formatDate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { deleteArticleAction } from "@/lib/actions/articles";
import { removeContentAction } from "@/lib/actions/moderation";
import { getViewer, requireMember } from "@/lib/auth/dal";
import { isActiveMember, type Viewer } from "@/lib/auth/viewer";
import type { ArticleType } from "@/lib/constants";
import { env } from "@/lib/env";
import { dateParam, firstParam, queryString, type SearchParams } from "@/lib/params";
import {
  canWrite,
  getArticle,
  getEditableArticle,
  listArticles,
  listOwnArticles,
  listPopularTags,
} from "@/lib/services/articles";
import { AuthorLine, Chips, Dot, LinkTabs } from "./basics";
import { ArticleCard, articlePath } from "./cards";
import { CommentSection } from "./comments";
import { ArticleEditor } from "./editors";
import { ItemMenu, ReactionBar, type MenuCommand } from "./interactive";
import { Markdown } from "./markdown";
import { PrivacyReminder } from "./sidebar";

/*
 * Blogs and news share their screens. Blogs are written by any member and
 * read only by members. News is written by moderators, and items marked
 * public can also be read by visitors (without author names).
 */

const section = (type: ArticleType) => (type === "news" ? "news" : "blogs");

function strings(t: Dictionary, type: ArticleType) {
  return type === "news"
    ? { title: t.news.title, subtitle: t.news.subtitle, write: t.news.add, empty: t.news.empty }
    : { title: t.blogs.title, subtitle: t.blogs.subtitle, write: t.blogs.write, empty: t.blogs.empty };
}

/** Members read blogs; anyone may read public news. */
async function readerFor(type: ArticleType): Promise<Viewer | null> {
  return type === "blog" ? requireMember() : getViewer();
}

/* --------------------------------- Lists -------------------------------- */

export async function ArticleListPage({ type, searchParams }: { type: ArticleType; searchParams: Promise<SearchParams> }) {
  const { t } = await getI18n();
  const text = strings(t, type);
  return (
    <>
      <PageSlides page={type === "news" ? "news" : "blogs"} className="mb-8" />
      <PageHeader
        title={text.title}
        subtitle={text.subtitle}
        actions={
          <Suspense fallback={null}>
            <WriteButton type={type} />
          </Suspense>
        }
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <ArticleList type={type} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function WriteButton({ type }: { type: ArticleType }) {
  const viewer = await getViewer();
  if (!isActiveMember(viewer) || !canWrite(viewer, type)) return null;
  const { locale, t } = await getI18n();
  return (
    <ButtonLink href={`/${locale}/${section(type)}/new`}>
      {type === "news" ? <Plus className="size-4" aria-hidden="true" /> : <PenLine className="size-4" aria-hidden="true" />}
      {strings(t, type).write}
    </ButtonLink>
  );
}

async function ArticleList({ type, searchParams }: { type: ArticleType; searchParams: Promise<SearchParams> }) {
  const viewer = await readerFor(type);
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const base = `/${locale}/${section(type)}`;
  const member = isActiveMember(viewer);
  const showMine = member && type === "blog" && firstParam(params.view) === "mine";
  const tag = firstParam(params.tag)?.trim().toLowerCase().slice(0, 30) || undefined;
  const before = dateParam(params.before);

  const [list, tags] = await Promise.all([
    showMine && viewer
      ? listOwnArticles(viewer, type).then((items) => ({ items, hasMore: false }))
      : listArticles(viewer, { type, tag, before }),
    member && !showMine ? listPopularTags(type) : Promise.resolve([]),
  ]);
  const last = list.items.at(-1);

  return (
    <div className="space-y-6">
      {member ? null : (
        <Alert tone="info">
          {t.news.guestNotice}{" "}
          <Link href={`/${locale}/register`} className="font-semibold text-primary underline">
            {t.nav.join}
          </Link>
        </Alert>
      )}

      {member && type === "blog" ? (
        <LinkTabs
          label={t.blogs.title}
          items={[
            { href: base, label: t.blogs.all, active: !showMine },
            { href: `${base}?view=mine`, label: t.blogs.myBlogs, active: showMine },
          ]}
        />
      ) : null}

      {tags.length ? (
        <Chips
          label={t.blogs.tagsLabel}
          items={[
            { href: base, label: t.posts.filterAll, active: !tag },
            ...tags.map((name) => ({ href: `${base}?tag=${encodeURIComponent(name)}`, label: `#${name}`, active: tag === name })),
          ]}
        />
      ) : null}

      {tag && !tags.includes(tag) ? (
        <p className="flex items-center gap-3 text-muted">
          {format(t.blogs.filterByTopic, { tag: `#${tag}` })}
          <Link href={base} className="font-semibold text-primary hover:underline">
            {t.blogs.clearFilter}
          </Link>
        </p>
      ) : null}

      {before ? (
        <Link href={`${base}${queryString({ tag })}`} className="inline-block font-semibold text-primary hover:underline">
          ← {t.common.backToLatest}
        </Link>
      ) : null}

      {list.items.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.items.map((article) => (
            <li key={article.id}>
              <ArticleCard article={article} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={
            type === "news" ? (
              <Newspaper className="size-8" aria-hidden="true" />
            ) : (
              <BookOpen className="size-8" aria-hidden="true" />
            )
          }
          title={showMine ? t.blogs.emptyMine : strings(t, type).empty}
        >
          {type === "blog" ? (
            <ButtonLink href={`${base}/new`} variant="soft" size="sm">
              {t.blogs.write}
            </ButtonLink>
          ) : null}
        </EmptyState>
      )}

      {list.hasMore && last?.publishedAt ? (
        <div className="flex justify-center">
          <ButtonLink href={`${base}${queryString({ tag, before: last.publishedAt.toISOString() })}`} variant="secondary">
            {t.common.showOlder}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------- Reading ------------------------------- */

export async function ArticleDetailPage({ type, params }: { type: ArticleType; params: Promise<{ id: string }> }) {
  const { locale, t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href={`/${locale}/${section(type)}`} className="mb-4 inline-block font-semibold text-primary hover:underline">
        ← {strings(t, type).title}
      </Link>
      <Suspense fallback={<ArticleSkeleton />}>
        <ArticleDetail type={type} params={params} />
      </Suspense>
    </div>
  );
}

async function ArticleDetail({ type, params }: { type: ArticleType; params: Promise<{ id: string }> }) {
  const viewer = await readerFor(type);
  const { locale, t } = await getI18n();
  const { id } = await params;
  const article = await getArticle(viewer, id);
  if (!article) notFound();
  // Old links (for example from reports) may point at the wrong section.
  if (article.type !== type) redirect(articlePath(locale, article));

  const member = isActiveMember(viewer);
  const published = article.status === "published";
  const date = article.publishedAt ?? article.updatedAt;
  const listHref = `/${locale}/${section(type)}`;
  const remove: MenuCommand | undefined = article.canEdit
    ? {
        action: deleteArticleAction,
        fields: { id: article.id },
        confirm: type === "news" ? t.news.deleteConfirm : t.blogs.deleteConfirm,
        label: t.common.delete,
      }
    : article.canRemove
      ? {
          action: removeContentAction,
          fields: { type: "article", id: article.id, next: `/${section(type)}` },
          confirm: t.common.removeConfirm,
          label: t.common.remove,
        }
      : undefined;

  return (
    <div className="space-y-6">
      {article.removed ? <Alert tone="warning">{t.common.removedNotice}</Alert> : null}
      {!published ? <Alert tone="info">{t.common.draftNotice}</Alert> : null}

      <article className="rounded-2xl border border-line bg-surface p-6 sm:p-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {!published ? <Badge tone="warning">{t.blogs.draft}</Badge> : null}
            {type === "news" && article.visibility === "public" ? <Badge tone="info">{t.common.public}</Badge> : null}
            <time dateTime={date.toISOString()}>{formatDate(date, locale, env.timezone, { dateStyle: "long" })}</time>
            <Dot />
            <span>{format(t.common.minutesRead, { count: article.readingMinutes })}</span>
          </div>
          {member ? (
            <ItemMenu
              editHref={article.canEdit ? `${articlePath(locale, article)}/edit` : undefined}
              remove={remove}
              report={article.isMine || !published ? undefined : { targetType: "article", targetId: article.id }}
            />
          ) : null}
        </div>

        <h1 className="mt-3 text-3xl text-ink sm:text-4xl">{article.title}</h1>
        {article.summary ? <p className="mt-3 text-lg text-muted">{article.summary}</p> : null}

        {type === "blog" || article.author ? (
          <div className="mt-6 border-y border-line py-4">
            <AuthorLine author={article.author} isMine={article.isMine} locale={locale} t={t} />
          </div>
        ) : null}

        <Markdown className="mt-6">{article.body}</Markdown>

        {article.sourceUrl ? (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {t.news.readSource}
          </a>
        ) : null}

        {article.tags.length ? (
          <ul className="mt-6 flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`${listHref}?tag=${encodeURIComponent(tag)}`}
                  className="inline-block rounded-full bg-sunken px-2.5 py-0.5 text-[0.85rem] font-semibold text-muted hover:text-ink"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {member && published && !article.removed ? (
          <div className="mt-8 border-t border-line pt-5">
            <ReactionBar id={article.id} target="article" reactions={article.reactions} />
          </div>
        ) : null}
      </article>

      {member && viewer && published && !article.removed ? (
        <Card>
          <CardSection>
            <CommentSection viewer={viewer} target={{ type: "article", id: article.id }} locale={locale} t={t} />
          </CardSection>
        </Card>
      ) : null}

      {member ? null : (
        <Alert tone="info">
          {t.news.guestNotice}{" "}
          <Link href={`/${locale}/register`} className="font-semibold text-primary underline">
            {t.nav.join}
          </Link>
        </Alert>
      )}
    </div>
  );
}

function ArticleSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-6 sm:p-10" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-4/5" />
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="mt-6 h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

/* -------------------------------- Writing ------------------------------- */

export async function ArticleEditorPage({ type, params }: { type: ArticleType; params?: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const title = params
    ? type === "news"
      ? t.news.editorTitleEdit
      : t.blogs.editorTitleEdit
    : type === "news"
      ? t.news.editorTitleNew
      : t.blogs.editorTitleNew;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageHeader title={title} className="mb-0" />
      {type === "blog" ? <PrivacyReminder t={t} /> : null}
      <Card>
        <CardSection>
          <Suspense fallback={<Skeleton className="h-[36rem] w-full" />}>
            <ArticleEditorLoader type={type} params={params} />
          </Suspense>
        </CardSection>
      </Card>
    </div>
  );
}

async function ArticleEditorLoader({ type, params }: { type: ArticleType; params?: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { locale } = await getI18n();
  const listHref = `/${locale}/${section(type)}`;
  if (!params) {
    if (!canWrite(viewer, type)) notFound();
    return <ArticleEditor type={type} cancelHref={listHref} />;
  }
  const { id } = await params;
  const article = await getEditableArticle(viewer, id);
  if (!article || article.type !== type) notFound();
  return (
    <ArticleEditor
      type={type}
      cancelHref={articlePath(locale, article)}
      article={{
        id: article.id,
        title: article.title,
        summary: article.summary,
        body: article.body,
        tags: article.tags.join(", "),
        visibility: article.visibility,
        isAnonymous: article.isAnonymous,
        sourceUrl: article.sourceUrl,
        status: article.status,
      }}
    />
  );
}
