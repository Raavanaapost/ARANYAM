import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/frame";
import { ActionForm, Dot, GroupIcon } from "@/components/community/basics";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { EmptyState, ListSkeleton } from "@/components/ui/misc";
import { formatDate, plural } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { deleteGroupAction } from "@/lib/actions/groups";
import { requireModerator } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/viewer";
import { env } from "@/lib/env";
import { listAllGroups } from "@/lib/services/groups";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.tabs.groups };
}

export default function AdminGroupsPage() {
  return (
    <AdminFrame active="groups">
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Groups />
      </Suspense>
    </AdminFrame>
  );
}

async function Groups() {
  const viewer = await requireModerator();
  const { locale, t } = await getI18n();
  const groups = await listAllGroups();
  return (
    <div className="space-y-4">
      <p className="text-muted">{t.admin.groupsHint}</p>
      {groups.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {groups.map((group) => (
              <li key={group.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <GroupIcon icon={group.icon} color={group.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{group.name}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                    <span>{t.groups.privacy[group.privacy]}</span>
                    <Dot />
                    <span>{plural(locale, group.memberCount, t.groups.members)}</span>
                    {group.ownerName ? (
                      <>
                        <Dot />
                        <span>
                          {t.groups.roles.owner}: {group.ownerName}
                        </span>
                      </>
                    ) : null}
                    <Dot />
                    <span>{formatDate(group.createdAt, locale, env.timezone)}</span>
                  </p>
                </div>
                {isAdmin(viewer) ? (
                  <ActionForm action={deleteGroupAction} locale={locale} fields={{ groupId: group.id, from: "admin" }}>
                    <SubmitButton size="sm" variant="danger-ghost" confirm={t.groups.deleteConfirm}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t.groups.deleteGroup}
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title={t.admin.groupsEmpty} />
      )}
    </div>
  );
}
