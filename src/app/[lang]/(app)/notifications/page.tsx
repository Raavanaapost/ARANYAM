import { BellOff, CalendarCheck, CheckCheck, MessageCircle, PartyPopper, UserPlus, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, RelativeTime } from "@/components/community/basics";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/ui/misc";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { markNotificationsReadAction } from "@/lib/actions/settings";
import { requireMember } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import type { NotificationType } from "@/lib/constants";
import { listNotifications } from "@/lib/services/notifications";

const icons: Record<NotificationType, typeof MessageCircle> = {
  comment_on_post: MessageCircle,
  comment_on_article: MessageCircle,
  comment_on_event: MessageCircle,
  membership_approved: PartyPopper,
  group_join_request: UserPlus,
  group_join_approved: UsersRound,
  event_rsvp: CalendarCheck,
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.notifications.title };
}

export default async function NotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Notifications />
      </Suspense>
    </div>
  );
}

function message(
  item: { type: NotificationType; actorName: string | null; data: Record<string, string> },
  t: Dictionary,
) {
  return format(t.notifications.types[item.type], {
    actor: item.actorName ?? t.notifications.someone,
    title: item.data.title ?? "",
    group: item.data.group ?? "",
  });
}

async function Notifications() {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const items = await listNotifications(viewer.id);
  const hasUnread = items.some((item) => !item.readAt);

  return (
    <>
      <PageHeader
        title={t.notifications.title}
        actions={
          hasUnread ? (
            <ActionForm action={markNotificationsReadAction} locale={locale} fields={{}}>
              <SubmitButton variant="secondary" size="sm">
                <CheckCheck className="size-4" aria-hidden="true" />
                {t.notifications.markAllRead}
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      />
      {items.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const Icon = icons[item.type];
              const unread = !item.readAt;
              const content = (
                <>
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      unread ? "bg-primary-soft text-primary" : "bg-sunken text-muted",
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-ink", unread && "font-semibold")}>{message(item, t)}</span>
                    <span className="text-sm text-muted">
                      <RelativeTime date={item.createdAt} locale={locale} t={t} />
                    </span>
                  </span>
                  {unread ? <span className="mt-2 size-2.5 shrink-0 rounded-full bg-heart" aria-label={t.common.new} /> : null}
                </>
              );
              return (
                <li key={item.id}>
                  {item.link ? (
                    <Link
                      href={`/${locale}${item.link}`}
                      className={cn("flex items-start gap-3 px-5 py-4 hover:bg-sunken/60", unread && "bg-primary-soft/30")}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className={cn("flex items-start gap-3 px-5 py-4", unread && "bg-primary-soft/30")}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={<BellOff className="size-8" aria-hidden="true" />} title={t.notifications.empty} />
      )}
    </>
  );
}
