/** Helpers for reading the ?query part of a page address. */

export type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter that may appear more than once. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** One of the allowed values, or undefined. */
export function pickParam<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const first = firstParam(value);
  return allowed.find((option) => option === first);
}

/** A point in time from a ?before= cursor, ignoring anything malformed. */
export function dateParam(value: string | string[] | undefined): Date | undefined {
  const first = firstParam(value);
  if (!first || first.length > 40) return undefined;
  const date = new Date(first);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * A path on this site to return to after logging in, or null. Rejects anything
 * a browser could read as another site: "//host", backslashes, and control
 * characters or spaces, which browsers strip before following a link.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

/** Builds "?a=1&b=2" from the values that are set, or "" when none are. */
export function queryString(values: Record<string, string | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}
