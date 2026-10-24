/**
 * Runtime configuration, read from environment variables on each access so
 * that a build can be configured differently per deployment.
 * See .env.example for documentation of every variable.
 */

function flag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Puts SMTP_PASSWORD into SMTP_URL, so the password can be pasted on its own
 * instead of being encoded into the URL. Spaces are removed because Gmail shows
 * app passwords in groups of four.
 */
export function smtpUrlWithPassword(smtpUrl: string, password: string): string {
  const compact = password.replace(/\s+/g, "");
  if (!smtpUrl || !compact) return smtpUrl;
  try {
    const url = new URL(smtpUrl);
    url.password = encodeURIComponent(compact);
    return url.toString();
  } catch {
    return smtpUrl;
  }
}

export type EmailTransport = "smtp" | "dev" | "log";

export const env = {
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  /** Public base URL, used to build links in emails. */
  get appUrl() {
    return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  },
  get requireApproval() {
    return flag("REQUIRE_APPROVAL", true);
  },
  get invitesSkipApproval() {
    return flag("INVITES_SKIP_APPROVAL", true);
  },
  get adminEmails(): string[] {
    return (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  },
  /** Time zone used to enter and display event times. */
  get timezone() {
    return process.env.APP_TIMEZONE || "Asia/Kolkata";
  },
  get smtpUrl() {
    return smtpUrlWithPassword(process.env.SMTP_URL ?? "", process.env.SMTP_PASSWORD ?? "");
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "Aranyam <no-reply@localhost>";
  },
  get emailTransport(): EmailTransport {
    const configured = process.env.EMAIL_TRANSPORT?.trim().toLowerCase();
    if (configured === "smtp" || configured === "dev" || configured === "log") {
      return configured;
    }
    if (this.smtpUrl) return "smtp";
    return this.isProduction ? "log" : "dev";
  },
  /**
   * The development mailbox shows every email (including password reset links)
   * to anyone who opens it, so a production build only enables it with an
   * explicit, scary opt-in used by the automated test suite.
   */
  get devMailboxEnabled() {
    if (this.emailTransport !== "dev") return false;
    return !this.isProduction || flag("DANGEROUSLY_ALLOW_DEV_MAILBOX", false);
  },
  /** Running on Netlify, which provides the database and the visitor's address. */
  get isNetlify() {
    return Boolean(process.env.NETLIFY_DB_URL) || process.env.NETLIFY === "true";
  },
  /** Trust X-Forwarded-For for rate limiting (true behind a reverse proxy). */
  get trustProxy() {
    return flag("TRUST_PROXY", true);
  },
};
