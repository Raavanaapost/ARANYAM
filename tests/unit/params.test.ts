import { describe, expect, it } from "vitest";
import { dateParam, firstParam, pickParam, queryString, safeNextPath } from "@/lib/params";

describe("query parameters", () => {
  it("takes the first of repeated values", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("a")).toBe("a");
    expect(firstParam(undefined)).toBeUndefined();
  });

  it("only accepts allowed values", () => {
    const tabs = ["posts", "events"] as const;
    expect(pickParam("events", tabs)).toBe("events");
    expect(pickParam("admin", tabs)).toBeUndefined();
    expect(pickParam(["posts", "events"], tabs)).toBe("posts");
  });

  it("reads cursors and ignores junk", () => {
    expect(dateParam("2026-10-20T10:00:00.000Z")?.toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(dateParam("yesterday")).toBeUndefined();
    expect(dateParam("2".repeat(41))).toBeUndefined();
    expect(dateParam(undefined)).toBeUndefined();
  });

  it("builds query strings from the values that are set", () => {
    expect(queryString({ tab: "past", before: undefined, q: "" })).toBe("?tab=past");
    expect(queryString({ q: "அம்மா & co" })).toBe("?q=%E0%AE%85%E0%AE%AE%E0%AF%8D%E0%AE%AE%E0%AE%BE+%26+co");
    expect(queryString({})).toBe("");
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/feed")).toBe("/feed");
    expect(safeNextPath("/groups/abc?tab=events")).toBe("/groups/abc?tab=events");
  });

  it.each([
    ["another site", "https://evil.example"],
    ["a protocol-relative address", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a tab browsers would strip", "/\t/evil.example"],
    ["a line break", "/feed\nSet-Cookie: x"],
    ["a space", "/ /evil.example"],
    ["a relative path", "feed"],
    ["something very long", `/${"a".repeat(600)}`],
  ])("rejects %s", (_label, value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("rejects values that are not text", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(42)).toBeNull();
  });
});
