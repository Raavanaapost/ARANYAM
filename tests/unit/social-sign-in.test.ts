import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

// Google and Facebook are set up before Better Auth is first built.
vi.stubEnv("GOOGLE_CLIENT_ID", "google-app");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
vi.stubEnv("FACEBOOK_CLIENT_ID", "facebook-app");
vi.stubEnv("FACEBOOK_CLIENT_SECRET", "facebook-secret");

const { db } = await import("@/lib/db");
const { accounts, invites, users } = await import("@/lib/db/schema");
const { getAuth } = await import("@/lib/auth/auth");
const { env } = await import("@/lib/env");
const { createInvite } = await import("@/lib/services/invites");
const { socialError } = await import("@/lib/social-errors");
const { withoutProviderTokens } = await import("@/lib/services/accounts");
const { addPerson, closeTestDatabase, latestEmailLink, openTestDatabase, setPassword } = await import(
  "../support/database"
);

type Database = Awaited<ReturnType<typeof openTestDatabase>>;
let database: Database;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase(database);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** An unsigned ID token, which is all Better Auth reads after the code exchange. */
function idToken(claims: Record<string, unknown>) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none" })}.${part({ iss: "https://accounts.google.com", aud: "google-app", ...claims })}.`;
}

type Profile = { id: string; email?: string; given_name?: string; first_name?: string; email_verified?: boolean };

/** Stands in for Google's and Facebook's servers during the sign-in. */
function fakeProviders(profile: Profile) {
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    if (url.host === "oauth2.googleapis.com") {
      return json({
        access_token: "google-access",
        refresh_token: "google-refresh",
        token_type: "Bearer",
        expires_in: 3600,
        id_token: idToken({
          sub: profile.id,
          email: profile.email,
          email_verified: profile.email_verified ?? true,
          given_name: profile.given_name,
          name: `${profile.given_name} Family`,
          picture: "https://lh3.googleusercontent.com/photo.jpg",
        }),
      });
    }
    if (url.host === "graph.facebook.com") {
      if (url.pathname.endsWith("/oauth/access_token")) {
        return json({ access_token: "facebook-access", token_type: "bearer", expires_in: 3600 });
      }
      if (url.pathname === "/debug_token") {
        return json({ data: { is_valid: true, app_id: "facebook-app", user_id: profile.id } });
      }
      if (url.pathname === "/me") {
        return json({
          id: profile.id,
          name: `${profile.first_name} Family`,
          first_name: profile.first_name,
          email: profile.email,
          picture: { data: { url: "https://graph.facebook.com/photo.jpg" } },
        });
      }
    }
    return realFetch(input, init);
  });
}

type Start = {
  provider: "google" | "facebook";
  requestSignUp?: boolean;
  additionalData?: Record<string, string>;
};

/**
 * Goes through a whole Google or Facebook sign-in the way the login and join
 * pages start it, and returns where the family's browser is sent at the end.
 */
async function signInWith({ provider, requestSignUp = false, additionalData = { locale: "en" } }: Start) {
  const { response, headers } = await getAuth().api.signInSocial({
    body: {
      provider,
      callbackURL: "/en/signed-in",
      errorCallbackURL: `/en/${requestSignUp ? "register" : "login"}?social=${provider}`,
      requestSignUp,
      disableRedirect: true,
      additionalData,
    },
    headers: new Headers(),
    returnHeaders: true,
  });
  const state = new URL(response.url ?? "").searchParams.get("state") ?? "";
  const cookie = headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  const callback = await getAuth().handler(
    new Request(`${env.appUrl}/api/auth/callback/${provider}?code=from-provider&state=${state}`, {
      headers: { cookie },
    }),
  );
  return {
    location: callback.headers.get("location") ?? "",
    signedIn: callback.headers.getSetCookie().some((line) => /session_token=[^;]/.test(line)),
  };
}

const userByEmail = async (email: string) => (await db.select().from(users).where(eq(users.email, email)))[0];
const accountsOf = (userId: string) => db.select().from(accounts).where(eq(accounts.userId, userId));

describe("joining with Google", () => {
  test("keeps only the email address and first name, the language, the note and the invite", async () => {
    const inviter = await addPerson({ name: "Inviter" });
    const code = await createInvite(inviter, "for a friend");
    const [invite] = await db.select().from(invites).where(eq(invites.code, code ?? ""));
    fakeProviders({ id: "g-1", email: "Meera@Example.test", given_name: "Meera" });

    const result = await signInWith({
      provider: "google",
      requestSignUp: true,
      additionalData: { locale: "ta", joinNote: "We would love to join.", inviteId: invite.id },
    });

    expect(result.location).toContain("/en/signed-in");
    const user = await userByEmail("meera@example.test");
    expect(user).toMatchObject({
      displayName: "Meera",
      image: null,
      locale: "ta",
      joinNote: "We would love to join.",
      emailVerified: true,
      inviteId: invite.id,
      invitedById: inviter.id,
    });
    // Google confirmed the address and the invite lets them straight in.
    expect(user.status).toBe("approved");
    const [account] = await accountsOf(user.id);
    expect(account).toMatchObject({ providerId: "google", accessToken: null, refreshToken: null, idToken: null });
  });

  test("waits for a moderator without an invite", async () => {
    fakeProviders({ id: "g-2", email: "ravi@example.test", given_name: "Ravi" });
    await signInWith({ provider: "google", requestSignUp: true, additionalData: { locale: "en", joinNote: "" } });
    expect((await userByEmail("ravi@example.test")).status).toBe("pending");
  });

  test("does not make an account from the login page", async () => {
    fakeProviders({ id: "g-3", email: "stranger@example.test", given_name: "Stranger" });
    const result = await signInWith({ provider: "google" });
    expect(result.location).toContain("/en/login?social=google");
    expect(result.location).toContain("error=signup_disabled");
    expect(result.signedIn).toBe(false);
    expect(await userByEmail("stranger@example.test")).toBeUndefined();
  });

  test("logs in a member whose confirmed email address matches", async () => {
    const member = await addPerson({ name: "Anu" });
    await setPassword(member.id, "a long password for anu");
    fakeProviders({ id: "g-4", email: member.email, given_name: "Someone Else" });

    const result = await signInWith({ provider: "google" });

    expect(result.location).toContain("/en/signed-in");
    expect(result.signedIn).toBe(true);
    // Their chosen name stays; Google's is not copied over.
    expect((await userByEmail(member.email)).displayName).toBe("Anu");
    expect((await accountsOf(member.id)).map((account) => account.providerId).sort()).toEqual(["credential", "google"]);
  });

  test("never takes over an account whose email address is not confirmed yet", async () => {
    const waiting = await addPerson({ name: "Unconfirmed", verified: false, status: "pending" });
    await setPassword(waiting.id, "a long password for them");
    fakeProviders({ id: "g-5", email: waiting.email, given_name: "Intruder" });

    const result = await signInWith({ provider: "google" });

    expect(result.location).toContain("error=account_not_linked");
    expect(result.signedIn).toBe(false);
    expect((await accountsOf(waiting.id)).map((account) => account.providerId)).toEqual(["credential"]);
  });
});

describe("joining with Facebook", () => {
  test("asks the family to confirm the email address, since Facebook does not vouch for it", async () => {
    fakeProviders({ id: "f-1", email: "lakshmi@example.test", first_name: "Lakshmi" });

    const result = await signInWith({
      provider: "facebook",
      requestSignUp: true,
      additionalData: { locale: "en", joinNote: "Hello" },
    });

    expect(result.location).toContain("/en/signed-in");
    const user = await userByEmail("lakshmi@example.test");
    expect(user).toMatchObject({ displayName: "Lakshmi", image: null, emailVerified: false, status: "pending" });
    expect(await latestEmailLink(user.email)).toContain("/verify-email/");
    const [account] = await accountsOf(user.id);
    expect(account).toMatchObject({ providerId: "facebook", accessToken: null, refreshToken: null, idToken: null });
  });

  test("explains when Facebook shares no email address", async () => {
    fakeProviders({ id: "f-2", first_name: "Private" });
    const result = await signInWith({ provider: "facebook", requestSignUp: true, additionalData: { locale: "en" } });
    expect(result.location).toContain("error=email_not_found");
  });
});

describe("the message after Google or Facebook sends a family back", () => {
  test("names the provider and explains what happened", () => {
    expect(socialError("google", "signup_disabled")).toEqual({ provider: "Google", key: "noAccount" });
    expect(socialError("facebook", "account_not_linked")).toEqual({ provider: "Facebook", key: "notLinked" });
    expect(socialError("facebook", "email_not_found")).toEqual({ provider: "Facebook", key: "noEmail" });
    expect(socialError("google", "access_denied")).toEqual({ provider: "Google", key: "cancelled" });
    expect(socialError("google", "something_new")).toEqual({ provider: "Google", key: "failed" });
  });

  test("shows nothing for an unknown provider or no error", () => {
    expect(socialError("twitter", "signup_disabled")).toBeNull();
    expect(socialError("google", undefined)).toBeNull();
    expect(socialError(undefined, "access_denied")).toBeNull();
  });
});

describe("provider settings", () => {
  test("offers only the providers whose keys are set", () => {
    expect(env.socialProviders).toEqual(["google", "facebook"]);
    vi.stubEnv("FACEBOOK_CLIENT_SECRET", "");
    expect(env.socialProviders).toEqual(["google"]);
    vi.stubEnv("FACEBOOK_CLIENT_SECRET", "facebook-secret");
  });

  test("drops access keys before they are stored", () => {
    expect(withoutProviderTokens({ providerId: "google", accessToken: "a", refreshToken: "r", idToken: "i" })).toEqual({
      providerId: "google",
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
    expect(withoutProviderTokens({ providerId: "google", scope: "email" })).toEqual({ providerId: "google", scope: "email" });
  });
});
