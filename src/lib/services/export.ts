import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  articles,
  comments,
  eventRsvps,
  events,
  groupMembers,
  groups,
  invites,
  posts,
  users,
} from "@/lib/db/schema";

/**
 * Everything a member has shared, as plain data they can keep. Other people's
 * content is not included, only references to where the member took part.
 */
export async function exportUserData(userId: string) {
  const [profile] = await db
    .select({
      displayName: users.displayName,
      email: users.email,
      bio: users.bio,
      location: users.location,
      locale: users.locale,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  const [myPosts, myArticles, myComments, myEvents, myRsvps, myGroups, myInvites] = await Promise.all([
    db
      .select({
        id: posts.id,
        kind: posts.kind,
        body: posts.body,
        anonymous: posts.isAnonymous,
        groupId: posts.groupId,
        createdAt: posts.createdAt,
        editedAt: posts.editedAt,
      })
      .from(posts)
      .where(eq(posts.authorId, userId)),
    db
      .select({
        id: articles.id,
        type: articles.type,
        title: articles.title,
        summary: articles.summary,
        body: articles.body,
        tags: articles.tags,
        status: articles.status,
        anonymous: articles.isAnonymous,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(eq(articles.authorId, userId)),
    db
      .select({
        id: comments.id,
        body: comments.body,
        anonymous: comments.isAnonymous,
        postId: comments.postId,
        articleId: comments.articleId,
        eventId: comments.eventId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.authorId, userId)),
    db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        mode: events.mode,
        city: events.city,
        venue: events.venue,
        onlineUrl: events.onlineUrl,
      })
      .from(events)
      .where(eq(events.createdById, userId)),
    db
      .select({ eventId: eventRsvps.eventId, eventTitle: events.title, status: eventRsvps.status })
      .from(eventRsvps)
      .innerJoin(events, eq(events.id, eventRsvps.eventId))
      .where(eq(eventRsvps.userId, userId)),
    db
      .select({ groupId: groups.id, name: groups.name, role: groupMembers.role, status: groupMembers.status })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userId)),
    db
      .select({ note: invites.note, createdAt: invites.createdAt, expiresAt: invites.expiresAt, uses: invites.uses })
      .from(invites)
      .where(eq(invites.createdById, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile,
    posts: myPosts,
    articles: myArticles,
    comments: myComments,
    eventsOrganised: myEvents,
    eventResponses: myRsvps,
    groups: myGroups,
    invites: myInvites,
  };
}
