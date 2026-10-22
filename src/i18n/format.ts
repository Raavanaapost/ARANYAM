import { intlLocale, type Locale } from "./config";

export type PluralForms = { one: string; other: string };

/** Fills {placeholders} in a translated string. */
export function format(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Chooses the singular or plural form, then fills in {count}. */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const rule = new Intl.PluralRules(intlLocale[locale]).select(count);
  const template = rule === "one" ? forms.one : forms.other;
  return format(template, { count: new Intl.NumberFormat(intlLocale[locale]).format(count) });
}

export function formatDate(
  date: Date,
  locale: Locale,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { timeZone, ...options }).format(date);
}

export function formatDateTime(date: Date, locale: Locale, timeZone: string): string {
  return formatDate(date, locale, timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(date: Date, locale: Locale, timeZone: string): string {
  return formatDate(date, locale, timeZone, { hour: "numeric", minute: "2-digit" });
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** "3 hours ago" / "3 மணிநேரத்துக்கு முன்". `now` is passed in to keep this pure. */
export function formatRelative(
  date: Date,
  locale: Locale,
  now: number,
  justNow: string,
): string {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return justNow;
  const rtf = new Intl.RelativeTimeFormat(intlLocale[locale], { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (abs >= size || unit === "minute") {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return justNow;
}

/** Rough reading time for a blog, assuming ~200 words per minute. */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Short name of a time zone, e.g. "IST", for showing next to event times. */
export function timeZoneName(timeZone: string, locale: Locale, at: Date = new Date(0)): string {
  const part = new Intl.DateTimeFormat(intlLocale[locale], { timeZone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}
