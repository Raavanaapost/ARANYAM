import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, defaultLocale, isLocale, matchAcceptLanguage } from "@/i18n/config";
import { SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/constants";

/**
 * Pages anyone may open. Everything else needs a session cookie, so a new
 * member-only page is protected by default. This is only a fast first check:
 * every page and action still verifies the session against the database.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/privacy",
  "/guidelines",
  "/login",
  "/register",
  "/forgot-password",
  "/news",
]);
const PUBLIC_PREFIXES = ["/reset-password/", "/verify-email/", "/join/", "/news/", "/dev/"];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function preferredLocale(request: NextRequest) {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return matchAcceptLanguage(request.headers.get("accept-language")) ?? defaultLocale;
}

function isHttps(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return forwarded ? forwarded === "https" : request.nextUrl.protocol === "https:";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/");
  const isRead = request.method === "GET" || request.method === "HEAD";

  // Every page lives under /en or /ta. Send other paths to the right language.
  if (!isLocale(segments[1])) {
    if (!isRead) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = segments[1];
  const path = `/${segments.slice(2).join("/")}`.replace(/\/+$/, "") || "/";
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (isRead && !session && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(path + search)}`;
    return NextResponse.redirect(url);
  }

  // Lets Server Components know the current URL (used for "log in, then come back").
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-aranyam-path", pathname + search);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
    });
  }

  // Keep active members signed in: each visit pushes the cookie expiry forward.
  // The database session is extended separately when it is validated.
  if (isRead && session) {
    response.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps(request),
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
  }

  return response;
}

export const config = {
  // Skip API routes, Next.js internals and files such as /icon.svg or /robots.txt.
  matcher: ["/((?!api|_next|__next|.*\\..*).*)"],
};
