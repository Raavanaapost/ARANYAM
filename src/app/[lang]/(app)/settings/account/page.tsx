import { LogOut, MonitorSmartphone } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, Interpolate, RelativeTime } from "@/components/community/basics";
import { PasswordForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/frame";
import { Badge } from "@/components/ui/badge";
import { Card, CardSection, SectionTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { Skeleton } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import { signOutOtherSessionsAction } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth/dal";
import { listActiveSessions } from "@/lib/services/accounts";
import { describeDevice } from "@/lib/user-agent";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.settings.tabs.account };
}

export default function AccountSettingsPage() {
  return (
    <SettingsFrame active="account">
      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-2xl" />}>
        <Account />
      </Suspense>
    </SettingsFrame>
  );
}

async function Account() {
  const viewer = await requireUser();
  const { locale, t } = await getI18n();
  const sessions = await listActiveSessions(viewer.id);
  const others = sessions.filter((session) => session.id !== viewer.sessionId).length;

  return (
    <>
      <Card>
        <CardSection>
          <SectionTitle>{t.settings.accountTitle}</SectionTitle>
          <p className="font-semibold text-ink">{t.settings.emailLabel}</p>
          <p className="mt-1 break-all text-ink">{viewer.email}</p>
          <p className="mt-1 text-sm text-muted">{t.settings.emailHint}</p>
        </CardSection>
      </Card>

      <Card>
        <CardSection>
          <SectionTitle>{t.settings.passwordTitle}</SectionTitle>
          <PasswordForm email={viewer.email} />
        </CardSection>
      </Card>

      <Card>
        <CardSection>
          <SectionTitle>{t.settings.sessionsTitle}</SectionTitle>
          <ul className="divide-y divide-line">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-start gap-3 py-3">
                <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {describeDevice(session.userAgent ?? "") ?? t.settings.unknownDevice}{" "}
                    {session.id === viewer.sessionId ? <Badge tone="primary">{t.settings.thisDevice}</Badge> : null}
                  </p>
                  <p className="text-sm text-muted">
                    <Interpolate
                      template={t.settings.lastActive}
                      values={{ time: <RelativeTime date={session.lastUsedAt} locale={locale} t={t} /> }}
                    />
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {others ? (
            <ActionForm action={signOutOtherSessionsAction} locale={locale} fields={{}} className="mt-4">
              <SubmitButton variant="secondary" size="sm">
                <LogOut className="size-4" aria-hidden="true" />
                {t.settings.signOutOthers}
              </SubmitButton>
            </ActionForm>
          ) : null}
        </CardSection>
      </Card>
    </>
  );
}
