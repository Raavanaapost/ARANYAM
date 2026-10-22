import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, GroupIcon } from "@/components/community/basics";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { Skeleton } from "@/components/ui/misc";
import { format } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { joinGroupByCodeAction } from "@/lib/actions/groups";
import { requireMember } from "@/lib/auth/dal";
import { findGroupByCode, getGroup } from "@/lib/services/groups";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.groups.join };
}

export default function JoinGroupPage({ params }: PageProps<"/[lang]/groups/join/[code]">) {
  return (
    <div className="mx-auto w-full max-w-lg py-6">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <JoinGroup params={params} />
      </Suspense>
    </div>
  );
}

async function JoinGroup({ params }: Pick<PageProps<"/[lang]/groups/join/[code]">, "params">) {
  const viewer = await requireMember();
  const { locale, t } = await getI18n();
  const { code } = await params;
  const group = await findGroupByCode(code);
  if (!group) {
    return (
      <Card>
        <CardSection className="space-y-5">
          <Alert tone="warning">{t.groups.invalidInvite}</Alert>
          <ButtonLink href={`/${locale}/groups`} variant="secondary">
            {t.sidebar.browseGroups}
          </ButtonLink>
        </CardSection>
      </Card>
    );
  }
  const existing = await getGroup(viewer, group.id);
  if (existing?.myStatus === "active") redirect(`/${locale}/groups/${group.id}`);

  return (
    <Card>
      <CardSection className="flex flex-col items-center gap-4 text-center">
        <GroupIcon icon={group.icon} color={group.color} size="lg" />
        <div>
          <h1 className="text-2xl text-ink">{format(t.groups.joinViaLinkTitle, { name: group.name })}</h1>
          <p className="mt-1 text-muted">{t.groups.joinViaLinkBody}</p>
        </div>
        {group.description ? <p className="text-ink">{group.description}</p> : null}
        <ActionForm action={joinGroupByCodeAction} locale={locale} fields={{ code }}>
          <SubmitButton size="lg" pendingLabel={t.common.loading}>
            {t.groups.join}
          </SubmitButton>
        </ActionForm>
      </CardSection>
    </Card>
  );
}
