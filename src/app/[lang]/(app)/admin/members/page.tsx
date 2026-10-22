import { Search } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { ResetLink } from "@/components/admin/forms";
import { AdminFrame } from "@/components/admin/frame";
import { ActionForm, Dot, Interpolate, LinkTabs, RelativeTime } from "@/components/community/basics";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ListSkeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { moderateMemberAction, setRoleAction } from "@/lib/actions/moderation";
import { requireModerator } from "@/lib/auth/dal";
import { isAdmin, type Viewer } from "@/lib/auth/viewer";
import { USER_ROLES } from "@/lib/constants";
import { firstParam, pickParam } from "@/lib/params";
import { listMembersForModeration, type MemberTab, type ModerationMember } from "@/lib/services/admin";

const TABS = ["waiting", "unverified", "all", "suspended"] as const satisfies readonly MemberTab[];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.tabs.members };
}

export default function AdminMembersPage({ searchParams }: PageProps<"/[lang]/admin/members">) {
  return (
    <AdminFrame active="members">
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Members searchParams={searchParams} />
      </Suspense>
    </AdminFrame>
  );
}

async function Members({ searchParams }: Pick<PageProps<"/[lang]/admin/members">, "searchParams">) {
  const viewer = await requireModerator();
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const tab = pickParam(params.tab, TABS) ?? "waiting";
  const query = (firstParam(params.q) ?? "").slice(0, 100);
  const rows = await listMembersForModeration(tab, query);
  const base = `/${locale}/admin/members`;
  const empty = {
    waiting: t.admin.emptyWaiting,
    unverified: t.admin.emptyUnverified,
    all: t.admin.emptyMembers,
    suspended: t.admin.emptySuspended,
  };

  return (
    <div className="space-y-5">
      <LinkTabs
        label={t.admin.tabs.members}
        items={TABS.map((name) => ({
          href: name === "waiting" ? base : `${base}?tab=${name}`,
          label: t.admin.memberTabs[name],
          active: tab === name,
        }))}
      />

      <Form action={base} className="flex gap-2" role="search">
        {tab === "waiting" ? null : <input type="hidden" name="tab" value={tab} />}
        <label htmlFor="member-search" className="sr-only">
          {t.admin.searchPlaceholder}
        </label>
        <Input
          id="member-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t.admin.searchPlaceholder}
          className="h-11"
        />
        <Button type="submit" variant="secondary" className="shrink-0">
          <Search className="size-4" aria-hidden="true" />
          {t.admin.search}
        </Button>
      </Form>

      {rows.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <MemberRow key={row.id} row={row} tab={tab} viewer={viewer} locale={locale} t={t} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title={empty[tab]} />
      )}
    </div>
  );
}

function MemberRow({
  row,
  tab,
  viewer,
  locale,
  t,
}: {
  row: ModerationMember;
  tab: MemberTab;
  viewer: Viewer;
  locale: Locale;
  t: Dictionary;
}) {
  const isSelf = row.id === viewer.id;
  const fields = { userId: row.id };
  return (
    <li className="space-y-3 px-5 py-4" data-testid="member-row">
      <div className="flex items-start gap-3">
        <Avatar name={row.displayName} hue={row.avatarHue} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {row.status === "approved" ? (
              <Link href={`/${locale}/members/${row.id}`} className="font-semibold text-ink hover:underline">
                {row.displayName}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{row.displayName}</span>
            )}
            {row.role !== "member" ? <Badge tone="primary">{t.profile.roles[row.role]}</Badge> : null}
          </div>
          <p className="text-sm break-all text-muted">{row.email}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
            <span>
              <Interpolate
                template={t.admin.registered}
                values={{ time: <RelativeTime date={row.createdAt} locale={locale} t={t} /> }}
              />
            </span>
            {row.location ? (
              <>
                <Dot />
                <span>{row.location}</span>
              </>
            ) : null}
            {row.invitedByName ? (
              <>
                <Dot />
                <span>{format(t.admin.invitedBy, { name: row.invitedByName })}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {tab === "waiting" || tab === "unverified" ? (
        <div className="rounded-xl bg-sunken/60 px-4 py-3">
          <p className="text-sm font-semibold text-muted">{t.admin.joinNote}</p>
          <p className="mt-0.5 whitespace-pre-line text-ink">{row.joinNote || t.admin.noNote}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {tab === "waiting" ? (
          <>
            <ActionForm action={moderateMemberAction} locale={locale} fields={{ ...fields, intent: "approve" }}>
              <SubmitButton size="sm">{t.admin.approve}</SubmitButton>
            </ActionForm>
            <ActionForm action={moderateMemberAction} locale={locale} fields={{ ...fields, intent: "decline" }}>
              <SubmitButton size="sm" variant="danger-ghost" confirm={t.admin.declineConfirm}>
                {t.admin.decline}
              </SubmitButton>
            </ActionForm>
          </>
        ) : null}

        {tab === "unverified" ? (
          <>
            <ActionForm action={moderateMemberAction} locale={locale} fields={{ ...fields, intent: "verify" }}>
              <SubmitButton size="sm" variant="secondary">
                {t.admin.markVerified}
              </SubmitButton>
            </ActionForm>
            <ActionForm action={moderateMemberAction} locale={locale} fields={{ ...fields, intent: "resend" }}>
              <SubmitButton size="sm" variant="ghost">
                {t.admin.resendVerification}
              </SubmitButton>
            </ActionForm>
          </>
        ) : null}

        {tab === "suspended" ? (
          <ActionForm action={moderateMemberAction} locale={locale} fields={{ ...fields, intent: "reinstate" }}>
            <SubmitButton size="sm" variant="secondary">
              {t.admin.reinstate}
            </SubmitButton>
          </ActionForm>
        ) : null}

        {tab === "all" && !isSelf ? (
          <>
            {isAdmin(viewer) ? (
              <ActionForm action={setRoleAction} locale={locale} fields={fields} className="flex items-center gap-2">
                <label htmlFor={`role-${row.id}`} className="sr-only">
                  {t.admin.role}
                </label>
                <Select id={`role-${row.id}`} name="role" defaultValue={row.role} className="h-9 w-auto text-sm">
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t.profile.roles[role]}
                    </option>
                  ))}
                </Select>
                <SubmitButton size="sm" variant="secondary">
                  {t.admin.changeRole}
                </SubmitButton>
              </ActionForm>
            ) : null}
            {row.role === "member" || (row.role === "moderator" && isAdmin(viewer)) ? (
              <ActionForm action={moderateMemberAction} locale={locale} fields={{ ...fields, intent: "suspend" }}>
                <SubmitButton size="sm" variant="danger-ghost" confirm={t.admin.suspendConfirm}>
                  {t.admin.suspend}
                </SubmitButton>
              </ActionForm>
            ) : null}
          </>
        ) : null}

        {tab === "all" && isAdmin(viewer) && !isSelf ? <ResetLink userId={row.id} /> : null}
      </div>
    </li>
  );
}
