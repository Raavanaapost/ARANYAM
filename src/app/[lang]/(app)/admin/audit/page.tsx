import { History } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/frame";
import { RelativeTime } from "@/components/community/basics";
import { Card } from "@/components/ui/card";
import { EmptyState, ListSkeleton } from "@/components/ui/misc";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { requireModerator } from "@/lib/auth/dal";
import { listAuditLog } from "@/lib/services/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.tabs.audit };
}

export default function AdminAuditPage() {
  return (
    <AdminFrame active="audit">
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <AuditLog />
      </Suspense>
    </AdminFrame>
  );
}

function actionLabel(action: string, t: Dictionary) {
  return action in t.admin.actions ? t.admin.actions[action as keyof Dictionary["admin"]["actions"]] : action;
}

async function AuditLog() {
  await requireModerator();
  const { locale, t } = await getI18n();
  const entries = await listAuditLog(200);
  if (entries.length === 0) {
    return <EmptyState icon={<History className="size-8" aria-hidden="true" />} title={t.admin.auditEmpty} />;
  }
  return (
    <Card>
      <ul className="divide-y divide-line">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
            <p className="text-ink">
              {format(t.admin.auditLine, {
                actor: entry.actorName ?? t.notifications.someone,
                action: actionLabel(entry.action, t),
              })}
              {entry.targetName ? <span className="font-semibold"> · {entry.targetName}</span> : null}
            </p>
            <span className="text-sm text-muted">
              <RelativeTime date={entry.createdAt} locale={locale} t={t} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
