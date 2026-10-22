import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { SESSION_COOKIE } from "./constants";

/**
 * Secure cookies are only stored by browsers over HTTPS. Deciding per request
 * (instead of "always in production") keeps login working when the app is
 * served over plain HTTP, such as `npm start` on a laptop or a LAN address.
 */
async function isHttpsRequest(): Promise<boolean> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";
  return env.appUrl.startsWith("https://");
}

/** Call from a Server Action or Route Handler after creating a session. */
export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttpsRequest(),
    path: "/",
    expires: expiresAt,
  });
}

export async function readSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttpsRequest(),
    path: "/",
    maxAge: 0,
  });
}

/** Best-effort client details for rate limiting and the "where you're logged in" list. */
export async function getRequestMeta() {
  const h = await headers();
  const forwardedFor = env.trustProxy ? h.get("x-forwarded-for")?.split(",")[0]?.trim() : null;
  const ip = forwardedFor || h.get("x-real-ip") || "unknown";
  return { ip, userAgent: h.get("user-agent") ?? "" };
}
