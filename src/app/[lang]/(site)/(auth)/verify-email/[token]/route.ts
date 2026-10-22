import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { validateSessionToken } from "@/lib/auth/session";
import { confirmEmail } from "@/lib/services/accounts";

/**
 * The link in the confirmation email. Confirming does not log anyone in, and
 * the link keeps working until it expires, because some email apps open links
 * automatically to check them for viruses.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/[lang]/verify-email/[token]">) {
  const { lang, token } = await ctx.params;
  const locale = isLocale(lang) ? lang : defaultLocale;
  const user = await confirmEmail(token);

  const url = request.nextUrl.clone();
  url.search = "";
  if (!user) {
    url.pathname = `/${locale}/login`;
    url.search = "?verify=invalid";
    return NextResponse.redirect(url, 303);
  }

  // Already logged in on this device as the same person: carry on into the site.
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = sessionToken ? await validateSessionToken(sessionToken) : null;
  if (session?.user.id === user.id) {
    url.pathname = `/${locale}/${user.status === "approved" ? "feed" : "pending"}`;
  } else {
    url.pathname = `/${locale}/login`;
    url.search = "?verified=1";
  }
  return NextResponse.redirect(url, 303);
}
