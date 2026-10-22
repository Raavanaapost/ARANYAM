import { and, asc, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { groupMembers, groups, invites, users, type User, type UserRole } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { newId, randomHue } from "@/lib/ids";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { invalidateAllSessions } from "@/lib/auth/session";
import { createEmailToken, consumeEmailToken, peekEmailToken } from "@/lib/auth/tokens";
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
 * has an account, the owner gets a notice instead, and the caller shows the
 * same "check your email" message, so nobody can find out who is a member.
 */
export async function registerAccount(input: RegisterInput): Promise<"created" | "exists"> {
  const email = normalizeEmail(input.email);
  const existing = await findUserByEmail(email);
  // Hash in both branches so the response time does not reveal the answer.
  const passwordHash = await hashPassword(input.password);

  if (existing) {
    const locale = userLocale(existing);
    await sendEmail(
      existing.email,
      existingAccountMessage(locale, existing.displayName, links.login(locale), links.forgot(locale)),
    );
    return "exists";
  }

  const userId = newId();
  const created = await db.transaction(async (tx) => {
    let inviteId: string | null = null;
    let invitedById: string | null = null;
    if (input.inviteCode) {
      const [used] = await tx
        .update(invites)
        .set({ uses: sql`${invites.uses} + 1` })
        .where(
          and(
            eq(invites.code, input.inviteCode),
            isNull(invites.revokedAt),
            gt(invites.expiresAt, new Date()),
            lt(invites.uses, invites.maxUses),
          ),
        )
        .returning({ id: invites.id, createdById: invites.createdById });
      if (used) {
        inviteId = used.id;
        invitedById = used.createdById;
      }
    }
    const inserted = await tx
      .insert(users)
      .values({
        id: userId,
        email,
        passwordHash,
        displayName: input.displayName.trim(),
        joinNote: input.joinNote.trim(),
        locale: input.locale,
        avatarHue: randomHue(),
        inviteId,
        invitedById,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    return inserted.length > 0;
  });
  // Two sign-ups with the same email at the same moment: treat as existing.
  if (!created) return "exists";

  const token = await createEmailToken(userId, "verify_email");
  await sendEmail(email, verifyEmailMessage(input.locale, input.displayName.trim(), links.verify(input.locale, token)));
  return "created";
}

/** Sends a fresh confirmation link to an account that is not yet confirmed. */
export async function sendVerificationEmail(user: User) {
  if (user.emailVerifiedAt) return;
  const locale = userLocale(user);
  const token = await createEmailToken(user.id, "verify_email");
  await sendEmail(user.email, verifyEmailMessage(locale, user.displayName, links.verify(locale, token)));
}

/**
 * After an email is confirmed: admins listed in ADMIN_EMAILS are promoted,
 * and members who were invited (or every member, when approval is turned
 * off) are welcomed in straight away.
 */
async function applyPostVerification(user: User, approvedById: string | null) {
  const isConfiguredAdmin = env.adminEmails.includes(user.email);
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
      approvedById: approvedById ?? user.invitedById,
      role: isConfiguredAdmin ? "admin" : user.role,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

/**
 * Confirms an email address from the link we sent. The link is not used up,
 * because some email apps open links automatically to scan them; confirming
 * twice is harmless and the link expires after 48 hours.
 */
export async function confirmEmail(token: string): Promise<User | null> {
  const row = await peekEmailToken(token, "verify_email");
  if (!row) return null;
  const user = await findUserById(row.userId);
  if (!user) return null;
  if (!user.emailVerifiedAt) {
    const [updated] = await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    await applyPostVerification(updated, null);
  }
  return findUserById(user.id);
}

/** Checks an email and password. Takes the same time whether or not the account exists. */
export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return verifyAgainstDummy(password).then(() => null);
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email);
  if (!user) return;
  const locale = userLocale(user);
  const token = await createEmailToken(user.id, "reset_password");
  await sendEmail(user.email, resetPasswordMessage(locale, user.displayName, links.reset(locale, token)));
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  return (await peekEmailToken(token, "reset_password")) !== null;
}

/** The account a reset link belongs to, without using the link up. */
export async function findUserByResetToken(token: string): Promise<User | null> {
  const row = await peekEmailToken(token, "reset_password");
  return row ? findUserById(row.userId) : null;
}

/**
 * Sets a new password from a reset link. Every existing session is ended, and
 * the email counts as confirmed because the person just used their inbox.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<User | null> {
  const userId = await consumeEmailToken(token, "reset_password");
  if (!userId) return null;
  const user = await findUserById(userId);
  if (!user) return null;
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  await invalidateAllSessions(userId);
  if (!user.emailVerifiedAt) {
    const refreshed = await findUserById(userId);
    if (refreshed) await applyPostVerification(refreshed, null);
  }
  return findUserById(userId);
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await findUserById(userId);
  if (!user || !(await verifyPassword(current, user.passwordHash))) return false;
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
    .where(eq(users.id, userId));
  return true;
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
  await audit(moderatorId, "user.decline", { type: "user", id: userId });
  if (user.emailVerifiedAt) {
    await sendEmail(user.email, declinedMessage(userLocale(user), user.displayName));
  }
  return true;
}

export async function suspendMember(moderatorId: string, userId: string): Promise<boolean> {
  if (moderatorId === userId) return false;
  const [user] = await db
    .update(users)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(and(eq(users.id, userId), ne(users.role, "admin")))
    .returning({ id: users.id });
  if (!user) return false;
  await invalidateAllSessions(userId);
  await audit(moderatorId, "user.suspend", { type: "user", id: userId });
  return true;
}

export async function reinstateMember(moderatorId: string, userId: string): Promise<boolean> {
  const [user] = await db
    .update(users)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.status, "suspended")))
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
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)))
    .returning();
  if (!user) return false;
  await audit(moderatorId, "user.verify", { type: "user", id: userId });
  await applyPostVerification(user, null);
  return true;
}

/** A one-hour reset link a moderator can pass on privately (e.g. by WhatsApp). */
export async function createResetLinkFor(adminId: string, userId: string): Promise<string | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const token = await createEmailToken(userId, "reset_password");
  await audit(adminId, "user.reset_link", { type: "user", id: userId });
  return links.reset(userLocale(user), token);
}

/**
 * Deletes an account and everything the person shared. Groups they own are
 * handed to another group admin or member, or deleted when nobody is left.
 */
export async function deleteAccount(userId: string, password: string): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return false;
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
