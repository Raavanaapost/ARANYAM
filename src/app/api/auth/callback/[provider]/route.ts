import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/auth";
import { env } from "@/lib/env";

/**
 * Where Google and Facebook send families back after they agree to sign in.
 * This is the only part of Better Auth's web API that is switched on; it
 * finishes the sign-in that one of our Server Actions started.
 */
async function finishSocialSignIn(request: NextRequest, { params }: RouteContext<"/api/auth/callback/[provider]">) {
  const { provider } = await params;
  if (!env.socialProviders.some((enabled) => enabled === provider)) {
    return new NextResponse("Not found", { status: 404 });
  }
  return getAuth().handler(request);
}

export const GET = finishSocialSignIn;
// Some providers send the family back with a form post instead of a link.
export const POST = finishSocialSignIn;
