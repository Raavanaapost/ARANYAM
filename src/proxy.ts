import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, defaultLocale, isLocale, matchAcceptLanguage, switchLocaleInPath, type Locale } from "@/i18n/config";
import { SESSION_COOKIE_NAMES, SESSION_DURATION_MS } from "@/lib/auth/constants";

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

/** Better Auth's session cookie, under whichever name this site uses. */
function sessionCookie(request: NextRequest) {
  for (const name of SESSION_COOKIE_NAMES) {
    const value = request.cookies.get(name)?.value;
    if (value) return { name, value };
  }
  return null;
}

/**
 * The language button links to /<language>/language until the page has loaded
 * and knows its own address. This sends the visitor to the page they were on
 * (from the same-site Referer), in the language they picked.
 */
function switchLanguage(request: NextRequest, locale: Locale) {
  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = `/${locale}`;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const from = new URL(referer);
      if (from.origin === request.nextUrl.origin && from.pathname.startsWith("/") && !from.pathname.startsWith("//")) {
        url.pathname = switchLocaleInPath(from.pathname, locale);
        url.search = from.search;
      }
    } catch {
      // A malformed Referer just goes to the home page.
    }
  }
  return NextResponse.redirect(url);
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
  const session = sessionCookie(request);

  if (isRead && path === "/language") return switchLanguage(request, locale);

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
  // Better Auth extends the database session separately (once a day), and
  // pages cannot set cookies themselves. The value is unchanged and signed.
  if (isRead && session) {
    response.cookies.set(session.name, session.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: session.name.startsWith("__Secure-"),
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
  }

  return response;
}

export const config = {
  // Skip API routes, Next.js internals and files such as /brand/icon-192.png or /robots.txt.
  matcher: ["/((?!api|_next|__next|.*\\..*).*)"],
};
