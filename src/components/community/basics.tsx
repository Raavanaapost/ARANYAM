import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { AnonymousAvatar, Avatar } from "@/components/ui/avatar";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDateTime, formatRelative } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { groupHue } from "@/lib/constants";
import { env } from "@/lib/env";
import type { AuthorView } from "@/lib/services/common";

/**
 * "3 hours ago", with the full date on hover. Only rendered inside request-time
 * parts of a page, where reading the clock is allowed.
 */
export function RelativeTime({ date, locale, t }: { date: Date; locale: Locale; t: Dictionary }) {
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date, locale, env.timezone)}>
      {/* eslint-disable-next-line react-hooks/purity -- a Server Component renders once per request */}
      {formatRelative(date, locale, Date.now(), t.time.justNow)}
    </time>
  );
}

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** Plain text with line breaks kept and web addresses turned into safe links. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <div className={cn("whitespace-pre-line [overflow-wrap:anywhere]", className)}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="font-medium text-primary underline"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </div>
  );
}

export function GroupIcon({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-8 text-base rounded-xl", md: "size-12 text-2xl rounded-2xl", lg: "size-16 text-4xl rounded-3xl" };
  return (
    <span
      aria-hidden="true"
      className={cn("hue-tile inline-flex shrink-0 items-center justify-center", sizes[size], className)}
      style={{ "--hue": groupHue(color) } as CSSProperties}
    >
      {icon}
    </span>
  );
}

/** Avatar and name, or the leaf for content shared without a name. */
export function AuthorLine({
  author,
  isMine,
  locale,
  t,
  meta,
  size = "md",
}: {
  author: AuthorView;
  isMine: boolean;
  locale: Locale;
  t: Dictionary;
  meta?: ReactNode;
  size?: "sm" | "md";
}) {
  const name = author ? author.displayName : isMine ? t.posts.youAnonymous : t.posts.anonymousParent;
  return (
    <div className="flex min-w-0 items-center gap-3">
      {author ? (
        <Link href={`/${locale}/members/${author.id}`} className="shrink-0 rounded-full">
          <Avatar name={author.displayName} hue={author.avatarHue} size={size === "sm" ? "sm" : "md"} />
        </Link>
      ) : (
        <AnonymousAvatar size={size === "sm" ? "sm" : "md"} />
      )}
      <div className="min-w-0 leading-tight">
        {author ? (
          <Link href={`/${locale}/members/${author.id}`} className="block truncate font-semibold text-ink hover:underline">
            {name}
          </Link>
        ) : (
          <span className="block truncate font-semibold text-ink">{name}</span>
        )}
        {meta ? <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">{meta}</div> : null}
      </div>
    </div>
  );
}

export type TabItem = { href: string; label: ReactNode; active: boolean; count?: number };

/** Tabs that are plain links, so each tab has its own address. */
export function LinkTabs({ items, label, className }: { items: TabItem[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4", className)}>
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 font-semibold transition-colors",
                item.active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {item.label}
              {item.count ? (
                <span className="rounded-full bg-heart px-1.5 text-xs leading-5 font-bold text-white">{item.count}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Small rounded filter links, e.g. post kinds or blog topics. */
export function Chips({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                item.active
                  ? "border-primary bg-primary text-on-primary"
                  : "border-line-strong bg-surface text-ink hover:bg-sunken",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * A form that runs a Server Action with a few hidden fields, for one-button
 * commands such as joining a group. The language goes along for messages.
 */
export function ActionForm({
  action,
  locale,
  fields,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: Locale;
  fields: Record<string, string>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form action={action} className={className}>
      <input type="hidden" name="lang" value={locale} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </form>
  );
}

/** "· " between items of a meta line, hidden from screen readers. */
export function Dot() {
  return <span aria-hidden="true">·</span>;
}

/** Like format(), but the {placeholders} can be links or other elements. */
export function Interpolate({ template, values }: { template: string; values: Record<string, ReactNode> }) {
  const parts = template.split(/\{(\w+)\}/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <Fragment key={index}>{part in values ? values[part] : `{${part}}`}</Fragment> : part,
      )}
    </>
  );
}
