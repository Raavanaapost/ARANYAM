import type { ReactNode } from "react";
import { LinkTabs } from "@/components/community/basics";
import { PageHeader } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";

export type AdminTab = "overview" | "members" | "reports" | "groups" | "audit";

const paths: Record<AdminTab, string> = {
  overview: "",
  members: "/members",
  reports: "/reports",
  groups: "/groups",
  audit: "/audit",
};

/** Title and tabs shared by the moderation pages. */
export async function AdminFrame({ active, children }: { active: AdminTab; children: ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <>
      <PageHeader title={t.admin.title} subtitle={t.admin.subtitle} />
      <LinkTabs
        label={t.admin.title}
        className="mb-6"
        items={(Object.keys(paths) as AdminTab[]).map((tab) => ({
          href: `/${locale}/admin${paths[tab]}`,
          label: t.admin.tabs[tab],
          active: tab === active,
        }))}
      />
      {children}
    </>
  );
}
