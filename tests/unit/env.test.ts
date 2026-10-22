import { afterEach, describe, expect, test, vi } from "vitest";
import { env, smtpUrlWithPassword } from "@/lib/env";

describe("smtpUrlWithPassword", () => {
  test("adds the password without the spaces Gmail shows", () => {
    expect(smtpUrlWithPassword("smtps://family%40example.com@smtp.gmail.com:465", "abcd efgh ijkl mnop")).toBe(
      "smtps://family%40example.com:abcdefghijklmnop@smtp.gmail.com:465",
    );
  });

  test("replaces a password already in the URL and encodes special characters", () => {
    expect(smtpUrlWithPassword("smtps://mailer:old@smtp.example.com:465", "p@ss:w/rd%")).toBe(
      "smtps://mailer:p%40ss%3Aw%2Frd%25@smtp.example.com:465",
    );
  });

  test("leaves the URL alone without a password, or when it can't be read", () => {
    const url = "smtps://mailer:secret@smtp.example.com:465";
    expect(smtpUrlWithPassword(url, "")).toBe(url);
    expect(smtpUrlWithPassword(url, "   ")).toBe(url);
    expect(smtpUrlWithPassword("", "secret")).toBe("");
    expect(smtpUrlWithPassword("not a url", "secret")).toBe("not a url");
  });
});

describe("env.smtpUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("uses SMTP_PASSWORD and sends through SMTP", () => {
    // The test config picks the dev mailbox; clear it to get the default choice.
    vi.stubEnv("EMAIL_TRANSPORT", "");
    vi.stubEnv("SMTP_URL", "smtps://family%40example.com@smtp.gmail.com:465");
    vi.stubEnv("SMTP_PASSWORD", "abcd efgh ijkl mnop");
    expect(env.smtpUrl).toBe("smtps://family%40example.com:abcdefghijklmnop@smtp.gmail.com:465");
    expect(env.emailTransport).toBe("smtp");
  });
});
