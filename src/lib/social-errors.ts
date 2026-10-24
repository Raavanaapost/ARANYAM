import { SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/constants";

export type SocialErrorKey = "noAccount" | "notLinked" | "noEmail" | "cancelled" | "failed";

const PROVIDER_NAMES: Record<SocialProvider, string> = { google: "Google", facebook: "Facebook" };

/**
 * When Google or Facebook sends a family back without signing them in, the
 * page gets `?social=<provider>&error=<code>`. This turns that into which
 * message to show, or null when the address carries nothing to explain.
 */
export function socialError(
  provider: string | undefined,
  code: string | undefined,
): { provider: string; key: SocialErrorKey } | null {
  if (!provider || !code || !(SOCIAL_PROVIDERS as readonly string[]).includes(provider)) return null;
  const name = PROVIDER_NAMES[provider as SocialProvider];
  switch (code.toLowerCase()) {
    case "signup_disabled":
      return { provider: name, key: "noAccount" };
    case "account_not_linked":
      return { provider: name, key: "notLinked" };
    case "email_not_found":
      return { provider: name, key: "noEmail" };
    case "access_denied":
      return { provider: name, key: "cancelled" };
    default:
      return { provider: name, key: "failed" };
  }
}
