import { Flag, Hourglass, MessageSquareText, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/frame";
import { Skeleton } from "@/components/ui/misc";
import { intlLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { requireModerator } from "@/lib/auth/dal";
import { getModerationStats } from "@/lib/services/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.title };
}

export default function AdminPage() {
  return (
    <AdminFrame active="overview">
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        }
      >
        <Overview />
      </Suspense>
    </AdminFrame>
  );
}

async function Overview() {
  await requireModerator();
  const { locale, t } = await getI18n();
  const stats = await getModerationStats();
  const number = new Intl.NumberFormat(intlLocale[locale]);
  const tiles = [
    { label: t.admin.stats.waiting, value: stats.waiting, icon: Hourglass, href: `/${locale}/admin/members`, urgent: stats.waiting > 0 },
    { label: t.admin.stats.reports, value: stats.reports, icon: Flag, href: `/${locale}/admin/reports`, urgent: stats.reports > 0 },
    { label: t.admin.stats.members, value: stats.members, icon: UsersRound, href: `/${locale}/admin/members?tab=all`, urgent: false },
    { label: t.admin.stats.postsWeek, value: stats.postsWeek, icon: MessageSquareText, href: `/${locale}/feed`, urgent: false },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <li key={tile.label}>
          <Link
            href={tile.href}
            className={`flex h-full flex-col gap-3 rounded-2xl border p-5 transition-colors hover:border-line-strong ${
              tile.urgent ? "border-accent/40 bg-accent-soft" : "border-line bg-surface"
            }`}
          >
            <tile.icon className={`size-6 ${tile.urgent ? "text-accent" : "text-primary"}`} aria-hidden="true" />
            <span className="font-display text-4xl leading-none font-bold text-ink">{number.format(tile.value)}</span>
            <span className="font-semibold text-muted">{tile.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
