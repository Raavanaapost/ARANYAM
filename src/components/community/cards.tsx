import { CalendarDays, Lock, MapPin, MessageCircle, Monitor, UsersRound } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format, formatDate, formatTime, plural } from "@/i18n/format";
import { removeContentAction } from "@/lib/actions/moderation";
import { deletePostAction } from "@/lib/actions/posts";
import { cn } from "@/lib/cn";
import type { PostKind } from "@/lib/constants";
import { env } from "@/lib/env";
import type { ArticleListItem } from "@/lib/services/articles";
import type { EventListItem } from "@/lib/services/events";
import type { GroupSummary } from "@/lib/services/groups";
import type { PostView } from "@/lib/services/posts";
import { AuthorLine, Dot, GroupIcon, RelativeTime, RichText } from "./basics";
import { ItemMenu, ReactionBar, type MenuCommand } from "./interactive";

/** Links inside a card whose title link covers the whole card. */
const aboveCardLink = "relative z-10";

export function GroupChip({ group, locale }: { group: { id: string; name: string; icon: string }; locale: Locale }) {
  return (
    <Link
      href={`/${locale}/groups/${group.id}`}
      className={cn(
        aboveCardLink,
        "inline-flex max-w-full items-center gap-1 truncate rounded-full bg-sunken px-2.5 py-0.5 text-[0.8rem] font-semibold text-muted hover:text-ink",
      )}
    >
      <span aria-hidden="true">{group.icon}</span>
      <span className="truncate">{group.name}</span>
    </Link>
  );
}

/* --------------------------------- Posts -------------------------------- */

const kindTones: Record<PostKind, BadgeTone> = {
  thought: "neutral",
  question: "info",
  celebration: "accent",
  tip: "primary",
};

/** Long posts are shortened in lists; the full text is on the post's own page. */
const LONG_POST = 700;

export function PostCard({
  post,
  locale,
  t,
  showGroup = true,
  standalone = false,
}: {
  post: PostView;
  locale: Locale;
  t: Dictionary;
  showGroup?: boolean;
  /** True on the post's own page: full text, no link to itself. */
  standalone?: boolean;
}) {
  const href = `/${locale}/posts/${post.id}`;
  const shortened = !standalone && post.body.length > LONG_POST;
  const menuRemove: MenuCommand | undefined = post.canDelete
    ? {
        action: deletePostAction,
        fields: { id: post.id, from: standalone ? "post" : "list" },
        confirm: t.posts.deleteConfirm,
        label: t.common.delete,
      }
    : post.canRemove
      ? {
          action: removeContentAction,
          // On the post's own page there is nothing left to show afterwards.
          fields: standalone ? { type: "post", id: post.id, next: "/feed" } : { type: "post", id: post.id },
          confirm: t.common.removeConfirm,
          label: t.common.remove,
        }
      : undefined;

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:p-6" data-testid="post">
      {post.removed ? (
        <Alert tone="warning" className="mb-4">
          {t.posts.removedNotice}
        </Alert>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <AuthorLine
          author={post.author}
          isMine={post.isMine}
          locale={locale}
          t={t}
          meta={
            <>
              {standalone ? (
                <RelativeTime date={post.createdAt} locale={locale} t={t} />
              ) : (
                <Link href={href} className="hover:underline">
                  <RelativeTime date={post.createdAt} locale={locale} t={t} />
                </Link>
              )}
              {post.editedAt ? (
                <>
                  <Dot />
                  <span>{t.common.edited}</span>
                </>
              ) : null}
              {showGroup && post.group ? (
                <>
                  <Dot />
                  <Link href={`/${locale}/groups/${post.group.id}`} className="font-medium hover:underline">
                    {format(t.posts.inGroup, { group: `${post.group.icon} ${post.group.name}` })}
                  </Link>
                </>
              ) : null}
            </>
          }
        />
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={kindTones[post.kind]}>{t.posts.kinds[post.kind]}</Badge>
          <ItemMenu
            editHref={post.canEdit ? `${href}/edit` : undefined}
            remove={menuRemove}
            report={post.isMine || post.removed ? undefined : { targetType: "post", targetId: post.id }}
          />
        </div>
      </div>

      <RichText
        text={post.body}
        className={cn("mt-4 text-[1.02rem] leading-relaxed text-ink", shortened && "line-clamp-[12]")}
      />
      {shortened ? (
        <Link href={href} className="mt-2 inline-block font-semibold text-primary hover:underline">
          {t.posts.viewPost}
        </Link>
      ) : null}

      {post.removed ? null : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <ReactionBar id={post.id} target="post" reactions={post.reactions} />
          {standalone ? null : (
            <Link
              href={`${href}#comments`}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-muted hover:text-ink"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {post.commentCount ? plural(locale, post.commentCount, t.posts.comments) : t.comments.submit}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

/* ---------------------------- Blogs and news ---------------------------- */

export function articlePath(locale: Locale, article: { id: string; type: "blog" | "news" }) {
  return `/${locale}/${article.type === "news" ? "news" : "blogs"}/${article.id}`;
}

export function ArticleCard({ article, locale, t }: { article: ArticleListItem; locale: Locale; t: Dictionary }) {
  const href = articlePath(locale, article);
  const date = article.publishedAt ?? article.updatedAt;
  const listPath = article.type === "news" ? "news" : "blogs";
  // News has no author line for visitors; blogs always show one, even if it is "A parent".
  const showAuthor = article.type === "blog" || article.author !== null;
  return (
    <article
      className="relative h-full rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong sm:p-6"
      data-testid="article"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        {article.status === "draft" ? <Badge tone="warning">{t.blogs.draft}</Badge> : null}
        {article.type === "news" && article.visibility === "public" ? <Badge tone="info">{t.common.public}</Badge> : null}
        <time dateTime={date.toISOString()}>{formatDate(date, locale, env.timezone)}</time>
        <Dot />
        <span>{format(t.common.minutesRead, { count: article.readingMinutes })}</span>
      </div>
      <h2 className="mt-2 text-xl text-ink">
        <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl hover:underline">
          {article.title}
        </Link>
      </h2>
      {article.summary ? <p className="mt-1.5 line-clamp-3 text-muted">{article.summary}</p> : null}
      {article.tags.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {article.tags.map((tag) => (
            <li key={tag}>
              <Link
                href={`/${locale}/${listPath}?tag=${encodeURIComponent(tag)}`}
                className={cn(
                  aboveCardLink,
                  "inline-block rounded-full bg-sunken px-2.5 py-0.5 text-[0.8rem] font-semibold text-muted hover:text-ink",
                )}
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {showAuthor || article.commentCount ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          {showAuthor ? (
            <div className={aboveCardLink}>
              <AuthorLine author={article.author} isMine={article.isMine} locale={locale} t={t} size="sm" />
            </div>
          ) : (
            <span />
          )}
          {article.commentCount ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-muted">
              <MessageCircle className="size-4" aria-hidden="true" />
              {plural(locale, article.commentCount, t.posts.comments)}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/* -------------------------------- Events -------------------------------- */

/** The month and day on a small calendar leaf. */
export function DateTile({ date, locale, className }: { date: Date; locale: Locale; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft py-2 text-accent",
        className,
      )}
    >
      <span className="text-xs font-bold uppercase">{formatDate(date, locale, env.timezone, { month: "short" })}</span>
      <span className="font-display text-2xl leading-tight font-bold">
        {formatDate(date, locale, env.timezone, { day: "numeric" })}
      </span>
    </div>
  );
}

/** "Saturday, 8 November 2026, 10:30 am – 1:00 pm" on the community clock. */
export function eventWhen(event: { startsAt: Date; endsAt: Date | null }, locale: Locale, short = false) {
  const zone = env.timezone;
  const start = short
    ? formatDate(event.startsAt, locale, zone, { weekday: "short", hour: "numeric", minute: "2-digit" })
    : formatDate(event.startsAt, locale, zone, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  if (!event.endsAt) return start;
  const sameDay =
    formatDate(event.startsAt, "en", zone, { dateStyle: "short" }) ===
    formatDate(event.endsAt, "en", zone, { dateStyle: "short" });
  const end = sameDay
    ? formatTime(event.endsAt, locale, zone)
    : formatDate(event.endsAt, locale, zone, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return `${start} – ${end}`;
}

export function EventCard({ event, locale, t }: { event: EventListItem; locale: Locale; t: Dictionary }) {
  const Place = event.mode === "online" ? Monitor : MapPin;
  return (
    <article
      className={cn(
        "relative flex h-full gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5",
        event.cancelled && "opacity-75",
      )}
      data-testid="event"
    >
      <DateTile date={event.startsAt} locale={locale} />
      <div className="min-w-0 flex-1">
        {event.cancelled || event.myRsvp ? (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {event.cancelled ? <Badge tone="danger">{t.events.cancelled}</Badge> : null}
            {!event.cancelled && event.myRsvp === "going" ? (
              <Badge tone="primary">{event.isMine ? t.events.organiser : t.events.youAreGoing}</Badge>
            ) : null}
            {!event.cancelled && event.myRsvp === "interested" ? (
              <Badge tone="info">{t.events.youAreInterested}</Badge>
            ) : null}
          </div>
        ) : null}
        <h3 className="text-lg leading-snug text-ink">
          <Link
            href={`/${locale}/events/${event.id}`}
            className={cn("after:absolute after:inset-0 after:rounded-2xl hover:underline", event.cancelled && "line-through")}
          >
            {event.title}
          </Link>
        </h3>
        <ul className="mt-1.5 space-y-1 text-sm text-muted">
          <li className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{eventWhen(event, locale, true)}</span>
          </li>
          <li className="flex items-start gap-2">
            <Place className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{event.mode === "online" ? t.events.online : event.city || t.events.inPerson}</span>
          </li>
          <li className="flex items-start gap-2">
            <UsersRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{plural(locale, event.goingCount, t.events.goingCount)}</span>
          </li>
        </ul>
        {event.group ? (
          <div className="mt-2.5">
            <GroupChip group={event.group} locale={locale} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** A compact event row for side panels. */
export function EventRow({ event, locale, t }: { event: EventListItem; locale: Locale; t: Dictionary }) {
  return (
    <div className="relative flex items-center gap-3">
      <DateTile date={event.startsAt} locale={locale} className="w-12 py-1 [&>span:last-child]:text-lg" />
      <div className="min-w-0">
        <Link
          href={`/${locale}/events/${event.id}`}
          className="line-clamp-2 font-semibold leading-snug text-ink after:absolute after:inset-0 hover:underline"
        >
          {event.title}
        </Link>
        <p className="truncate text-sm text-muted">
          {event.cancelled ? t.events.cancelled : event.mode === "online" ? t.events.online : event.city || t.events.inPerson}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------- Groups -------------------------------- */

export function GroupCard({ group, locale, t }: { group: GroupSummary; locale: Locale; t: Dictionary }) {
  return (
    <article
      className="relative flex h-full gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
      data-testid="group"
    >
      <GroupIcon icon={group.icon} color={group.color} />
      <div className="min-w-0 flex-1">
        <h3 className="text-lg leading-snug text-ink">
          <Link
            href={`/${locale}/groups/${group.id}`}
            className="after:absolute after:inset-0 after:rounded-2xl hover:underline"
          >
            {group.name}
          </Link>
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          {group.privacy !== "open" ? <Lock className="size-3.5" aria-hidden="true" /> : null}
          <span>{t.groups.privacy[group.privacy]}</span>
          <Dot />
          <span>{plural(locale, group.memberCount, t.groups.members)}</span>
        </p>
        {group.description ? <p className="mt-2 line-clamp-2 text-[0.95rem] text-muted">{group.description}</p> : null}
        {group.myStatus === "pending" ? (
          <Badge tone="warning" className="mt-3">
            {t.groups.requested}
          </Badge>
        ) : group.myRole && group.myRole !== "member" ? (
          <Badge tone="primary" className="mt-3">
            {t.groups.roles[group.myRole]}
          </Badge>
        ) : null}
      </div>
    </article>
  );
}

