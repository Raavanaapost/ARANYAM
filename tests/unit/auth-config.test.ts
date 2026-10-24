import { afterEach, describe, expect, test, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current, cookies: async () => new Map() }));

const { resolveAuthSecret } = await import("@/lib/auth/auth");
const { getRequestMeta } = await import("@/lib/auth/cookies");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the key that signs sessions and email links", () => {
  test("comes from BETTER_AUTH_SECRET when it is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "  a-long-random-secret-from-the-settings  ");
    expect(resolveAuthSecret()).toBe("a-long-random-secret-from-the-settings");
  });

  test("is derived from the database address on a public site without one, and stays the same", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NETLIFY_DB_URL", "postgres://user:s3cret@db.example.net/app");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = resolveAuthSecret();
    expect(first).toBe(resolveAuthSecret());
    expect(first).not.toContain("s3cret");
    expect(first.length).toBeGreaterThanOrEqual(40);
    vi.stubEnv("NETLIFY_DB_URL", "postgres://user:other@db.example.net/app");
    expect(resolveAuthSecret()).not.toBe(first);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("is required on a public site with no database address", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NETLIFY_DB_URL", "");
    expect(() => resolveAuthSecret()).toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe("the visitor's address for rate limits", () => {
  test("uses Netlify's own header on Netlify, which visitors cannot fake", async () => {
    vi.stubEnv("NETLIFY_DB_URL", "postgres://db.example.net/app");
    requestHeaders.current = new Headers({
      "x-forwarded-for": "1.2.3.4, 10.0.0.1",
      "x-nf-client-connection-ip": "203.0.113.7",
    });
    expect((await getRequestMeta()).ip).toBe("203.0.113.7");
  });

  test("ignores Netlify's header elsewhere", async () => {
    vi.stubEnv("NETLIFY_DB_URL", "");
    vi.stubEnv("TRUST_PROXY", "true");
    requestHeaders.current = new Headers({
      "x-forwarded-for": "198.51.100.2",
      "x-nf-client-connection-ip": "203.0.113.7",
    });
    expect((await getRequestMeta()).ip).toBe("198.51.100.2");
  });
});
