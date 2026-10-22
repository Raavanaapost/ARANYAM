import { Bell, LogOut, Settings, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Dropdown, menuItemClass } from "@/components/ui/client";
import { Skeleton } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { getViewer, isActiveMember, isModerator, type Viewer } from "@/lib/auth/dal";
import { countUnread } from "@/lib/services/notifications";
import {
  ActiveNavList,
  ActiveTabBarList,
  LanguageSwitcher,
  LanguageSwitcherFallback,
  NavList,
  TabBarList,
  type NavItem,
} from "./nav";

function brand(locale: Locale, t: Dictionary) {
  return locale === "ta"
    ? { primary: t.meta.siteNameTamil, secondary: "Aranyam" }
    : { primary: "Aranyam", secondary: t.meta.siteNameTamil };
}

function Switcher() {
  return (
    <Suspense fallback={<LanguageSwitcherFallback />}>
      <LanguageSwitcher />
    </Suspense>
  );
}

function GuestButtons({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <>
      <ButtonLink href={`/${locale}/login`} variant="ghost" size="sm" className="whitespace-nowrap">
        {t.nav.login}
      </ButtonLink>
      <ButtonLink href={`/${locale}/register`} size="sm" className="hidden whitespace-nowrap sm:inline-flex">
        {t.nav.join}
      </ButtonLink>
    </>
  );
}

async function PublicAuthButtons({ locale, t }: { locale: Locale; t: Dictionary }) {
  const viewer = await getViewer();
  if (!viewer) return <GuestButtons locale={locale} t={t} />;
  return (
    <>
      <ButtonLink href={`/${locale}/feed`} size="sm" className="hidden whitespace-nowrap sm:inline-flex">
        {t.nav.openApp}
      </ButtonLink>
      <UserMenu viewer={viewer} locale={locale} t={t} />
    </>
  );
}

/** Header for the public pages: introduction, privacy promise, log in and join. */
export async function SiteHeader() {
  const { locale, t } = await getI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href={`/${locale}`} className="shrink-0 rounded-xl">
          <Logo {...brand(locale, t)} />
        </Link>
        <nav aria-label={t.nav.mainNavigation} className="hidden md:block">
          <PublicLinks locale={locale} t={t} />
        </nav>
        <div className="flex items-center gap-2">
          <Switcher />
          <Suspense fallback={<GuestButtons locale={locale} t={t} />}>
            <PublicAuthButtons locale={locale} t={t} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export function memberNavItems(locale: Locale, t: Dictionary): NavItem[] {
  return [
    { href: `/${locale}/feed`, label: t.nav.home, icon: "home" },
    { href: `/${locale}/groups`, label: t.nav.groups, icon: "groups" },
    { href: `/${locale}/events`, label: t.nav.events, icon: "events" },
    { href: `/${locale}/blogs`, label: t.nav.blogs, icon: "blogs" },
    { href: `/${locale}/news`, label: t.nav.news, icon: "news" },
  ];
}

function UserMenu({ viewer, locale, t }: { viewer: Viewer; locale: Locale; t: Dictionary }) {
  const active = isActiveMember(viewer);
  return (
    <Dropdown
      label={t.nav.accountMenu}
      triggerClassName="flex items-center rounded-full p-0.5 hover:ring-2 hover:ring-line-strong"
      trigger={<Avatar name={viewer.displayName} hue={viewer.avatarHue} size="md" />}
    >
      <div className="border-b border-line px-3 pt-2 pb-3">
        <p className="font-semibold text-ink">{viewer.displayName}</p>
        <p className="truncate text-sm text-muted">{viewer.email}</p>
      </div>
      <div className="py-1">
        {active ? (
          <Link href={`/${locale}/members/${viewer.id}`} className={menuItemClass}>
            <UserRound className="size-4 text-muted" aria-hidden="true" />
            {t.nav.profile}
          </Link>
        ) : null}
        <Link href={`/${locale}/settings`} className={menuItemClass}>
          <Settings className="size-4 text-muted" aria-hidden="true" />
          {t.nav.settings}
        </Link>
        {active ? (
          <Link href={`/${locale}/settings/invites`} className={menuItemClass}>
            <UserPlus className="size-4 text-muted" aria-hidden="true" />
            {t.nav.invite}
          </Link>
        ) : null}
        {isModerator(viewer) ? (
          <Link href={`/${locale}/admin`} className={menuItemClass}>
            <ShieldCheck className="size-4 text-muted" aria-hidden="true" />
            {t.nav.admin}
          </Link>
        ) : null}
      </div>
      {/* A real form post, so logging out reloads the page and clears everything kept in memory. */}
      <form action="/api/auth/logout" method="post" className="border-t border-line pt-1">
        <input type="hidden" name="lang" value={locale} />
        <button type="submit" className={menuItemClass}>
          <LogOut className="size-4 text-muted" aria-hidden="true" />
          {t.nav.logout}
        </button>
      </form>
    </Dropdown>
  );
}

async function MemberArea({ locale, t }: { locale: Locale; t: Dictionary }) {
  const viewer = await getViewer();
  if (!viewer) return <GuestButtons locale={locale} t={t} />;
  const unread = isActiveMember(viewer) ? await countUnread(viewer.id) : 0;
  return (
    <>
      {isActiveMember(viewer) ? (
        <Link
          href={`/${locale}/notifications`}
          className="relative flex size-10 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
          aria-label={unread ? `${t.nav.notifications} (${unread})` : t.nav.notifications}
        >
          <Bell className="size-5" aria-hidden="true" />
          {unread ? (
            <span className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-heart px-1 text-[0.7rem] leading-5 font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Link>
      ) : null}
      <UserMenu viewer={viewer} locale={locale} t={t} />
    </>
  );
}

/**
 * The member sections. Visitors reading public news get the public links
 * instead, since every member section would only ask them to log in.
 */
async function DesktopNav({ items, locale, t }: { items: NavItem[]; locale: Locale; t: Dictionary }) {
  if (!(await getViewer())) return <PublicLinks locale={locale} t={t} />;
  return <ActiveNavList items={items} />;
}

function PublicLinks({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <ul className="flex items-center gap-1 font-semibold text-muted">
      {(
        [
          ["about", t.nav.about],
          ["privacy", t.nav.privacy],
          ["news", t.nav.news],
        ] as const
      ).map(([path, label]) => (
        <li key={path}>
          <Link href={`/${locale}/${path}`} className="rounded-full px-3.5 py-2 hover:bg-sunken hover:text-ink">
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TabBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {children}
    </nav>
  );
}

async function MobileTabBar({ items, label }: { items: NavItem[]; label: string }) {
  if (!(await getViewer())) return null;
  return (
    <TabBar label={label}>
      <ActiveTabBarList items={items} />
    </TabBar>
  );
}

/** Header for the member area, with the five main sections. */
export async function AppHeader() {
  const { locale, t } = await getI18n();
  const items = memberNavItems(locale, t);
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3">
          <Link href={`/${locale}/feed`} className="shrink-0 rounded-xl">
            <Logo {...brand(locale, t)} />
          </Link>
          <nav aria-label={t.nav.mainNavigation} className="ml-4 hidden lg:block">
            <Suspense fallback={<NavList items={items} pathname={null} />}>
              <DesktopNav items={items} locale={locale} t={t} />
            </Suspense>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Switcher />
            <Suspense fallback={<Skeleton className="size-10 rounded-full" />}>
              <MemberArea locale={locale} t={t} />
            </Suspense>
          </div>
        </div>
      </header>
      <Suspense fallback={<TabBar label={t.nav.mainNavigation}>{<TabBarList items={items} pathname={null} />}</TabBar>}>
        <MobileTabBar items={items} label={t.nav.mainNavigation} />
      </Suspense>
    </>
  );
}

export async function SiteFooter({ compact = false }: { compact?: boolean }) {
  const { locale, t } = await getI18n();
  return (
    <footer className={compact ? "mt-12 pb-24 lg:pb-8" : "mt-16 border-t border-line bg-surface/60"}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink">{t.footer.madeWith}</p>
          <p>{t.footer.noAds}</p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 font-medium">
          <li>
            <Link href={`/${locale}/about`} className="hover:text-ink">
              {t.nav.about}
            </Link>
          </li>
          <li>
            <Link href={`/${locale}/privacy`} className="hover:text-ink">
              {t.nav.privacy}
            </Link>
          </li>
          <li>
            <Link href={`/${locale}/guidelines`} className="hover:text-ink">
              {t.nav.guidelines}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
