import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/community/basics";
import { InviteForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/frame";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardSection, SectionTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { Skeleton } from "@/components/ui/misc";
import { format, formatDate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { revokeInviteAction } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth/dal";
import { isActiveMember } from "@/lib/auth/viewer";
import { env } from "@/lib/env";
import { listInvites, type InviteStatus } from "@/lib/services/invites";

const tones: Record<InviteStatus, BadgeTone> = {
  active: "primary",
  used: "info",
  expired: "neutral",
  revoked: "neutral",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.settings.tabs.invites };
}

export default function InviteSettingsPage() {
  return (
    <SettingsFrame active="invites">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <Invites />
      </Suspense>
    </SettingsFrame>
  );
}

async function Invites() {
  const viewer = await requireUser();
  const { locale, t } = await getI18n();
  if (!isActiveMember(viewer)) return <Alert tone="info">{t.settings.notMemberYet}</Alert>;
  const invites = await listInvites(viewer);

  return (
    <>
      <Card>
        <CardSection className="space-y-4">
          <SectionTitle className="mb-0">{t.settings.invitesTitle}</SectionTitle>
          <p className="text-muted">{t.settings.invitesBody}</p>
          {env.invitesSkipApproval ? <p className="text-sm font-medium text-primary">{t.settings.invitesSkipNote}</p> : null}
          <InviteForm />
        </CardSection>
      </Card>

      <Card>
        <CardSection>
          <SectionTitle>{t.settings.yourInvites}</SectionTitle>
          {invites.length ? (
            <ul className="divide-y divide-line">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{invite.note || "—"}</p>
                    <p className="text-sm text-muted">
                      {invite.status === "active"
                        ? format(t.settings.expires, { date: formatDate(invite.expiresAt, locale, env.timezone) })
                        : formatDate(invite.createdAt, locale, env.timezone)}
                    </p>
                  </div>
                  <Badge tone={tones[invite.status]}>{t.settings.inviteStatus[invite.status]}</Badge>
                  {invite.status === "active" ? (
                    <ActionForm action={revokeInviteAction} locale={locale} fields={{ id: invite.id }}>
                      <SubmitButton variant="danger-ghost" size="sm">
                        {t.settings.revoke}
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t.settings.noInvites}</p>
          )}
        </CardSection>
      </Card>
    </>
  );
}
