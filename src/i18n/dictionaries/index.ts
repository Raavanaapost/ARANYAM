import type { Locale } from "../config";
import en, { type Dictionary } from "./en";
import ta from "./ta";

export type { Dictionary };

export const dictionaries: Record<Locale, Dictionary> = { en, ta };

export function getDictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}
