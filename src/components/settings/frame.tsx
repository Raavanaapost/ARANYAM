import type { ReactNode } from "react";
import { LinkTabs } from "@/components/community/basics";
import { PageHeader } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";

export type SettingsTab = "profile" | "account" | "invites" | "privacy";

const paths: Record<SettingsTab, string> = {
  profile: "",
  account: "/account",
  invites: "/invites",
  privacy: "/privacy",
};

/** Title and tabs shared by the settings pages. */
export async function SettingsFrame({ active, children }: { active: SettingsTab; children: ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={t.settings.title} />
      <LinkTabs
        label={t.settings.title}
        className="mb-6"
        items={(Object.keys(paths) as SettingsTab[]).map((tab) => ({
          href: `/${locale}/settings${paths[tab]}`,
          label: t.settings.tabs[tab],
          active: tab === active,
        }))}
      />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
