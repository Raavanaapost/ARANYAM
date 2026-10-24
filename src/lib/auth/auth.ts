import "server-only";
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, sessions, users, verifications } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import { AUTH_COOKIE_PREFIX, SESSION_DURATION_MS } from "./constants";
import { hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, verifyPassword } from "./password";
// Imported both ways round on purpose: accounts.ts calls getAuth(), and these
// functions are only called once a request is being handled.
import {
  afterEmailConfirmed,
  afterPasswordReset,
  claimInviteForNewAccount,
  sendExistingAccountNotice,
  sendResetEmail,
  sendVerificationLink,
} from "@/lib/services/accounts";

const DAY_SECONDS = 24 * 60 * 60;

/** Only for development and tests. Production must set BETTER_AUTH_SECRET. */
const DEVELOPMENT_SECRET = "aranyam-development-secret-not-for-production-use-0001";

/**
 * The key that signs session cookies and email confirmation links.
 *
 * BETTER_AUTH_SECRET should be set on every public site. If it is missing on a
 * site with a PostgreSQL database, a key is derived from the database
 * connection string (which holds the database password) so the site keeps
 * working, and a warning is logged. The key never changes unless the
 * connection string does, which would only sign everyone out.
 */
export function resolveAuthSecret(): string {
  const configured = process.env.BETTER_AUTH_SECRET?.trim();
  if (configured) return configured;
  if (!env.isProduction) return DEVELOPMENT_SECRET;
  const databaseUrl = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || "";
  if (!databaseUrl) {
    throw new Error("Set BETTER_AUTH_SECRET (generate one with: openssl rand -base64 32).");
  }
  console.warn("[auth] BETTER_AUTH_SECRET is not set; using a key derived from the database address.");
  return createHmac("sha256", "aranyam-auth-secret-v1").update(databaseUrl).digest("base64url");
}

function createAuth() {
  return betterAuth({
    appName: "Aranyam Together",
    baseURL: env.appUrl,
    secret: resolveAuthSecret(),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { users, sessions, accounts, verifications },
    }),
    // Better Auth is only used from the server (Server Actions, pages and the
    // logout and email-link routes). Its HTTP API is not mounted, so sign-up and
    // sign-in always go through our own checks: rate limits, invites, the
    // community agreement and password rules.
    telemetry: { enabled: false },
    rateLimit: { enabled: false },
    user: {
      modelName: "users",
      fields: { name: "displayName" },
      additionalFields: {
        locale: { type: "string", required: false, defaultValue: "en", returned: false },
        joinNote: { type: "string", required: false, defaultValue: "", returned: false },
        // Set from the invite link, then checked and claimed in the create hook.
        inviteId: { type: "string", required: false, returned: false },
        // Filled in only by the create hook, never from a form.
        invitedById: { type: "string", required: false, input: false, returned: false },
        avatarHue: { type: "number", required: false, input: false, returned: false },
      },
    },
    session: {
      modelName: "sessions",
      expiresIn: SESSION_DURATION_MS / 1000,
      // Push the expiry forward at most once a day while someone keeps visiting.
      updateAge: DAY_SECONDS,
      // Always read the session from the database, so suspending a member or
      // signing out other devices takes effect on the very next page.
      cookieCache: { enabled: false },
    },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications", storeIdentifier: "hashed" },
    emailAndPassword: {
      enabled: true,
      // Families still waiting for confirmation may log in, to resend the link
      // or read the "waiting" page. Member pages check confirmation themselves.
      requireEmailVerification: false,
      // Never log in on sign-up. This also makes Better Auth answer the same way
      // whether or not an email already has an account.
      autoSignIn: false,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      // Existing passwords were hashed with scrypt before Better Auth was added,
      // so Aranyam keeps its own (OWASP-recommended) scrypt settings.
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(password, hash),
      },
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, token }) => sendResetEmail(user.id, token),
      onPasswordReset: ({ user }) => afterPasswordReset(user.id),
      onExistingUserSignUp: ({ user }) => sendExistingAccountNotice(user.id),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      // Some email apps open links to scan them, so a link keeps working
      // (harmlessly) until it expires.
      expiresIn: 2 * DAY_SECONDS,
      sendVerificationEmail: ({ user, token }) => sendVerificationLink(user.id, token),
      afterEmailVerification: (user) => afterEmailConfirmed(user.id),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: await claimInviteForNewAccount(user) }),
        },
      },
      session: {
        create: {
          // Suspended members cannot start a session, whichever way they sign in.
          before: async (session) => {
            const [owner] = await db
              .select({ status: users.status })
              .from(users)
              .where(eq(users.id, session.userId))
              .limit(1);
            return Boolean(owner) && owner.status !== "suspended";
          },
        },
      },
    },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      // Members' IP addresses are not kept with their sessions.
      ipAddress: { disableIpTracking: true },
      database: { generateId: () => newId() },
    },
    // Sets the session cookie when Better Auth is called from a Server Action.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __aranyamAuth?: Auth };

/**
 * The Better Auth instance, created on first use so that building the site
 * never needs the secret or the database.
 */
export function getAuth(): Auth {
  globalForAuth.__aranyamAuth ??= createAuth();
  return globalForAuth.__aranyamAuth;
}

/** Better Auth's database helpers (sessions, reset links), for server code. */
export async function authInternals() {
  return (await getAuth().$context).internalAdapter;
}
