import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, type DatabaseContext } from "@/lib/db";
import { groupMembers, posts, sessions, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { hitRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { createSession, invalidateOtherSessions, listActiveSessions, validateSessionToken } from "@/lib/auth/session";
import type { Viewer } from "@/lib/auth/viewer";
import {
  approveMember,
  authenticate,
  confirmEmail,
  deleteAccount,
  findUserByEmail,
  registerAccount,
  requestPasswordReset,
  resetPasswordWithToken,
  suspendMember,
} from "@/lib/services/accounts";
import { exportUserData } from "@/lib/services/export";
import { createGroup, joinGroup } from "@/lib/services/groups";
import { createInvite } from "@/lib/services/invites";
import { createPost } from "@/lib/services/posts";
import { addPerson, closeTestDatabase, latestEmailLink, openTestDatabase } from "../support/database";

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

describe("joining Aranyam", () => {
  it("confirms the email, then waits for a moderator", async () => {
    const result = await registerAccount({
      displayName: "Divya",
      email: "  Divya@Example.com ",
      password: "our son loves trains",
      joinNote: "From Tirunelveli",
      locale: "en",
    });
    expect(result).toBe("created");

    const user = (await findUserByEmail("divya@example.com"))!;
    expect(user.email).toBe("divya@example.com");
    expect(user.status).toBe("pending");
    expect(user.emailVerifiedAt).toBeNull();

    const link = await latestEmailLink("divya@example.com");
    expect(link).toMatch(/^http:\/\/localhost:3000\/en\/verify-email\/.+/);
    const confirmed = await confirmEmail(tokenFrom(link));
    expect(confirmed?.emailVerifiedAt).not.toBeNull();
    expect(confirmed?.status).toBe("pending");

    expect(await approveMember(moderator.id, user.id)).toBe(true);
    expect((await findUserByEmail("divya@example.com"))?.status).toBe("approved");
  });

  it("does not reveal whether an email already has an account", async () => {
    await registerAccount({ displayName: "Ravi", email: "ravi@example.com", password: "a long walk home", joinNote: "", locale: "ta" });
    const second = await registerAccount({
      displayName: "Someone else",
      email: "RAVI@example.com",
      password: "another password here",
      joinNote: "",
      locale: "en",
    });
    expect(second).toBe("exists");
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
    expect(await authenticate("divya@example.com", "our son loves trains")).not.toBeNull();
    expect(await authenticate("divya@example.com", "wrong password")).toBeNull();
    expect(await authenticate("nobody@example.com", "our son loves trains")).toBeNull();
  });
});

describe("forgotten passwords", () => {
  it("resets with a link that works once and signs out every device", async () => {
    const user = (await findUserByEmail("divya@example.com"))!;
    await createSession(user.id, "Phone");
    await requestPasswordReset("DIVYA@example.com");
    const token = tokenFrom(await latestEmailLink("divya@example.com"));

    expect(await resetPasswordWithToken(token, "a brand new sentence")).not.toBeNull();
    expect(await resetPasswordWithToken(token, "trying the link again")).toBeNull();
    expect(await authenticate("divya@example.com", "a brand new sentence")).not.toBeNull();
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toEqual([]);
  });

  it("stays quiet about unknown emails", async () => {
    await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    expect(await latestEmailLink("nobody@example.com")).toBeNull();
  });
});

describe("sessions", () => {
  it("are found by their secret token, which is never stored", async () => {
    const person = await addPerson();
    const { token } = await createSession(person.id, "Chrome on Android");
    const [stored] = await db.select().from(sessions).where(eq(sessions.userId, person.id));
    expect(stored.id).not.toBe(token);
    expect((await validateSessionToken(token))?.user.id).toBe(person.id);
    expect(await validateSessionToken("not-a-real-token")).toBeNull();
  });

  it("expire", async () => {
    const person = await addPerson();
    const { token } = await createSession(person.id);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, person.id));
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("can be ended everywhere except this device", async () => {
    const person = await addPerson();
    const here = await createSession(person.id, "Laptop");
    await createSession(person.id, "Phone");
    const current = (await validateSessionToken(here.token))!.session.id;
    await invalidateOtherSessions(person.id, current);
    expect((await listActiveSessions(person.id)).map((session) => session.userAgent)).toEqual(["Laptop"]);
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
  });

  it("signs the paused person out", async () => {
    const member = await addPerson();
    const { token } = await createSession(member.id);
    await suspendMember(moderator.id, member.id);
    expect(await validateSessionToken(token)).toBeNull();
  });
});

describe("leaving Aranyam", () => {
  it("deletes the account and everything shared, and hands groups on", async () => {
    const leaving = await addPerson({ name: "Leaving" });
    const friend = await addPerson({ name: "Friend" });
    await db.update(users).set({ passwordHash: await hashPassword("goodbye for now") }).where(eq(users.id, leaving.id));

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
