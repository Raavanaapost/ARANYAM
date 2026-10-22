import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { invalidateSessionToken } from "@/lib/auth/session";
import { isHttpsRequest, isSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const lang = form?.get("lang");
  const locale = isLocale(lang) ? lang : defaultLocale;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSessionToken(token);

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/login`;
  url.search = "?loggedout=1";
  // 303 turns the POST into a normal page load of the login screen.
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsRequest(request),
    path: "/",
    maxAge: 0,
  });
  return response;
}
