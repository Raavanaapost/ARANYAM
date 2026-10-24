import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, type DatabaseContext } from "@/lib/db";
import { accounts, groupMembers, posts, sessions, users } from "@/lib/db/schema";
import { getAuth } from "@/lib/auth/auth";
import { hitRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import type { Viewer } from "@/lib/auth/viewer";
import {
  approveMember,
  changePassword,
  confirmEmail,
  createResetLinkFor,
  deleteAccount,
  findUserByEmail,
  isResetTokenValid,
  listActiveSessions,
  markEmailVerified,
  registerAccount,
  reinstateMember,
  requestPasswordReset,
  resetPasswordWithToken,
  signOutOtherDevices,
  suspendMember,
} from "@/lib/services/accounts";
import { exportUserData } from "@/lib/services/export";
import { createGroup, joinGroup } from "@/lib/services/groups";
import { createInvite } from "@/lib/services/invites";
import { createPost } from "@/lib/services/posts";
import { addPerson, closeTestDatabase, latestEmailLink, openTestDatabase, setPassword } from "../support/database";

let database: DatabaseContext;
let admin: Viewer;
let moderator: Viewer;

beforeAll(async () => {
  database = await openTestDatabase();
  admin = await addPerson({ name: "Admin", role: "admin" });
  moderator = await addPerson({ name: "Moderator", role: "moderator" });
});

afterAll(async () => {
  await closeTestDatabase(database);
});

const tokenFrom = (link: string | null) => link?.split("/").at(-1) ?? "";

/** Logs in through Better Auth and returns request headers carrying the session cookie. */
async function signIn(email: string, password: string, userAgent = "Test browser") {
  const { headers, response } = await getAuth().api.signInEmail({
    body: { email, password },
    headers: new Headers({ "user-agent": userAgent }),
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  return { userId: response.user.id, headers: new Headers({ cookie, "user-agent": userAgent }) };
}

/** True when the email and password log in. */
async function canLogIn(email: string, password: string) {
  return signIn(email, password).then(
    () => true,
    () => false,
  );
}

const currentSession = (headers: Headers) => getAuth().api.getSession({ headers });

describe("joining Aranyam", () => {
  it("confirms the email, then waits for a moderator", async () => {
    await registerAccount({
      displayName: "Divya",
      email: "  Divya@Example.com ",
      password: "our son loves trains",
      joinNote: "From Tirunelveli",
      locale: "en",
    });

    const user = (await findUserByEmail("divya@example.com"))!;
    expect(user.email).toBe("divya@example.com");
    expect(user.displayName).toBe("Divya");
    expect(user.joinNote).toBe("From Tirunelveli");
    expect(user.status).toBe("pending");
    expect(user.role).toBe("member");
    expect(user.emailVerified).toBe(false);
    expect(user.id).toMatch(/^[a-z2-9]{16}$/);

    const link = await latestEmailLink("divya@example.com");
    expect(link).toMatch(/^http:\/\/localhost:3000\/en\/verify-email\/.+/);
    const confirmed = await confirmEmail(tokenFrom(link));
    expect(confirmed?.emailVerified).toBe(true);
    expect(confirmed?.status).toBe("pending");
    // Opening the link again (as virus scanners do) is harmless.
    expect((await confirmEmail(tokenFrom(link)))?.id).toBe(user.id);
    expect(await confirmEmail("not-a-real-token")).toBeNull();
    expect(await confirmEmail(tokenFrom(link).slice(0, -2) + "xx")).toBeNull();

    expect(await approveMember(moderator.id, user.id)).toBe(true);
    expect((await findUserByEmail("divya@example.com"))?.status).toBe("approved");
  });

  it("does not reveal whether an email already has an account", async () => {
    await registerAccount({ displayName: "Ravi", email: "ravi@example.com", password: "a long walk home", joinNote: "", locale: "ta" });
    await expect(
      registerAccount({
        displayName: "Someone else",
        email: "RAVI@example.com",
        password: "another password here",
        joinNote: "",
        locale: "en",
      }),
    ).resolves.toBeUndefined();
    // The real owner is told by email instead, in their own language.
    const link = await latestEmailLink("ravi@example.com");
    expect(link).toContain("/ta/login");
    expect((await findUserByEmail("ravi@example.com"))?.displayName).toBe("Ravi");
  });

  it("welcomes families invited by a member straight in, once per invite", async () => {
    const priya = await addPerson({ name: "Priya" });
    const code = (await createInvite(priya, "Kavitha"))!;

    await registerAccount({ displayName: "Kavitha", email: "kavitha@example.com", password: "tea and good books", joinNote: "", locale: "en", inviteCode: code });
    const kavitha = await confirmEmail(tokenFrom(await latestEmailLink("kavitha@example.com")));
    expect(kavitha?.status).toBe("approved");
    expect(kavitha?.invitedById).toBe(priya.id);

    // The same link does not work twice.
    await registerAccount({ displayName: "Other", email: "other@example.com", password: "tea and good books", joinNote: "", locale: "en", inviteCode: code });
    const other = await confirmEmail(tokenFrom(await latestEmailLink("other@example.com")));
    expect(other?.status).toBe("pending");
  });

  it("checks passwords", async () => {
    expect(await canLogIn("divya@example.com", "our son loves trains")).toBe(true);
    expect(await canLogIn("DIVYA@example.com", "our son loves trains")).toBe(true);
    expect(await canLogIn("divya@example.com", "wrong password")).toBe(false);
    expect(await canLogIn("nobody@example.com", "our son loves trains")).toBe(false);
  });

  it("makes ADMIN_EMAILS admins as soon as they confirm", async () => {
    process.env.ADMIN_EMAILS = "founder@example.com";
    try {
      await registerAccount({ displayName: "Founder", email: "founder@example.com", password: "the very first one", joinNote: "", locale: "en" });
      const founder = await confirmEmail(tokenFrom(await latestEmailLink("founder@example.com")));
      expect(founder).toMatchObject({ role: "admin", status: "approved", emailVerified: true });
    } finally {
      process.env.ADMIN_EMAILS = "";
    }
  });

  it("never makes an ADMIN_EMAILS address an admin because a moderator vouched for it", async () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    try {
      // Someone else signs up with the owner's address and cannot open the email.
      await registerAccount({ displayName: "Not the owner", email: "owner@example.com", password: "pretending to be", joinNote: "", locale: "en" });
      const impostor = (await findUserByEmail("owner@example.com"))!;
      expect(await markEmailVerified(moderator.id, impostor.id)).toBe(true);
      expect(await findUserByEmail("owner@example.com")).toMatchObject({ role: "member", status: "pending" });
    } finally {
      process.env.ADMIN_EMAILS = "";
    }
  });

  it("ignores invites from members who are no longer welcome", async () => {
    const leaving = await addPerson({ name: "Paused inviter" });
    const code = (await createInvite(leaving, ""))!;
    await suspendMember(moderator.id, leaving.id);
    await registerAccount({ displayName: "Guest", email: "guest@example.com", password: "tea and good books", joinNote: "", locale: "en", inviteCode: code });
    const guest = await confirmEmail(tokenFrom(await latestEmailLink("guest@example.com")));
    expect(guest).toMatchObject({ status: "pending", inviteId: null, invitedById: null });
  });

  it("keeps passwords out of the users table", async () => {
    const user = (await findUserByEmail("divya@example.com"))!;
    expect(JSON.stringify(user)).not.toContain("scrypt$");
    const [account] = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    expect(account).toMatchObject({ providerId: "credential", accountId: user.id });
    expect(account.password).toMatch(/^scrypt\$32768\$8\$3\$/);
  });
});

describe("forgotten passwords", () => {
  it("resets with a link that works once and signs out every device", async () => {
    const user = (await findUserByEmail("divya@example.com"))!;
    await signIn("divya@example.com", "our son loves trains", "Phone");
    await requestPasswordReset("DIVYA@example.com");
    const link = await latestEmailLink("divya@example.com");
    expect(link).toMatch(/^http:\/\/localhost:3000\/en\/reset-password\/.+/);
    const token = tokenFrom(link);
    expect(await isResetTokenValid(token)).toBe(true);

    expect(await resetPasswordWithToken(token, "a brand new sentence")).not.toBeNull();
    expect(await resetPasswordWithToken(token, "trying the link again")).toBeNull();
    expect(await isResetTokenValid(token)).toBe(false);
    expect(await canLogIn("divya@example.com", "our son loves trains")).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toEqual([]);
    expect(await canLogIn("divya@example.com", "a brand new sentence")).toBe(true);
  });

  it("stores reset links hashed, so a copy of the database cannot use them", async () => {
    await requestPasswordReset("ravi@example.com");
    const token = tokenFrom(await latestEmailLink("ravi@example.com"));
    const rows = await db.execute<{ identifier: string; value: string }>(sql`select identifier, value from verifications`);
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(token);
  });

  it("confirms the email when a reset link is used", async () => {
    await registerAccount({ displayName: "Selvi", email: "selvi@example.com", password: "first try here", joinNote: "", locale: "ta" });
    await requestPasswordReset("selvi@example.com");
    const link = await latestEmailLink("selvi@example.com");
    expect(link).toContain("/ta/reset-password/");
    const selvi = await resetPasswordWithToken(tokenFrom(link), "second try here");
    expect(selvi?.emailVerified).toBe(true);
  });

  it("lets moderators make a one-hour reset link", async () => {
    const person = await addPerson({ name: "No email" });
    const link = (await createResetLinkFor(admin.id, person.id))!;
    expect(link).toMatch(/\/en\/reset-password\/[\w-]{40,}$/);
    expect(await resetPasswordWithToken(tokenFrom(link), "set by a moderator")).not.toBeNull();
    expect(await canLogIn(person.email, "set by a moderator")).toBe(true);
  });

  it("stays quiet about unknown emails", async () => {
    await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    expect(await latestEmailLink("nobody@example.com")).toBeNull();
  });
});

describe("sessions", () => {
  it("are kept in the database and checked on every request", async () => {
    const person = await addPerson();
    await setPassword(person.id, "my own password");
    const { headers } = await signIn(person.email, "my own password", "Chrome on Android");
    const session = await currentSession(headers);
    expect(session?.user.id).toBe(person.id);
    const [stored] = await db.select().from(sessions).where(eq(sessions.userId, person.id));
    expect(stored).toMatchObject({ userAgent: "Chrome on Android", ipAddress: "" });
    // The cookie is signed: the token alone (as stored in the database) is refused.
    expect(await currentSession(new Headers({ cookie: `aranyam.session_token=${stored.token}` }))).toBeNull();
    expect(await currentSession(new Headers({ cookie: "aranyam.session_token=forged.value" }))).toBeNull();
  });

  it("expire", async () => {
    const person = await addPerson();
    await setPassword(person.id, "my own password");
    const { headers } = await signIn(person.email, "my own password");
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, person.id));
    expect(await currentSession(headers)).toBeNull();
  });

  it("can be ended everywhere except this device", async () => {
    const person = await addPerson();
    await setPassword(person.id, "my own password");
    const here = await signIn(person.email, "my own password", "Laptop");
    const phone = await signIn(person.email, "my own password", "Phone");
    const current = (await currentSession(here.headers))!.session.id;
    await signOutOtherDevices(person.id, current);
    expect((await listActiveSessions(person.id)).map((session) => session.userAgent)).toEqual(["Laptop"]);
    expect(await currentSession(phone.headers)).toBeNull();
  });

  it("end on other devices when the password is changed", async () => {
    const person = await addPerson();
    await setPassword(person.id, "my own password");
    const here = await signIn(person.email, "my own password", "Laptop");
    const phone = await signIn(person.email, "my own password", "Phone");
    expect(await changePassword(here.headers, "not my password", "a new password")).toBe(false);
    expect(await changePassword(here.headers, "my own password", "a new password")).toBe(true);
    expect(await currentSession(phone.headers)).toBeNull();
    expect(await canLogIn(person.email, "my own password")).toBe(false);
    expect(await canLogIn(person.email, "a new password")).toBe(true);
  });
});

describe("rate limits", () => {
  it("count attempts per person and can be reset", async () => {
    const rule = { name: "test", limit: 2, windowMs: 60_000 };
    expect((await hitRateLimit(rule, "Someone@Example.com")).allowed).toBe(true);
    expect((await hitRateLimit(rule, "someone@example.com")).allowed).toBe(true);
    const blocked = await hitRateLimit(rule, "someone@example.com");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await hitRateLimit(rule, "another@example.com")).allowed).toBe(true);
    await resetRateLimit(rule, "someone@example.com");
    expect((await hitRateLimit(rule, "someone@example.com")).allowed).toBe(true);
  });
});

describe("pausing accounts", () => {
  it("follows the order of responsibility", async () => {
    const member = await addPerson();
    const otherModerator = await addPerson({ role: "moderator" });
    const otherAdmin = await addPerson({ role: "admin" });

    expect(await suspendMember(moderator.id, member.id)).toBe(true);
    expect(await suspendMember(moderator.id, otherModerator.id)).toBe(false);
    expect(await suspendMember(admin.id, otherModerator.id)).toBe(true);
    expect(await suspendMember(admin.id, otherAdmin.id)).toBe(false);
    expect(await suspendMember(admin.id, admin.id)).toBe(false);
    expect(await suspendMember(member.id, otherAdmin.id)).toBe(false);

    // Bringing people back follows the same order.
    expect(await reinstateMember(moderator.id, otherModerator.id)).toBe(false);
    expect(await reinstateMember(admin.id, otherModerator.id)).toBe(true);
    expect(await reinstateMember(otherAdmin.id, member.id)).toBe(true);
  });

  it("signs the paused person out and keeps them out", async () => {
    const member = await addPerson();
    await setPassword(member.id, "my own password");
    const { headers } = await signIn(member.email, "my own password");
    await suspendMember(moderator.id, member.id);
    expect(await currentSession(headers)).toBeNull();
    expect(await canLogIn(member.email, "my own password")).toBe(false);
  });
});

describe("leaving Aranyam", () => {
  it("deletes the account and everything shared, and hands groups on", async () => {
    const leaving = await addPerson({ name: "Leaving" });
    const friend = await addPerson({ name: "Friend" });
    await setPassword(leaving.id, "goodbye for now");

    const keptGroup = (await createGroup(leaving, { name: "Kept", description: "", privacy: "open", icon: "🌳", color: "green" }))!;
    await joinGroup(friend, keptGroup);
    const emptyGroup = (await createGroup(leaving, { name: "Empty", description: "", privacy: "open", icon: "🌳", color: "green" }))!;
    await createPost(leaving, { body: "Anonymous", kind: "thought", groupId: null, isAnonymous: true });

    expect(await deleteAccount(leaving.id, "wrong password")).toBe(false);
    expect(await deleteAccount(leaving.id, "goodbye for now")).toBe(true);

    expect(await db.select().from(users).where(eq(users.id, leaving.id))).toEqual([]);
    expect(await db.select().from(posts).where(eq(posts.authorId, leaving.id))).toEqual([]);
    const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, keptGroup));
    expect(members).toEqual([expect.objectContaining({ userId: friend.id, role: "owner" })]);
    expect(await db.select().from(groupMembers).where(eq(groupMembers.groupId, emptyGroup))).toEqual([]);
    // The password and sign-in records go too.
    expect(await db.select().from(accounts).where(eq(accounts.userId, leaving.id))).toEqual([]);
    expect(await db.select().from(sessions).where(eq(sessions.userId, leaving.id))).toEqual([]);
  });

  it("exports only the member's own data", async () => {
    const person = await addPerson({ name: "Exporter" });
    const other = await addPerson({ name: "Other" });
    await createPost(person, { body: "Mine", kind: "thought", groupId: null, isAnonymous: false });
    await createPost(other, { body: "Not mine", kind: "thought", groupId: null, isAnonymous: false });
    const data = await exportUserData(person.id);
    const text = JSON.stringify(data);
    expect(text).toContain("Mine");
    expect(text).not.toContain("Not mine");
    expect(text).not.toContain("password");
  });
});
