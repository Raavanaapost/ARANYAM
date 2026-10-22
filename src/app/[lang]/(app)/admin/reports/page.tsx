import { ExternalLink, Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RevealAuthor } from "@/components/admin/forms";
import { AdminFrame } from "@/components/admin/frame";
import { ActionForm, Dot, RelativeTime, RichText } from "@/components/community/basics";
import { Badge } from "@/components/ui/badge";
import { Card, CardSection } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { EmptyState, ListSkeleton } from "@/components/ui/misc";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { resolveReportAction } from "@/lib/actions/moderation";
import { requireModerator } from "@/lib/auth/dal";
import { listOpenReports } from "@/lib/services/reports";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.tabs.reports };
}

export default function AdminReportsPage() {
  return (
    <AdminFrame active="reports">
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <Reports />
      </Suspense>
    </AdminFrame>
  );
}

async function Reports() {
  const moderator = await requireModerator();
  const { locale, t } = await getI18n();
  const reports = await listOpenReports(moderator);
  if (reports.length === 0) {
    return <EmptyState icon={<Flag className="size-8" aria-hidden="true" />} title={t.admin.reportsEmpty} />;
  }

  return (
    <ul className="space-y-4">
      {reports.map((report) => {
        const content = report.content;
        const fields = { reportId: report.id };
        return (
          <li key={report.id}>
            <Card data-testid="report">
              <CardSection className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Badge tone="danger">{t.report.reasons[report.reason]}</Badge>
                  <Badge>{t.admin.reportTypes[report.targetType]}</Badge>
                  <RelativeTime date={report.createdAt} locale={locale} t={t} />
                  {report.reporterName ? (
                    <>
                      <Dot />
                      <span>{format(t.admin.reportedBy, { name: report.reporterName })}</span>
                    </>
                  ) : null}
                </div>

                {report.details ? (
                  <p className="rounded-xl bg-danger-soft/60 px-4 py-3 whitespace-pre-line text-ink">{report.details}</p>
                ) : null}

                <div className="rounded-xl border border-line p-4">
                  <p className="mb-2 text-sm font-semibold text-muted">{t.admin.reportedContent}</p>
                  {content ? (
                    <div className="space-y-3">
                      {content.title ? <p className="font-semibold text-ink">{content.title}</p> : null}
                      {content.text ? <RichText text={content.text} className="line-clamp-[10] text-ink" /> : null}
                      {content.removed ? <Badge tone="warning">{t.common.removedNotice}</Badge> : null}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        {content.authorName ? (
                          <span className="text-muted">{format(t.admin.contentAuthor, { name: content.authorName })}</span>
                        ) : content.isAnonymous ? (
                          <div className="space-y-1">
                            <Badge>{t.admin.anonymousContent}</Badge>
                            <RevealAuthor reportId={report.id} />
                          </div>
                        ) : null}
                        {content.link ? (
                          <Link
                            href={`/${locale}${content.link}`}
                            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                          >
                            <ExternalLink className="size-4" aria-hidden="true" />
                            {t.admin.viewInContext}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted">{t.admin.contentMissing}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                  {content && !content.removed && report.targetType !== "user" ? (
                    <ActionForm action={resolveReportAction} locale={locale} fields={{ ...fields, intent: "remove" }}>
                      <SubmitButton size="sm" variant="danger" confirm={t.common.removeConfirm}>
                        {t.admin.removeContent}
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                  <ActionForm action={resolveReportAction} locale={locale} fields={{ ...fields, intent: "dismiss" }}>
                    <SubmitButton size="sm" variant="secondary">
                      {t.admin.dismiss}
                    </SubmitButton>
                  </ActionForm>
                  {content?.authorId ? (
                    <ActionForm action={resolveReportAction} locale={locale} fields={{ ...fields, intent: "suspend" }}>
                      <SubmitButton size="sm" variant="danger-ghost" confirm={t.admin.suspendConfirm}>
                        {t.admin.suspendAuthor}
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              </CardSection>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
