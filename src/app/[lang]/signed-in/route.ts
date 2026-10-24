import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getViewer } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/params";

/**
 * After Google or Facebook: sends the family to the page that fits their
 * account, just like the login form does.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/signed-in">) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : defaultLocale;
  const viewer = await getViewer();
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const path = !viewer
    ? "/login"
    : !viewer.emailVerified
      ? "/verify-email"
      : viewer.status !== "approved"
        ? "/pending"
        : (next ?? "/feed");
  return NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
}
