import { APIError, getOAuthState } from "better-auth/api";
import { and, asc, eq, gt, inArray, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import { decodeJwt } from "jose";
import { isLocale, type Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { groupMembers, groups, invites, sessions, users, verifications, type User, type UserRole } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { generateSecretToken, randomHue } from "@/lib/ids";
import { authInternals, getAuth } from "@/lib/auth/auth";
import { verifyPassword } from "@/lib/auth/password";
import {
  approvedMessage,
  declinedMessage,
  existingAccountMessage,
  resetPasswordMessage,
  verifyEmailMessage,
} from "@/lib/email/render";
import { sendEmail } from "@/lib/email/send";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Sign-up, sign-in, email links and sessions are handled by Better Auth
 * (src/lib/auth/auth.ts). This file holds what is particular to Aranyam:
 * invites, moderator approval, ADMIN_EMAILS, and the emails in two languages.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return user ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

function userLocale(user: Pick<User, "locale">): Locale {
  return user.locale === "ta" ? "ta" : "en";
}

export const links = {
  verify: (locale: Locale, token: string) => `${env.appUrl}/${locale}/verify-email/${token}`,
  reset: (locale: Locale, token: string) => `${env.appUrl}/${locale}/reset-password/${token}`,
  login: (locale: Locale) => `${env.appUrl}/${locale}/login`,
  forgot: (locale: Locale) => `${env.appUrl}/${locale}/forgot-password`,
  home: (locale: Locale) => `${env.appUrl}/${locale}/feed`,
};

/** An invite that can still be used, together with the member who created it. */
export async function findUsableInvite(code: string) {
  if (!code || code.length > 40) return null;
  const [row] = await db
    .select({ invite: invites, inviterName: users.displayName, inviterStatus: users.status })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.createdById))
    .where(
      and(
        eq(invites.code, code),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, new Date()),
        lt(invites.uses, invites.maxUses),
      ),
    )
    .limit(1);
  if (!row || row.inviterStatus !== "approved") return null;
  return row;
}

export type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
  joinNote: string;
  locale: Locale;
  inviteCode?: string;
};

/**
 * Creates an account and emails a confirmation link. When the email already
 * has an account, the owner gets a notice instead (see
 * sendExistingAccountNotice) and the caller shows the same "check your email"
 * message, so nobody can find out who is a member.
 */
export async function registerAccount(input: RegisterInput): Promise<void> {
  const email = normalizeEmail(input.email);
  const invite = input.inviteCode ? await findUsableInvite(input.inviteCode) : null;
  try {
    await getAuth().api.signUpEmail({
      body: {
        name: input.displayName.trim(),
        email,
        password: input.password,
        joinNote: input.joinNote.trim(),
        locale: input.locale,
        inviteId: invite?.invite.id,
      },
    });
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the second one
    // loses the race on the unique email. Treat it like any existing account.
    if (error instanceof APIError && (await findUserByEmail(email))) return;
    throw error;
  }
}

/**
 * Runs just before Better Auth stores a new account: picks the avatar colour
 * and uses up one place on the invite, if the family came with one. An invite
 * that has run out (or whose member left) is quietly ignored, and the family
 * waits for a moderator like everyone else.
 */
export async function claimInviteForNewAccount<T extends Record<string, unknown>>(user: T) {
  const inviteId = typeof user.inviteId === "string" ? user.inviteId : "";
  const data = { ...user, avatarHue: randomHue(), inviteId: null as string | null, invitedById: null as string | null };
  if (!inviteId) return data;
  const [used] = await db
    .update(invites)
    .set({ uses: sql`${invites.uses} + 1` })
    .where(
      and(
        eq(invites.id, inviteId),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, new Date()),
        lt(invites.uses, invites.maxUses),
        sql`exists (select 1 from ${users} where ${users.id} = ${invites.createdById} and ${users.status} = 'approved')`,
      ),
    )
    .returning({ id: invites.id, createdById: invites.createdById });
  return used ? { ...data, inviteId: used.id, invitedById: used.createdById } : data;
}

/**
 * What the "Request to join" page passed along when a family joins with Google
 * or Facebook: their language, their note for the moderators and the invite.
 * Better Auth keeps it with the sign-in and hands it back when the family
 * returns. Empty for every other kind of sign-up.
 */
export async function socialSignUpDetails(): Promise<{ locale?: Locale; joinNote?: string; inviteId?: string; image: null } | Record<string, never>> {
  const state = (await getOAuthState()) as Record<string, unknown> | null;
  if (!state) return {};
  return {
    image: null,
    ...(isLocale(state.locale) ? { locale: state.locale } : {}),
    ...(typeof state.joinNote === "string" ? { joinNote: state.joinNote.slice(0, 1000) } : {}),
    ...(typeof state.inviteId === "string" ? { inviteId: state.inviteId } : {}),
  };
}

/**
 * Runs once an account exists. Accounts made with an email and password are
 * never confirmed yet; Google vouches for its own addresses, so those families
 * are treated as if they had used our confirmation link.
 */
export async function afterAccountCreated(user: { id: string; emailVerified: boolean }) {
  if (user.emailVerified) await afterEmailConfirmed(user.id);
}

/** Drops Google and Facebook access keys before an account row is written. */
export function withoutProviderTokens<T extends Record<string, unknown>>(account: T): T {
  const copy: Record<string, unknown> = { ...account };
  for (const key of ["accessToken", "refreshToken", "idToken"]) {
    if (key in copy) copy[key] = null;
  }
  return copy as T;
}

/** Called by Better Auth with a new confirmation token. */
export async function sendVerificationLink(userId: string, token: string) {
  const user = await findUserById(userId);
  if (!user || user.emailVerified) return;
  const locale = userLocale(user);
  await sendEmail(user.email, verifyEmailMessage(locale, user.displayName, links.verify(locale, token)));
}

/** Someone tried to sign up with this account's email: tell the real owner. */
export async function sendExistingAccountNotice(userId: string) {
  const user = await findUserById(userId);
  if (!user) return;
  const locale = userLocale(user);
  await sendEmail(user.email, existingAccountMessage(locale, user.displayName, links.login(locale), links.forgot(locale)));
}

/** Sends a fresh confirmation link to an account that is not yet confirmed. */
export async function sendVerificationEmail(user: User) {
  if (user.emailVerified) return;
  await getAuth().api.sendVerificationEmail({ body: { email: user.email } });
}

/**
 * After an email is confirmed: admins listed in ADMIN_EMAILS are promoted,
 * and members who were invited (or every member, when approval is turned
 * off) are welcomed in straight away.
 *
 * ADMIN_EMAILS only counts when the person proved they can read that inbox
 * (a confirmation or reset link). A moderator vouching for an address must
 * never turn whoever signed up with it into an admin.
 */
async function applyPostVerification(user: User, { provedInbox }: { provedInbox: boolean }) {
  const isConfiguredAdmin = provedInbox && env.adminEmails.includes(user.email);
  const autoApprove =
    isConfiguredAdmin || !env.requireApproval || (env.invitesSkipApproval && user.inviteId !== null);
  if (user.status !== "pending" || !autoApprove) {
    if (isConfiguredAdmin && user.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    }
    return;
  }
  await db
    .update(users)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedById: user.invitedById,
      role: isConfiguredAdmin ? "admin" : user.role,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

/** Called by Better Auth once a confirmation link has been used. */
export async function afterEmailConfirmed(userId: string) {
  const user = await findUserById(userId);
  if (user) await applyPostVerification(user, { provedInbox: true });
}

/**
 * Confirms an email address from the link we sent. The link is not used up,
 * because some email apps open links automatically to scan them; confirming
 * twice is harmless and the link expires after 48 hours.
 */
export async function confirmEmail(token: string): Promise<User | null> {
  if (!token || token.length > 2000) return null;
  try {
    await getAuth().api.verifyEmail({ query: { token } });
  } catch (error) {
    if (error instanceof APIError) return null;
    throw error;
  }
  // Better Auth has checked the token's signature and expiry by now.
  const { email } = decodeJwt(token);
  return typeof email === "string" ? findUserByEmail(email) : null;
}

/** Emails a reset link when the address has an account. Says nothing either way. */
export async function requestPasswordReset(email: string) {
  await getAuth().api.requestPasswordReset({ body: { email: normalizeEmail(email) } });
}

/** Called by Better Auth with a new reset token. */
export async function sendResetEmail(userId: string, token: string) {
  const user = await findUserById(userId);
  if (!user) return;
  const locale = userLocale(user);
  await sendEmail(user.email, resetPasswordMessage(locale, user.displayName, links.reset(locale, token)));
}

/** The account a reset link belongs to, without using the link up. */
export async function findUserByResetToken(token: string): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const internal = await authInternals();
  const row = await internal.findVerificationValue(`reset-password:${token}`);
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return findUserById(row.value);
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  return (await findUserByResetToken(token)) !== null;
}

/**
 * Sets a new password from a reset link. The link works once, every existing
 * session is ended, and the email counts as confirmed because the person just
 * used their inbox (see afterPasswordReset).
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<User | null> {
  const user = await findUserByResetToken(token);
  if (!user) return null;
  try {
    await getAuth().api.resetPassword({ body: { token, newPassword } });
  } catch (error) {
    if (error instanceof APIError) return null;
    throw error;
  }
  return findUserById(user.id);
}

/** Called by Better Auth after a password was reset. */
export async function afterPasswordReset(userId: string) {
  const [updated] = await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.emailVerified, false)))
    .returning();
  if (updated) await applyPostVerification(updated, { provedInbox: true });
}

/** Checks a password against the account's stored hash. */
export async function checkAccountPassword(userId: string, password: string): Promise<boolean> {
  if (!password) return false;
  const account = await (await authInternals()).findCredentialAccount(userId);
  return account?.password ? verifyPassword(password, account.password) : false;
}

/**
 * Changes the password of the signed-in person. Every other device is signed
 * out; this browser gets a fresh session cookie.
 */
export async function changePassword(requestHeaders: Headers, current: string, next: string): Promise<boolean> {
  try {
    await getAuth().api.changePassword({
      body: { currentPassword: current, newPassword: next, revokeOtherSessions: true },
      headers: requestHeaders,
    });
    return true;
  } catch (error) {
    if (error instanceof APIError) return false;
    throw error;
  }
}

/** Reset links point at an account id; drop them when the account goes away. */
async function forgetResetLinks(userId: string) {
  await db.delete(verifications).where(eq(verifications.value, userId));
}

/** Ends every session of an account, e.g. when it is paused. */
export async function signOutEverywhere(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Signs a member out everywhere except the device they are using. */
export async function signOutOtherDevices(userId: string, currentSessionId: string) {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)));
}

/** Devices the person is logged in on, oldest first. */
export async function listActiveSessions(userId: string) {
  return db
    .select({ id: sessions.id, createdAt: sessions.createdAt, lastUsedAt: sessions.updatedAt, userAgent: sessions.userAgent })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(sessions.createdAt);
}

/* ----------------------------- Moderation ------------------------------ */

export async function approveMember(moderatorId: string, userId: string): Promise<boolean> {
  const [user] = await db
    .update(users)
    .set({ status: "approved", approvedAt: new Date(), approvedById: moderatorId, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.status, "pending")))
    .returning();
  if (!user) return false;
  await audit(moderatorId, "user.approve", { type: "user", id: userId });
  await notify({ userId, type: "membership_approved", link: "/feed" });
  const locale = userLocale(user);
  await sendEmail(user.email, approvedMessage(locale, user.displayName, links.home(locale)));
  return true;
}

export async function declineMember(moderatorId: string, userId: string): Promise<boolean> {
  const [user] = await db
    .delete(users)
    .where(and(eq(users.id, userId), eq(users.status, "pending")))
    .returning();
  if (!user) return false;
  await forgetResetLinks(userId);
  await audit(moderatorId, "user.decline", { type: "user", id: userId });
  if (user.emailVerified) {
    await sendEmail(user.email, declinedMessage(userLocale(user), user.displayName));
  }
  return true;
}

/** Moderators can pause members; only an admin can pause a moderator, and nobody can pause an admin. */
export async function suspendMember(moderatorId: string, userId: string): Promise<boolean> {
  if (moderatorId === userId) return false;
  const actor = await findUserById(moderatorId);
  if (!actor || actor.status !== "approved" || actor.role === "member") return false;
  const protectedRoles: UserRole[] = actor.role === "admin" ? ["admin"] : ["admin", "moderator"];
  const [user] = await db
    .update(users)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(and(eq(users.id, userId), notInArray(users.role, protectedRoles)))
    .returning({ id: users.id });
  if (!user) return false;
  await signOutEverywhere(userId);
  await audit(moderatorId, "user.suspend", { type: "user", id: userId });
  return true;
}

/** The same order of responsibility as pausing: only an admin can bring back a moderator. */
export async function reinstateMember(moderatorId: string, userId: string): Promise<boolean> {
  const actor = await findUserById(moderatorId);
  if (!actor || actor.status !== "approved" || actor.role === "member") return false;
  const protectedRoles: UserRole[] = actor.role === "admin" ? ["admin"] : ["admin", "moderator"];
  const [user] = await db
    .update(users)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.status, "suspended"), notInArray(users.role, protectedRoles)))
    .returning({ id: users.id });
  if (!user) return false;
  await audit(moderatorId, "user.reinstate", { type: "user", id: userId });
  return true;
}

export async function setMemberRole(adminId: string, userId: string, role: UserRole): Promise<boolean> {
  if (adminId === userId) return false;
  const [user] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.status, "approved")))
    .returning({ id: users.id });
  if (!user) return false;
  await audit(adminId, "user.role", { type: "user", id: userId }, { role });
  return true;
}

/** For when a family cannot receive our emails: a moderator vouches for the address. */
export async function markEmailVerified(moderatorId: string, userId: string): Promise<boolean> {
  const [user] = await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.emailVerified, false)))
    .returning();
  if (!user) return false;
  await audit(moderatorId, "user.verify", { type: "user", id: userId });
  await applyPostVerification(user, { provedInbox: false });
  return true;
}

/** A one-hour reset link a moderator can pass on privately (e.g. by WhatsApp). */
export async function createResetLinkFor(adminId: string, userId: string): Promise<string | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  // The same kind of link Better Auth emails, so the reset page accepts it.
  const token = generateSecretToken();
  await (await authInternals()).createVerificationValue({
    identifier: `reset-password:${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await audit(adminId, "user.reset_link", { type: "user", id: userId });
  return links.reset(userLocale(user), token);
}

/**
 * Deletes an account and everything the person shared. Groups they own are
 * handed to another group admin or member, or deleted when nobody is left.
 */
export async function deleteAccount(userId: string, password: string): Promise<boolean> {
  if (!(await checkAccountPassword(userId, password))) return false;
  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(and(eq(groupMembers.userId, userId), eq(groupMembers.role, "owner")));
    for (const { groupId } of owned) {
      const [successor] = await tx
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            ne(groupMembers.userId, userId),
            eq(groupMembers.status, "active"),
          ),
        )
        .orderBy(sql`case when ${groupMembers.role} = 'admin' then 0 else 1 end`, asc(groupMembers.createdAt))
        .limit(1);
      if (successor) {
        await tx
          .update(groupMembers)
          .set({ role: "owner" })
          .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, successor.userId)));
      } else {
        await tx.delete(groups).where(eq(groups.id, groupId));
      }
    }
    await tx.delete(users).where(eq(users.id, userId));
  });
  await forgetResetLinks(userId);
  return true;
}

export async function updateProfile(
  userId: string,
  input: { displayName: string; bio: string; location: string; locale: Locale },
) {
  await db
    .update(users)
    .set({
      displayName: input.displayName.trim(),
      bio: input.bio.trim(),
      location: input.location.trim(),
      locale: input.locale,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function setPreferredLocale(userId: string, locale: Locale) {
  await db.update(users).set({ locale }).where(and(eq(users.id, userId), ne(users.locale, locale)));
}

export async function getUsersByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({ id: users.id, displayName: users.displayName, avatarHue: users.avatarHue })
    .from(users)
    .where(inArray(users.id, ids));
}
