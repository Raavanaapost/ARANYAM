import { CalendarPlus, Leaf, Lock, Settings2, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, Dot, GroupIcon, LinkTabs, RichText } from "@/components/community/basics";
import { EventCard, PostCard } from "@/components/community/cards";
import { Composer } from "@/components/community/interactive";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { Textarea } from "@/components/ui/field";
import { EmptyState, ListSkeleton, Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format, formatDate, plural } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { joinGroupAction, leaveGroupAction } from "@/lib/actions/groups";
import { requireMember } from "@/lib/auth/dal";
import type { Viewer } from "@/lib/auth/viewer";
import { env } from "@/lib/env";
import { dateParam, pickParam, queryString } from "@/lib/params";
import { listEvents } from "@/lib/services/events";
import { getGroup, listGroupMembers, type GroupDetail } from "@/lib/services/groups";
import { listPosts } from "@/lib/services/posts";

const TABS = ["posts", "events", "members", "about"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.groups.title };
}

export default function GroupPage({ params, searchParams }: PageProps<"/[lang]/groups/[id]">) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Suspense fallback={<GroupSkeleton />}>
        <Group params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Shared = { viewer: Viewer; group: GroupDetail; locale: Locale; t: Dictionary };

async function Group({ params, searchParams }: PageProps<"/[lang]/groups/[id]">) {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const { id } = await params;
  const group = await getGroup(viewer, id);
  if (!group) notFound();
  const query = await searchParams;
  const isMember = group.myStatus === "active";
  const tab: Tab = isMember ? (pickParam(query.tab, TABS) ?? "posts") : "about";
  const base = `/${locale}/groups/${group.id}`;
  const shared = { viewer, group, locale, t };

  return (
    <div className="space-y-6">
      <GroupHeader {...shared} showDescription={tab !== "about"} />
      {isMember ? (
        <LinkTabs
          label={t.groups.title}
          items={TABS.map((name) => ({
            href: name === "posts" ? base : `${base}?tab=${name}`,
            label: t.groups.tabs[name],
            active: tab === name,
          }))}
        />
      ) : (
        <JoinPrompt {...shared} />
      )}
      {tab === "posts" ? <GroupPosts {...shared} before={dateParam(query.before)} /> : null}
      {tab === "events" ? <GroupEvents {...shared} /> : null}
      {tab === "members" ? <GroupMembers {...shared} /> : null}
      {tab === "about" ? <GroupAbout {...shared} /> : null}
    </div>
  );
}

function GroupHeader({ group, locale, t, showDescription }: Shared & { showDescription: boolean }) {
  return (
    <Card>
      <CardSection className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <GroupIcon icon={group.icon} color={group.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl text-ink sm:text-3xl">{group.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-muted">
            {group.privacy !== "open" ? <Lock className="size-4" aria-hidden="true" /> : null}
            <span>{t.groups.privacy[group.privacy]}</span>
            <Dot />
            <span>{plural(locale, group.memberCount, t.groups.members)}</span>
          </p>
          {showDescription && group.description ? (
            <p className="mt-3 line-clamp-3 text-ink">{group.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {group.isGroupAdmin ? (
            <ButtonLink href={`/${locale}/groups/${group.id}/manage`} variant="secondary" size="sm">
              <Settings2 className="size-4" aria-hidden="true" />
              {t.groups.manage}
              {group.pendingCount ? (
                <span className="rounded-full bg-heart px-1.5 text-xs leading-5 font-bold text-white">
                  {group.pendingCount}
                </span>
              ) : null}
            </ButtonLink>
          ) : null}
          {group.myStatus === "active" && !group.isOwner ? (
            <ActionForm action={leaveGroupAction} locale={locale} fields={{ id: group.id }}>
              <SubmitButton variant="ghost" size="sm" confirm={t.groups.leaveConfirm}>
                {t.groups.leave}
              </SubmitButton>
            </ActionForm>
          ) : null}
          {group.myStatus === "active" && group.myRole === "member" ? (
            <Badge tone="primary" className="h-9 px-3.5 text-sm">
              {t.groups.joined}
            </Badge>
          ) : null}
        </div>
      </CardSection>
    </Card>
  );
}

/** What people outside the group see: how to join, or that their request is waiting. */
function JoinPrompt({ group, locale, t }: Shared) {
  return (
    <Card>
      <CardSection className="flex flex-col items-center gap-4 text-center">
        <Lock className="size-8 text-primary" aria-hidden="true" />
        <p className="max-w-lg font-medium text-ink">
          {group.myStatus === "pending"
            ? t.groups.pendingNotice
            : group.privacy === "open"
              ? t.groups.joinToSee
              : t.groups.requestToSee}
        </p>
        {group.myStatus === "pending" ? (
          <ActionForm action={leaveGroupAction} locale={locale} fields={{ id: group.id }}>
            <SubmitButton variant="secondary" size="sm">
              {t.groups.cancelRequest}
            </SubmitButton>
          </ActionForm>
        ) : group.privacy === "open" ? (
          <ActionForm action={joinGroupAction} locale={locale} fields={{ id: group.id }}>
            <SubmitButton pendingLabel={t.common.loading}>
              <UsersRound className="size-4" aria-hidden="true" />
              {t.groups.join}
            </SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm
            action={joinGroupAction}
            locale={locale}
            fields={{ id: group.id }}
            className="w-full max-w-lg space-y-3 text-left"
          >
            <label htmlFor="join-note" className="block font-semibold text-ink">
              {t.groups.requestNoteLabel}
              <span className="ml-1.5 text-sm font-normal text-muted">({t.common.optional})</span>
            </label>
            <Textarea id="join-note" name="note" rows={3} maxLength={500} />
            <div className="flex justify-end">
              <SubmitButton pendingLabel={t.common.loading}>{t.groups.requestJoin}</SubmitButton>
            </div>
          </ActionForm>
        )}
      </CardSection>
    </Card>
  );
}

async function GroupPosts({ viewer, group, locale, t, before }: Shared & { before?: Date }) {
  const { items, hasMore } = await listPosts(viewer, { groupId: group.id, before });
  const base = `/${locale}/groups/${group.id}`;
  const last = items.at(-1);
  return (
    <div className="space-y-5">
      <Card>
        <CardSection>
          <Composer
            groups={[]}
            lockedGroup={{ id: group.id, name: group.name, icon: group.icon }}
            placeholder={format(t.groups.postInGroup, { name: group.name })}
          />
        </CardSection>
      </Card>
      {before ? (
        <Link href={base} className="inline-block font-semibold text-primary hover:underline">
          ← {t.common.backToLatest}
        </Link>
      ) : null}
      {items.length ? (
        <ul className="space-y-4">
          {items.map((post) => (
            <li key={post.id}>
              <PostCard post={post} locale={locale} t={t} showGroup={false} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Leaf className="size-8" aria-hidden="true" />} title={t.groups.postsEmpty} />
      )}
      {hasMore && last ? (
        <div className="flex justify-center">
          <ButtonLink href={`${base}${queryString({ before: last.createdAt.toISOString() })}`} variant="secondary">
            {t.common.showOlder}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

async function GroupEvents({ viewer, group, locale, t }: Shared) {
  const events = await listEvents(viewer, { scope: "upcoming", groupId: group.id });
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <ButtonLink href={`/${locale}/events/new?group=${group.id}`} variant="secondary">
          <CalendarPlus className="size-4" aria-hidden="true" />
          {t.groups.createEventHere}
        </ButtonLink>
      </div>
      {events.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t.groups.eventsEmpty} />
      )}
    </div>
  );
}

async function GroupMembers({ viewer, group, locale, t }: Shared) {
  const members = await listGroupMembers(viewer, group.id);
  return (
    <Card>
      <ul className="divide-y divide-line">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
            <Link href={`/${locale}/members/${member.id}`} className="shrink-0 rounded-full">
              <Avatar name={member.displayName} hue={member.avatarHue} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/${locale}/members/${member.id}`} className="block truncate font-semibold text-ink hover:underline">
                {member.displayName}
                {member.id === viewer.id ? <span className="font-normal text-muted"> ({t.common.you})</span> : null}
              </Link>
              <p className="text-sm text-muted">
                {format(t.groups.memberSince, { date: formatDate(member.joinedAt, locale, env.timezone) })}
              </p>
            </div>
            {member.role !== "member" ? <Badge tone="primary">{t.groups.roles[member.role]}</Badge> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GroupAbout({ group, locale, t }: Shared) {
  return (
    <Card>
      <CardSection className="space-y-5">
        <h2 className="text-xl text-ink">{t.groups.tabs.about}</h2>
        {group.description ? <RichText text={group.description} className="text-ink" /> : null}
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-sunken/60 p-4">
            <dt className="font-semibold text-ink">{t.groups.privacy[group.privacy]}</dt>
            <dd className="mt-1 text-[0.95rem] text-muted">{t.groups.privacyHelp[group.privacy]}</dd>
          </div>
          <div className="rounded-xl bg-sunken/60 p-4">
            <dt className="font-semibold text-ink">{plural(locale, group.memberCount, t.groups.members)}</dt>
            <dd className="mt-1 text-[0.95rem] text-muted">
              {format(t.groups.startedOn, { date: formatDate(group.createdAt, locale, env.timezone) })}
            </dd>
          </div>
        </dl>
      </CardSection>
    </Card>
  );
}

function GroupSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-10 w-80 max-w-full" />
      <ListSkeleton rows={2} />
    </div>
  );
}
