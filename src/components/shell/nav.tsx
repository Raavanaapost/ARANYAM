"use client";

import {
  BookOpen,
  CalendarDays,
  House,
  Languages,
  Newspaper,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { switchLocaleInPath } from "@/i18n/config";
import { cn } from "@/lib/cn";

export type NavIcon = "home" | "groups" | "events" | "blogs" | "news";

const icons: Record<NavIcon, LucideIcon> = {
  home: House,
  groups: UsersRound,
  events: CalendarDays,
  blogs: BookOpen,
  news: Newspaper,
};

export type NavItem = { href: string; label: string; icon: NavIcon };

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation. `pathname` is null while the current URL is still unknown. */
export function NavList({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-2 font-semibold transition-colors",
                active ? "bg-primary-soft text-primary" : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              <Icon className="size-[1.15rem]" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActiveNavList({ items }: { items: NavItem[] }) {
  return <NavList items={items} pathname={usePathname()} />;
}

/** Bottom tab bar for phones, where most families will use Aranyam. */
export function TabBarList({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <ul className="grid grid-cols-5">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[0.72rem] font-semibold leading-tight",
                active ? "text-primary" : "text-muted",
              )}
            >
              <span className={cn("rounded-full px-3 py-1", active && "bg-primary-soft")}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActiveTabBarList({ items }: { items: NavItem[] }) {
  return <TabBarList items={items} pathname={usePathname()} />;
}

const switcherClass =
  "inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-sunken";

/** Switches between Tamil and English, staying on the same page. */
export function LanguageSwitcher() {
  const { locale } = useI18n();
  const pathname = usePathname();
  const other = locale === "en" ? "ta" : "en";
  return (
    <Link
      href={switchLocaleInPath(pathname ?? `/${locale}`, other)}
      prefetch={false}
      hrefLang={other}
      lang={other}
      className={switcherClass}
    >
      <Languages className="size-4" aria-hidden="true" />
      {other === "ta" ? "தமிழ்" : "English"}
    </Link>
  );
}

export function LanguageSwitcherFallback() {
  const { locale } = useI18n();
  const other = locale === "en" ? "ta" : "en";
  return (
    <Link href={`/${other}`} prefetch={false} hrefLang={other} lang={other} className={switcherClass}>
      <Languages className="size-4" aria-hidden="true" />
      {other === "ta" ? "தமிழ்" : "English"}
    </Link>
  );
}
