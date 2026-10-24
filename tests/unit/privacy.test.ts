import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseContext } from "@/lib/db";
import type { Viewer } from "@/lib/auth/viewer";
import { createArticle, getArticle, listArticles, listPublicNews } from "@/lib/services/articles";
import { addComment, listComments } from "@/lib/services/comments";
import { createEvent, getEditableEvent, getEvent, setRsvp, updateEvent, type EventInput } from "@/lib/services/events";
import { createGroup, getGroup, joinGroup, listDiscoverGroups, type GroupInput } from "@/lib/services/groups";
import { getMemberProfile } from "@/lib/services/members";
import { listNotifications } from "@/lib/services/notifications";
import { createPost, getPost, listPosts } from "@/lib/services/posts";
import { createReport, listOpenReports, revealReportAuthor } from "@/lib/services/reports";
import { listAuditLog } from "@/lib/services/admin";
import { addPerson, closeTestDatabase, openTestDatabase } from "../support/database";

let database: DatabaseContext;
let meena: Viewer; // moderator
let priya: Viewer;
let arun: Viewer;
let waiting: Viewer; // signed up, not yet welcomed in

const group = (privacy: GroupInput["privacy"], name: string): GroupInput => ({
  name,
  description: "",
  privacy,
  icon: "🌳",
  color: "green",
});

const article = (overrides: Partial<Parameters<typeof createArticle>[2]> = {}) => ({
  title: "Title",
  summary: "Summary",
  body: "Body text",
  tags: [],
  visibility: "members" as const,
  isAnonymous: false,
  sourceUrl: "",
  publish: true,
  ...overrides,
});

const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const event = (overrides: Partial<EventInput> = {}): EventInput => ({
  title: "Park morning",
  description: "",
  startsAt: inAWeek,
  endsAt: null,
  mode: "in_person",
  city: "Chennai",
  venue: "Tower Park, gate 2",
  onlineUrl: "",
  capacity: null,
  features: [],
  groupId: null,
  ...overrides,
});

beforeAll(async () => {
  database = await openTestDatabase();
  meena = await addPerson({ name: "Meena", role: "moderator" });
  priya = await addPerson({ name: "Priya" });
  arun = await addPerson({ name: "Arun" });
  waiting = await addPerson({ name: "Waiting", status: "pending" });
});

afterAll(async () => {
  await closeTestDatabase(database);
});

describe("anonymous sharing", () => {
  it("never shows who wrote an anonymous post, not even to moderators", async () => {
    const id = (await createPost(priya, { body: "Hard week", kind: "thought", groupId: null, isAnonymous: true }))!;
    for (const viewer of [arun, meena]) {
      const post = await getPost(viewer, id);
      expect(post?.author).toBeNull();
      expect(post?.isMine).toBe(false);
    }
    expect((await getPost(priya, id))?.isMine).toBe(true);
  });

  it("leaves anonymous posts out of a member's profile list", async () => {
    await createPost(priya, { body: "Signed post", kind: "tip", groupId: null, isAnonymous: false });
    const seenByArun = await listPosts(arun, { authorId: priya.id });
    expect(seenByArun.items.every((post) => !post.isAnonymous)).toBe(true);
    expect(seenByArun.items.map((post) => post.body)).toContain("Signed post");
    // Priya sees her own anonymous posts on her profile.
    const seenByPriya = await listPosts(priya, { authorId: priya.id });
    expect(seenByPriya.items.some((post) => post.isAnonymous)).toBe(true);
  });

  it("does not name anonymous commenters in notifications", async () => {
    const postId = (await createPost(priya, { body: "Question", kind: "question", groupId: null, isAnonymous: false }))!;
    await addComment(arun, { type: "post", id: postId }, { body: "Same here", isAnonymous: true });
    const [comment] = await listComments(priya, { type: "post", id: postId });
    expect(comment.author).toBeNull();
    const [notification] = await listNotifications(priya.id);
    expect(notification.actorName).toBeNull();
  });

  it("lets a moderator see who wrote reported anonymous content only through a logged reveal", async () => {
    const id = (await createPost(arun, { body: "Miracle cure!", kind: "tip", groupId: null, isAnonymous: true }))!;
    expect(await createReport(priya, { targetType: "post", targetId: id, reason: "misinformation", details: "" })).toBe(true);

    const report = (await listOpenReports(meena)).find((item) => item.targetId === id)!;
    expect(report.content?.authorName).toBeNull();

    expect(await revealReportAuthor(priya, report.id)).toBeNull();
    expect(await revealReportAuthor(meena, report.id)).toEqual({ id: arun.id, name: "Arun" });
    const log = await listAuditLog();
    expect(log.some((entry) => entry.action === "report.reveal" && entry.actorName === "Meena")).toBe(true);
  });

  it("keeps blogs anonymous but never news", async () => {
    const blogId = (await createArticle(priya, "blog", article({ isAnonymous: true })))!;
    expect((await getArticle(arun, blogId))?.author).toBeNull();
    const newsId = (await createArticle(meena, "news", article({ isAnonymous: true })))!;
    expect((await getArticle(arun, newsId))?.author?.id).toBe(meena.id);
  });
});

describe("groups", () => {
  it("keeps group posts inside the group", async () => {
    const groupId = (await createGroup(priya, group("private", "Coimbatore families")))!;
    const postId = (await createPost(priya, { body: "Group only", kind: "thought", groupId, isAnonymous: false }))!;

    expect(await getPost(arun, postId)).toBeNull();
    expect((await listPosts(arun)).items.map((post) => post.id)).not.toContain(postId);
    expect((await listPosts(arun, { groupId })).items).toEqual([]);
    // Not even moderators read private groups they are not part of.
    expect(await getPost(meena, postId)).toBeNull();

    // Asking to join is not enough; a group admin must say yes.
    expect(await joinGroup(arun, groupId, "Hello")).toBe("requested");
    expect(await getPost(arun, postId)).toBeNull();
  });

  it("does not let outsiders post into a group", async () => {
    const groupId = (await createGroup(priya, group("open", "Speech tips")))!;
    expect(await createPost(arun, { body: "Sneaky", kind: "thought", groupId, isAnonymous: false })).toBeNull();
    expect(await joinGroup(arun, groupId)).toBe("joined");
    expect(await createPost(arun, { body: "Hello all", kind: "thought", groupId, isAnonymous: false })).not.toBeNull();
  });

  it("hides hidden groups from everyone outside them", async () => {
    const groupId = (await createGroup(priya, group("hidden", "Dads' circle")))!;
    expect(await getGroup(arun, groupId)).toBeNull();
    expect(await getGroup(meena, groupId)).toBeNull();
    expect((await listDiscoverGroups(arun)).map((item) => item.id)).not.toContain(groupId);
    expect(await joinGroup(arun, groupId)).toBe("unavailable");
    expect((await getGroup(priya, groupId))?.isOwner).toBe(true);
  });
});

describe("events", () => {
  it("shares the address only with the organiser, moderators and families who responded", async () => {
    const id = (await createEvent(priya, event()))!;
    const before = await getEvent(arun, id);
    expect(before?.canSeePrivate).toBe(false);
    expect(before?.venue).toBe("");
    expect(before?.attendees).toEqual([]);

    expect((await getEvent(meena, id))?.venue).toBe("Tower Park, gate 2");
    expect(await setRsvp(arun, id, "interested")).toBe("ok");
    expect((await getEvent(arun, id))?.venue).toBe("Tower Park, gate 2");
  });

  it("keeps the meeting link of an online event private too", async () => {
    const id = (await createEvent(priya, event({ mode: "online", venue: "", onlineUrl: "https://meet.example/abc" })))!;
    expect((await getEvent(arun, id))?.onlineUrl).toBe("");
    expect((await getEvent(priya, id))?.onlineUrl).toBe("https://meet.example/abc");
  });

  it("keeps a group event's address inside the group, even from moderators", async () => {
    const groupId = (await createGroup(priya, group("hidden", "Mums' evening")))!;
    const id = (await createEvent(priya, event({ groupId, venue: "Priya's home" })))!;
    expect(await getEvent(meena, id)).toBeNull();
    expect(await getEditableEvent(meena, id)).toBeNull();
    expect(await updateEvent(meena, id, { ...event(), venue: "Changed" })).toBe(false);
    expect((await getEditableEvent(priya, id))?.venue).toBe("Priya's home");
  });

  it("respects the number of places", async () => {
    const id = (await createEvent(priya, event({ capacity: 2 })))!;
    expect(await setRsvp(arun, id, "going")).toBe("ok");
    expect(await setRsvp(meena, id, "going")).toBe("full");
    expect(await setRsvp(meena, id, "interested")).toBe("ok");
  });
});

describe("people who are not members yet", () => {
  it("see nothing until a moderator welcomes them in", async () => {
    const postId = (await createPost(priya, { body: "Members only", kind: "thought", groupId: null, isAnonymous: false }))!;
    expect(await getPost(waiting, postId)).toBeNull();
    expect((await listPosts(waiting)).items).toEqual([]);
    expect(await getMemberProfile(waiting, priya.id)).toBeNull();
    expect(await createPost(waiting, { body: "Hi", kind: "thought", groupId: null, isAnonymous: false })).toBeNull();
  });

  it("are not listed as members", async () => {
    expect(await getMemberProfile(priya, waiting.id)).toBeNull();
  });
});

describe("visitors who are not logged in", () => {
  it("only see news marked public, without any names", async () => {
    const publicId = (await createArticle(meena, "news", article({ title: "UDID camp", visibility: "public" })))!;
    const membersId = (await createArticle(meena, "news", article({ title: "Members news" })))!;
    const blogId = (await createArticle(priya, "blog", article({ title: "Our story" })))!;

    const visible = await getArticle(null, publicId);
    expect(visible?.title).toBe("UDID camp");
    expect(visible?.author).toBeNull();
    expect(await getArticle(null, membersId)).toBeNull();
    expect(await getArticle(null, blogId)).toBeNull();

    expect((await listArticles(null, { type: "blog" })).items).toEqual([]);
    const news = await listArticles(null, { type: "news" });
    expect(news.items.map((item) => item.id)).toEqual([publicId]);
    expect((await listPublicNews()).map((item) => item.id)).toEqual([publicId]);
  });

  it("never see drafts", async () => {
    const draftId = (await createArticle(meena, "news", article({ visibility: "public", publish: false })))!;
    expect(await getArticle(null, draftId)).toBeNull();
    expect(await getArticle(arun, draftId)).toBeNull();
    expect((await getArticle(meena, draftId))?.status).toBe("draft");
  });
});
