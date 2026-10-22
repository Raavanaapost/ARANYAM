import { CalendarDays, CalendarPlus, Lock, MapPin, Monitor, RotateCcw, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, Interpolate, RichText } from "@/components/community/basics";
import { DateTile, eventWhen, GroupChip } from "@/components/community/cards";
import { CommentSection } from "@/components/community/comments";
import { ItemMenu, type MenuCommand } from "@/components/community/interactive";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { ListSkeleton, Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format, plural, timeZoneName } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { cancelEventAction, deleteEventAction, rsvpAction } from "@/lib/actions/events";
import { removeContentAction } from "@/lib/actions/moderation";
import { requireMember } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { getEvent, type EventDetail } from "@/lib/services/events";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.events.title };
}

export default async function EventPage({ params }: PageProps<"/[lang]/events/[id]">) {
  const { locale, t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link href={`/${locale}/events`} className="mb-4 inline-block font-semibold text-primary hover:underline">
        ← {t.events.title}
      </Link>
      <Suspense fallback={<EventSkeleton />}>
        <Event params={params} />
      </Suspense>
    </div>
  );
}

type Shared = { event: EventDetail; locale: Locale; t: Dictionary; isOver: boolean };

async function Event({ params }: Pick<PageProps<"/[lang]/events/[id]">, "params">) {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const { id } = await params;
  const event = await getEvent(viewer, id);
  if (!event) notFound();
  // eslint-disable-next-line react-hooks/purity -- a Server Component renders once per request
  const isOver = (event.endsAt ?? event.startsAt).getTime() < Date.now();
  const shared = { event, locale, t, isOver };

  const menuRemove: MenuCommand | undefined = event.isMine
    ? { action: deleteEventAction, fields: { id: event.id }, confirm: t.events.deleteConfirm, label: t.common.delete }
    : event.canRemove
      ? {
          action: removeContentAction,
          fields: { type: "event", id: event.id, next: "/events" },
          confirm: t.common.removeConfirm,
          label: t.common.remove,
        }
      : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-6">
        {event.removed ? <Alert tone="warning">{t.events.removedNotice}</Alert> : null}
        {event.cancelled ? (
          <Alert tone="danger" title={t.events.cancelled}>
            {t.events.cancelledNotice}
          </Alert>
        ) : null}
        {event.group ? (
          <p className="rounded-2xl bg-sunken px-4 py-2.5 text-sm text-muted">
            {event.group.icon} {format(t.events.groupOnlyNotice, { group: event.group.name })}
          </p>
        ) : null}

        <Card>
          <CardSection className="space-y-6">
            <div className="flex items-start gap-4">
              <DateTile date={event.startsAt} locale={locale} />
              <div className="min-w-0 flex-1">
                <h1 className={`text-2xl text-ink sm:text-3xl ${event.cancelled ? "line-through" : ""}`}>{event.title}</h1>
                {event.organiser ? (
                  <p className="mt-1 text-muted">
                    <Interpolate
                      template={t.events.organisedBy}
                      values={{
                        name: (
                          <Link
                            href={`/${locale}/members/${event.organiser.id}`}
                            className="font-semibold text-ink hover:underline"
                          >
                            {event.organiser.displayName}
                          </Link>
                        ),
                      }}
                    />
                  </p>
                ) : null}
                {event.group ? (
                  <div className="mt-2">
                    <GroupChip group={event.group} locale={locale} />
                  </div>
                ) : null}
              </div>
              <ItemMenu
                editHref={event.canEdit ? `/${locale}/events/${event.id}/edit` : undefined}
                remove={menuRemove}
                report={event.isMine || event.removed ? undefined : { targetType: "event", targetId: event.id }}
              />
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3">
                <CalendarDays className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-ink">{t.events.when}</dt>
                  <dd className="text-ink">{eventWhen(event, locale)}</dd>
                  <dd className="text-sm text-muted">
                    {format(t.events.timezoneNote, { zone: timeZoneName(env.timezone, locale, event.startsAt) })}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                {event.mode === "online" ? (
                  <Monitor className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                )}
                <div>
                  <dt className="font-semibold text-ink">{t.events.where}</dt>
                  <dd className="text-ink">
                    {event.mode === "online" ? t.events.online : event.city || t.events.inPerson}
                  </dd>
                </div>
              </div>
            </dl>

            <PrivateDetails {...shared} />

            {event.features.length ? (
              <ul className="flex flex-wrap gap-2" aria-label={t.events.featuresLabel}>
                {event.features.map((feature) => (
                  <li key={feature}>
                    <Badge tone="accent">{t.events.features[feature]}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}

            {event.description ? (
              <RichText text={event.description} className="border-t border-line pt-5 text-[1.02rem] text-ink" />
            ) : null}
          </CardSection>
        </Card>

        {event.removed ? null : (
          <Card>
            <CardSection>
              <CommentSection
                viewer={viewer}
                target={{ type: "event", id: event.id }}
                locale={locale}
                t={t}
                title={t.events.questions}
              />
            </CardSection>
          </Card>
        )}
      </div>

      <aside className="space-y-5">
        <RsvpCard {...shared} />
        <Attendees {...shared} />
      </aside>
    </div>
  );
}

/** The address or meeting link, shown only to the organiser, moderators and families who responded. */
function PrivateDetails({ event, t }: Shared) {
  const details = event.mode === "online" ? event.onlineUrl : event.venue;
  if (event.canSeePrivate && !details) return null;
  return (
    <div className="rounded-xl border border-line bg-sunken/50 p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <Lock className="size-4 text-muted" aria-hidden="true" />
        {t.events.privateDetails}
      </h2>
      {event.canSeePrivate ? (
        event.mode === "online" ? (
          <a
            href={event.onlineUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1.5 block font-medium break-all text-primary underline"
          >
            {event.onlineUrl}
          </a>
        ) : (
          <p className="mt-1.5 whitespace-pre-line text-ink">{event.venue}</p>
        )
      ) : (
        <p className="mt-1.5 text-[0.95rem] text-muted">{t.events.privateDetailsHidden}</p>
      )}
    </div>
  );
}

function RsvpCard({ event, locale, t, isOver }: Shared) {
  const open = !event.cancelled && !event.removed && !isOver;
  const spotsLeft = event.capacity === null ? null : Math.max(0, event.capacity - event.goingCount);
  return (
    <Card>
      <CardSection className="space-y-4">
        <h2 className="text-lg text-ink">{t.events.rsvpTitle}</h2>
        <ul className="space-y-1 text-[0.95rem] text-muted">
          <li className="font-semibold text-ink">{plural(locale, event.goingCount, t.events.goingCount)}</li>
          {event.interestedCount ? <li>{plural(locale, event.interestedCount, t.events.interestedCount)}</li> : null}
          {open && spotsLeft !== null ? (
            <li>{spotsLeft > 0 ? plural(locale, spotsLeft, t.events.spotsLeft) : t.events.full}</li>
          ) : null}
        </ul>

        {event.isMine ? (
          <p className="rounded-xl bg-primary-soft px-4 py-3 text-[0.95rem] font-medium text-primary">
            {t.events.organiserNote}
          </p>
        ) : open ? (
          <div className="space-y-2">
            {event.isFull && event.myRsvp !== "going" ? <Alert tone="warning">{t.events.full}</Alert> : null}
            <div className="grid grid-cols-2 gap-2">
              <ActionForm action={rsvpAction} locale={locale} fields={{ id: event.id, status: "going" }}>
                <SubmitButton
                  className="w-full"
                  variant={event.myRsvp === "going" ? "primary" : "secondary"}
                  aria-pressed={event.myRsvp === "going"}
                  disabled={event.isFull && event.myRsvp !== "going"}
                >
                  {t.events.rsvpGoing}
                </SubmitButton>
              </ActionForm>
              <ActionForm action={rsvpAction} locale={locale} fields={{ id: event.id, status: "interested" }}>
                <SubmitButton
                  className="w-full"
                  variant={event.myRsvp === "interested" ? "primary" : "secondary"}
                  aria-pressed={event.myRsvp === "interested"}
                >
                  {t.events.rsvpInterested}
                </SubmitButton>
              </ActionForm>
            </div>
            {event.myRsvp ? (
              <ActionForm action={rsvpAction} locale={locale} fields={{ id: event.id, status: "none" }}>
                <SubmitButton variant="ghost" size="sm" className="w-full">
                  {t.events.rsvpNotGoing}
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        ) : null}

        {open ? (
          <a
            href={`/api/events/${event.id}/ics`}
            download
            className={buttonClasses("soft", "sm", "w-full")}
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            {t.events.addToCalendar}
          </a>
        ) : null}

        {event.canEdit && !isOver ? (
          <ActionForm
            action={cancelEventAction}
            locale={locale}
            fields={{ id: event.id, cancelled: event.cancelled ? "false" : "true" }}
            className="border-t border-line pt-4"
          >
            {event.cancelled ? (
              <SubmitButton variant="secondary" size="sm" className="w-full">
                <RotateCcw className="size-4" aria-hidden="true" />
                {t.events.restore}
              </SubmitButton>
            ) : (
              <SubmitButton variant="danger-ghost" size="sm" className="w-full" confirm={t.events.cancelConfirm}>
                <XCircle className="size-4" aria-hidden="true" />
                {t.events.cancelEvent}
              </SubmitButton>
            )}
          </ActionForm>
        ) : null}
      </CardSection>
    </Card>
  );
}

function Attendees({ event, locale, t }: Shared) {
  if (!event.canSeePrivate || event.attendees.length === 0) return null;
  const sorted = [...event.attendees].sort((a, b) => Number(a.status !== "going") - Number(b.status !== "going"));
  return (
    <Card>
      <CardSection>
        <h2 className="text-lg text-ink">{t.events.whosComing}</h2>
        <p className="mb-4 text-sm text-muted">{t.events.whosComingHint}</p>
        <ul className="space-y-2.5">
          {sorted.map((person) => (
            <li key={person.id} className="flex items-center gap-3">
              <Avatar name={person.displayName} hue={person.avatarHue} size="sm" />
              <Link href={`/${locale}/members/${person.id}`} className="min-w-0 flex-1 truncate font-medium text-ink hover:underline">
                {person.displayName}
              </Link>
              {person.id === event.organiser?.id ? (
                <Badge tone="primary">{t.events.organiser}</Badge>
              ) : person.status === "interested" ? (
                <Badge tone="info">{t.events.rsvpInterested}</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      </CardSection>
    </Card>
  );
}

function EventSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]" aria-busy="true">
      <div className="space-y-6">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <ListSkeleton rows={1} />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
