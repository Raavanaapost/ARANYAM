import { describe, expect, it } from "vitest";
import { matchAcceptLanguage, switchLocaleInPath } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { format, formatRelative, plural } from "@/i18n/format";

type Tree = { [key: string]: string | Tree };

/** Every "a.b.c" key with its text. */
function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(path, value);
    else for (const [childKey, childValue] of flatten(value, path)) result.set(childKey, childValue);
  }
  return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("Tamil and English dictionaries", () => {
  const en = flatten(dictionaries.en as unknown as Tree);
  const ta = flatten(dictionaries.ta as unknown as Tree);

  it("have exactly the same keys", () => {
    expect([...ta.keys()].filter((key) => !en.has(key))).toEqual([]);
    expect([...en.keys()].filter((key) => !ta.has(key))).toEqual([]);
  });

  it("use the same {placeholders} in every string", () => {
    const mismatched = [...en].filter(([key, text]) => placeholders(text).join() !== placeholders(ta.get(key) ?? "").join());
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });

  it("have no empty strings", () => {
    const empty = [...en, ...ta].filter(([, text]) => text.trim() === "").map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("are actually translated", () => {
    // English words left in the Tamil dictionary suggest a missed translation.
    // Language names are written in their own language, so "English" stays.
    const sameOnPurpose = new Set(["meta.siteName", "common.english"]);
    const tamilLetters = /[஀-௿]/;
    const untranslated = [...ta]
      .filter(([key]) => !sameOnPurpose.has(key))
      .filter(([key, text]) => {
        const words = text.replace(/\{\w+\}/g, "");
        return /[a-z]{4,}/i.test(words) && !tamilLetters.test(words) && text === en.get(key);
      })
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });
});

describe("formatting", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(format("Hello {name}, {missing}", { name: "Priya" })).toBe("Hello Priya, {missing}");
  });

  it("chooses plural forms per language", () => {
    const forms = { one: "{count} comment", other: "{count} comments" };
    expect(plural("en", 1, forms)).toBe("1 comment");
    expect(plural("en", 2, forms)).toBe("2 comments");
    expect(plural("en", 1200, forms)).toBe("1,200 comments");
  });

  it("describes times relative to now", () => {
    const now = Date.UTC(2026, 9, 22, 12, 0, 0);
    expect(formatRelative(new Date(now - 10_000), "en", now, "just now")).toBe("just now");
    expect(formatRelative(new Date(now - 3 * 60 * 60 * 1000), "en", now, "just now")).toBe("3 hours ago");
    expect(formatRelative(new Date(now - 24 * 60 * 60 * 1000), "en", now, "just now")).toBe("yesterday");
    expect(formatRelative(new Date(now - 3 * 60 * 60 * 1000), "ta", now, "இப்போது")).toMatch(/[஀-௿]/);
  });
});

describe("choosing a language", () => {
  it("follows the browser's preference", () => {
    expect(matchAcceptLanguage("ta-IN,ta;q=0.9,en;q=0.8")).toBe("ta");
    expect(matchAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
    expect(matchAcceptLanguage("fr-FR,ta;q=0.5")).toBe("ta");
    expect(matchAcceptLanguage("fr-FR")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });

  it("switches the language of a page address", () => {
    expect(switchLocaleInPath("/en/groups/abc", "ta")).toBe("/ta/groups/abc");
    expect(switchLocaleInPath("/ta", "en")).toBe("/en");
    expect(switchLocaleInPath("/", "ta")).toBe("/ta");
  });
});

describe("the site's own wording", () => {
  const en = flatten(dictionaries.en as unknown as Tree);
  const ta = flatten(dictionaries.ta as unknown as Tree);

  it("is called Aranyam Together in both languages", () => {
    expect(dictionaries.en.meta.siteName).toBe("Aranyam Together");
    expect(dictionaries.ta.meta.siteName).toBe("Aranyam Together");
  });

  it("speaks to families in general, without diagnosis labels or naming one community", () => {
    const enLabels = /autis|special needs|adhd|diagnos|therap|sensory|tamil famil/i;
    const taLabels = /ஆட்டிசம்|சிறப்புத் தேவை|தமிழ்க் குடும்ப|சிகிச்சை|மாற்றுத்திறன்/;
    expect([...en].filter(([, text]) => enLabels.test(text)).map(([key]) => key)).toEqual([]);
    expect([...ta].filter(([, text]) => taLabels.test(text)).map(([key]) => key)).toEqual([]);
  });

  it("has three slides with a title and words for every slideshow", () => {
    const pages = ["landing", "about", "feed", "groups", "events", "blogs", "news"] as const;
    for (const dictionary of [dictionaries.en, dictionaries.ta]) {
      for (const page of pages) {
        expect(dictionary.slides[page]).toHaveLength(3);
      }
    }
  });
});
