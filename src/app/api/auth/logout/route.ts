import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getAuth } from "@/lib/auth/auth";
import { isSameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const lang = form?.get("lang");
  const locale = isLocale(lang) ? lang : defaultLocale;

  // Ends the session in the database and returns the headers that clear the cookie.
  const signOut = await getAuth()
    .api.signOut({ headers: request.headers, returnHeaders: true })
    .catch(() => null);

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/login`;
  url.search = "?loggedout=1";
  // 303 turns the POST into a normal page load of the login screen.
  const response = NextResponse.redirect(url, 303);
  for (const cookie of signOut?.headers.getSetCookie() ?? []) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
