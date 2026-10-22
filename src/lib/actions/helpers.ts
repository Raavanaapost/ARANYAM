import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { dictionaries, type Dictionary } from "@/i18n/dictionaries";
import type { PasswordProblem } from "@/lib/auth/password";
import type { FormState } from "@/lib/form-state";

/**
 * Server Actions cannot read the page's language from the URL, so every form
 * sends it in a hidden "lang" field.
 */
export function actionLocale(formData: FormData): { locale: Locale; t: Dictionary } {
  const value = formData.get("lang");
  const locale = isLocale(value) ? value : defaultLocale;
  return { locale, t: dictionaries[locale] };
}

/** A trimmed text field, cut to `max` characters. Missing fields become "". */
export function text(formData: FormData, name: string, max = 10_000): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** A text field exactly as typed, for passwords. */
export function rawText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function checked(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

/** One of a fixed list of values, or the fallback. */
export function oneOf<T extends string>(formData: FormData, name: string, options: readonly T[], fallback: T): T {
  const value = formData.get(name);
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function passwordMessage(t: Dictionary, issue: PasswordProblem): string {
  switch (issue) {
    case "too_short":
      return t.auth.errors.passwordTooShort;
    case "too_long":
      return t.auth.errors.passwordTooLong;
    case "too_common":
      return t.auth.errors.passwordTooCommon;
    case "matches_email":
      return t.auth.errors.passwordMatchesEmail;
  }
}

type FieldErrors = Record<string, string | undefined>;

/** Returns an error state when any field has a message, otherwise null. */
export function invalid(fieldErrors: FieldErrors, values?: Record<string, string>): FormState | null {
  const hasErrors = Object.values(fieldErrors).some(Boolean);
  return hasErrors ? { status: "error", fieldErrors, values } : null;
}

/** A link inside the site that is safe to send people to after an action. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
