import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { SESSION_COOKIE_NAMES } from "./constants";

/** Removes the session cookie, e.g. after the account was deleted. */
export async function clearSessionCookie() {
  const store = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    if (store.has(name)) store.delete(name);
  }
}

/**
 * Best-effort client details for rate limiting. On Netlify the visitor's
 * address comes from Netlify's own header, which visitors cannot fake; the
 * first X-Forwarded-For entry can be typed in by anyone.
 */
export async function getRequestMeta() {
  const h = await headers();
  const netlifyIp = env.isNetlify ? h.get("x-nf-client-connection-ip")?.trim() : null;
  const forwardedFor = env.trustProxy ? h.get("x-forwarded-for")?.split(",")[0]?.trim() : null;
  const ip = netlifyIp || forwardedFor || h.get("x-real-ip") || "unknown";
  return { ip, userAgent: h.get("user-agent") ?? "" };
}
