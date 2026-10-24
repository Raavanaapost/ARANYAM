import type { NextRequest } from "next/server";

/**
 * Cross-site request check for Route Handlers that change something. (Server
 * Actions get the same check from Next.js automatically.)
 */
export function isSameOrigin(request: NextRequest): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}
