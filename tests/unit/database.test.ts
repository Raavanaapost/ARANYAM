import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { withoutClientOnlyParams } from "@/lib/db";

describe("Netlify Database migrations", () => {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  const netlifyDir = "netlify/database/migrations";

  test("match Drizzle's migrations file for file", () => {
    // Run `npx tsx scripts/sync-netlify-migrations.ts` (part of `npm run db:generate`) to fix.
    expect(readdirSync(netlifyDir).sort()).toEqual(journal.entries.map(({ tag }) => `${tag}.sql`));
    for (const { tag } of journal.entries) {
      expect(readFileSync(path.join(netlifyDir, `${tag}.sql`), "utf8")).toBe(
        readFileSync(path.join("drizzle", `${tag}.sql`), "utf8"),
      );
    }
  });

  test("use names Netlify accepts", () => {
    for (const file of readdirSync(netlifyDir)) {
      expect(file).toMatch(/^\d+_[a-z0-9_-]+\.sql$/);
    }
  });
});

describe("withoutClientOnlyParams", () => {
  test("drops channel_binding and keeps everything else", () => {
    expect(
      withoutClientOnlyParams("postgres://user:p%40ss@db.example.net/app?sslmode=require&channel_binding=require"),
    ).toBe("postgres://user:p%40ss@db.example.net/app?sslmode=require");
    expect(withoutClientOnlyParams("postgres://user:pass@db.example.net/app?channel_binding=require")).toBe(
      "postgres://user:pass@db.example.net/app",
    );
  });

  test("leaves other connection strings untouched", () => {
    const url = "postgres://user:pass@localhost:5432/app?sslmode=disable&application_name=aranyam";
    expect(withoutClientOnlyParams(url)).toBe(url);
    expect(withoutClientOnlyParams("postgres://localhost/app")).toBe("postgres://localhost/app");
  });
});
