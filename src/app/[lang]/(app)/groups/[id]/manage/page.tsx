import { RefreshCw, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, RelativeTime } from "@/components/community/basics";
import { GroupForm } from "@/components/community/editors";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardSection, SectionTitle } from "@/components/ui/card";
import { CopyButton, SubmitButton } from "@/components/ui/client";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { format, formatDate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import {
  answerJoinRequestAction,
  deleteGroupAction,
  regenerateGroupInviteAction,
  removeGroupMemberAction,
  setGroupRoleAction,
} from "@/lib/actions/groups";
import { requireMember } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { getGroup, listGroupMembers, listJoinRequests } from "@/lib/services/groups";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.groups.manage };
}

export default async function ManageGroupPage({ params }: PageProps<"/[lang]/groups/[id]/manage">) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <ManageGroup params={params} />
      </Suspense>
    </div>
  );
}

async function ManageGroup({ params }: Pick<PageProps<"/[lang]/groups/[id]/manage">, "params">) {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const { id } = await params;
  const group = await getGroup(viewer, id);
  if (!group || !group.isGroupAdmin) notFound();
  const [requests, members] = await Promise.all([listJoinRequests(viewer, id), listGroupMembers(viewer, id)]);
  const groupHref = `/${locale}/groups/${group.id}`;
  const inviteUrl = group.inviteCode ? `${env.appUrl}/${locale}/groups/join/${group.inviteCode}` : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href={groupHref} className="mb-3 inline-block font-semibold text-primary hover:underline">
          ← {group.icon} {group.name}
        </Link>
        <PageHeader title={t.groups.manage} subtitle={t.groups.adminHint} className="mb-0" />
      </div>

      <section aria-labelledby="requests">
        <SectionTitle>
          <span id="requests">{t.groups.requests}</span>
        </SectionTitle>
        <Card>
          {requests.length ? (
            <ul className="divide-y divide-line">
              {requests.map((request) => (
                <li key={request.id} className="space-y-3 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={request.displayName} hue={request.avatarHue} />
                    <div className="min-w-0">
                      <Link href={`/${locale}/members/${request.id}`} className="font-semibold text-ink hover:underline">
                        {request.displayName}
                      </Link>
                      <p className="text-sm text-muted">
                        <RelativeTime date={request.requestedAt} locale={locale} t={t} />
                      </p>
                    </div>
                  </div>
                  {request.note ? (
                    <p className="rounded-xl bg-sunken/60 px-4 py-3 text-[0.95rem] whitespace-pre-line text-ink">
                      {request.note}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <ActionForm
                      action={answerJoinRequestAction}
                      locale={locale}
                      fields={{ groupId: group.id, userId: request.id, approve: "true" }}
                    >
                      <SubmitButton size="sm">{t.groups.approve}</SubmitButton>
                    </ActionForm>
                    <ActionForm
                      action={answerJoinRequestAction}
                      locale={locale}
                      fields={{ groupId: group.id, userId: request.id, approve: "false" }}
                    >
                      <SubmitButton size="sm" variant="ghost">
                        {t.groups.decline}
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CardSection>
              <p className="text-muted">{t.groups.noRequests}</p>
            </CardSection>
          )}
        </Card>
      </section>

      {inviteUrl ? (
        <section aria-labelledby="invite-link">
          <SectionTitle>
            <span id="invite-link">{t.groups.inviteLink}</span>
          </SectionTitle>
          <Card>
            <CardSection className="space-y-4">
              <p className="text-[0.95rem] text-muted">{t.groups.inviteLinkHint}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-sunken px-3.5 py-2.5 text-sm text-ink">
                  {inviteUrl}
                </code>
                <CopyButton value={inviteUrl} />
              </div>
              <ActionForm action={regenerateGroupInviteAction} locale={locale} fields={{ groupId: group.id }}>
                <SubmitButton variant="ghost" size="sm" confirm={t.groups.regenerateConfirm}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t.groups.regenerate}
                </SubmitButton>
              </ActionForm>
            </CardSection>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="members">
        <SectionTitle>
          <span id="members">{t.groups.tabs.members}</span>
        </SectionTitle>
        <Card>
          <ul className="divide-y divide-line">
            {members.map((member) => {
              const isSelf = member.id === viewer.id;
              const canChangeRole = group.isOwner && !isSelf && member.role !== "owner";
              const canRemove =
                !isSelf && member.role !== "owner" && (group.isOwner || member.role === "member");
              return (
                <li key={member.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={member.displayName} hue={member.avatarHue} />
                    <div className="min-w-0">
                      <Link
                        href={`/${locale}/members/${member.id}`}
                        className="block truncate font-semibold text-ink hover:underline"
                      >
                        {member.displayName}
                      </Link>
                      <p className="text-sm text-muted">
                        {format(t.groups.memberSince, { date: formatDate(member.joinedAt, locale, env.timezone) })}
                      </p>
                    </div>
                    {member.role !== "member" ? <Badge tone="primary">{t.groups.roles[member.role]}</Badge> : null}
                  </div>
                  {canChangeRole || canRemove ? (
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      {canChangeRole ? (
                        <ActionForm
                          action={setGroupRoleAction}
                          locale={locale}
                          fields={{
                            groupId: group.id,
                            userId: member.id,
                            role: member.role === "admin" ? "member" : "admin",
                          }}
                        >
                          <SubmitButton size="sm" variant="secondary">
                            {member.role === "admin" ? t.groups.removeAdmin : t.groups.makeAdmin}
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                      {canRemove ? (
                        <ActionForm
                          action={removeGroupMemberAction}
                          locale={locale}
                          fields={{ groupId: group.id, userId: member.id }}
                        >
                          <SubmitButton size="sm" variant="danger-ghost" confirm={t.groups.removeConfirm}>
                            {t.groups.removeMember}
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="details">
        <SectionTitle>
          <span id="details">{t.groups.formTitleEdit}</span>
        </SectionTitle>
        <Card>
          <CardSection>
            <GroupForm
              group={{
                id: group.id,
                name: group.name,
                description: group.description,
                privacy: group.privacy,
                icon: group.icon,
                color: group.color,
              }}
              cancelHref={groupHref}
            />
          </CardSection>
        </Card>
      </section>

      {group.isOwner ? (
        <section aria-labelledby="delete-group">
          <Card className="border-danger/40">
            <CardSection className="space-y-3">
              <h2 id="delete-group" className="text-lg text-danger">
                {t.groups.deleteGroup}
              </h2>
              <p className="text-[0.95rem] text-muted">{t.groups.deleteConfirm}</p>
              <ActionForm action={deleteGroupAction} locale={locale} fields={{ groupId: group.id }}>
                <SubmitButton variant="danger" size="sm" confirm={t.groups.deleteConfirm}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t.groups.deleteGroup}
                </SubmitButton>
              </ActionForm>
            </CardSection>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
