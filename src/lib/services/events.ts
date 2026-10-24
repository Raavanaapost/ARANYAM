import { and, asc, count, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  eventRsvps,
  events,
  groups,
  users,
  type EventFeature,
  type EventMode,
  type RsvpStatus,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { isActiveMember, isModerator, type Viewer } from "@/lib/auth/viewer";
import { audit } from "./audit";
import { activeGroupIds, isActiveGroupMember } from "./common";
import { notify } from "./notifications";

export type EventListItem = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  mode: EventMode;
  city: string;
  capacity: number | null;
  features: EventFeature[];
  cancelled: boolean;
  group: { id: string; name: string; icon: string } | null;
  goingCount: number;
  interestedCount: number;
  myRsvp: RsvpStatus | null;
  isMine: boolean;
};

export type Attendee = { id: string; displayName: string; avatarHue: number; status: RsvpStatus };

export type EventDetail = EventListItem & {
  description: string;
  organiser: { id: string; displayName: string; avatarHue: number } | null;
  removed: boolean;
  /** Organisers, moderators and families who responded see the address or link. */
  canSeePrivate: boolean;
  venue: string;
  onlineUrl: string;
  attendees: Attendee[];
  canEdit: boolean;
  canRemove: boolean;
  isFull: boolean;
};

// Conditions inside these subqueries are nested SQL on purpose: in a select without
// joins, Drizzle drops table names from columns written directly in the template,
// and an unqualified "id" would then match the inner table instead of the outer one.
const goingCount = sql<number>`(select count(*) from ${eventRsvps} where ${and(eq(eventRsvps.eventId, events.id), eq(eventRsvps.status, "going"))})`;
const interestedCount = sql<number>`(select count(*) from ${eventRsvps} where ${and(eq(eventRsvps.eventId, events.id), eq(eventRsvps.status, "interested"))})`;

function listFields(viewer: Viewer) {
  return {
    id: events.id,
    title: events.title,
    startsAt: events.startsAt,
    endsAt: events.endsAt,
    mode: events.mode,
    city: events.city,
    capacity: events.capacity,
    features: events.features,
    cancelledAt: events.cancelledAt,
    createdById: events.createdById,
    groupId: events.groupId,
    groupName: groups.name,
    groupIcon: groups.icon,
    goingCount,
    interestedCount,
    myRsvp: sql<RsvpStatus | null>`(select ${sql`${eventRsvps.status}`} from ${eventRsvps} where ${and(eq(eventRsvps.eventId, events.id), eq(eventRsvps.userId, viewer.id))})`,
  };
}

type ListRow = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  mode: EventMode;
  city: string;
  capacity: number | null;
  features: string[];
  cancelledAt: Date | null;
  createdById: string;
  groupId: string | null;
  groupName: string | null;
  groupIcon: string | null;
  goingCount: number;
  interestedCount: number;
  myRsvp: RsvpStatus | null;
};

function toListItem(row: ListRow, viewer: Viewer): EventListItem {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    mode: row.mode,
    city: row.city,
    capacity: row.capacity,
    features: row.features as EventFeature[],
    cancelled: row.cancelledAt !== null,
    group: row.groupId ? { id: row.groupId, name: row.groupName ?? "", icon: row.groupIcon ?? "🌳" } : null,
    goingCount: Number(row.goingCount),
    interestedCount: Number(row.interestedCount),
    myRsvp: row.myRsvp,
    isMine: row.createdById === viewer.id,
  };
}

/** Events shared with everyone, or in the viewer's groups. */
async function visibilityCondition(viewer: Viewer, groupId?: string): Promise<SQL | undefined | null> {
  if (groupId) {
    return (await isActiveGroupMember(viewer.id, groupId)) ? eq(events.groupId, groupId) : null;
  }
  const ids = await activeGroupIds(viewer.id);
  return ids.length ? or(isNull(events.groupId), inArray(events.groupId, ids)) : isNull(events.groupId);
}

const endOrStart = sql`coalesce(${events.endsAt}, ${events.startsAt})`;

export type EventScope = "upcoming" | "past" | "going";

export async function listEvents(
  viewer: Viewer,
  options: { scope: EventScope; groupId?: string; limit?: number },
): Promise<EventListItem[]> {
  if (!isActiveMember(viewer)) return [];
  const visibility = await visibilityCondition(viewer, options.groupId);
  if (visibility === null) return [];
  const now = new Date();
  const nowSql = sql`${now.toISOString()}::timestamptz`;
  const conditions: (SQL | undefined)[] = [visibility, isNull(events.removedAt)];
  if (options.scope === "past") {
    conditions.push(sql`${endOrStart} < ${nowSql}`);
  } else {
    conditions.push(sql`${endOrStart} >= ${nowSql}`);
  }
  if (options.scope === "going") {
    conditions.push(
      sql`exists (select 1 from ${eventRsvps} where ${eventRsvps.eventId} = ${events.id} and ${eventRsvps.userId} = ${viewer.id})`,
    );
  }
  const rows = await db
    .select(listFields(viewer))
    .from(events)
    .leftJoin(groups, eq(groups.id, events.groupId))
    .where(and(...conditions))
    .orderBy(options.scope === "past" ? desc(events.startsAt) : asc(events.startsAt))
    .limit(options.limit ?? 50);
  return rows.map((row) => toListItem(row, viewer));
}

export async function getEvent(viewer: Viewer, id: string): Promise<EventDetail | null> {
  if (!isActiveMember(viewer)) return null;
  const [row] = await db
    .select({
      ...listFields(viewer),
      description: events.description,
      venue: events.venue,
      onlineUrl: events.onlineUrl,
      removedAt: events.removedAt,
      organiserName: users.displayName,
      organiserHue: users.avatarHue,
    })
    .from(events)
    .leftJoin(groups, eq(groups.id, events.groupId))
    .leftJoin(users, eq(users.id, events.createdById))
    .where(eq(events.id, id))
    .limit(1);
  if (!row) return null;
  if (row.groupId && !(await isActiveGroupMember(viewer.id, row.groupId))) return null;
  const isMine = row.createdById === viewer.id;
  if (row.removedAt && !isMine) return null;

  const canSeePrivate = isMine || isModerator(viewer) || row.myRsvp !== null;
  const attendees = canSeePrivate
    ? await db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarHue: users.avatarHue,
          status: eventRsvps.status,
        })
        .from(eventRsvps)
        .innerJoin(users, eq(users.id, eventRsvps.userId))
        .where(eq(eventRsvps.eventId, id))
        .orderBy(asc(eventRsvps.createdAt))
    : [];
  const item = toListItem(row, viewer);
  return {
    ...item,
    description: row.description,
    organiser: row.organiserName
      ? { id: row.createdById, displayName: row.organiserName, avatarHue: row.organiserHue ?? 150 }
      : null,
    removed: row.removedAt !== null,
    canSeePrivate,
    venue: canSeePrivate ? row.venue : "",
    onlineUrl: canSeePrivate ? row.onlineUrl : "",
    attendees,
    canEdit: (isMine || isModerator(viewer)) && !row.removedAt,
    canRemove: !isMine && isModerator(viewer) && !row.removedAt,
    isFull: item.capacity !== null && item.goingCount >= item.capacity,
  };
}

export type EventInput = {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  mode: EventMode;
  city: string;
  venue: string;
  onlineUrl: string;
  capacity: number | null;
  features: EventFeature[];
  groupId: string | null;
};

export async function createEvent(viewer: Viewer, input: EventInput): Promise<string | null> {
  if (!isActiveMember(viewer)) return null;
  if (input.groupId && !(await isActiveGroupMember(viewer.id, input.groupId))) return null;
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(events).values({ id, createdById: viewer.id, ...input });
    // The organiser is going to their own event.
    await tx.insert(eventRsvps).values({ eventId: id, userId: viewer.id, status: "going" });
  });
  return id;
}

/**
 * For the edit form: the stored event, when the viewer may edit it. Moderators
 * may edit other people's events only where they can see them, so a group
 * event (with its private address) stays inside the group.
 */
export async function getEditableEvent(viewer: Viewer, id: string) {
  const [row] = await db.select().from(events).where(and(eq(events.id, id), isNull(events.removedAt))).limit(1);
  if (!row) return null;
  if (row.createdById === viewer.id) return row;
  if (!isModerator(viewer)) return null;
  if (row.groupId && !(await isActiveGroupMember(viewer.id, row.groupId))) return null;
  return row;
}

export async function updateEvent(viewer: Viewer, id: string, input: Omit<EventInput, "groupId">) {
  const existing = await getEditableEvent(viewer, id);
  if (!existing) return false;
  await db
    .update(events)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(events.id, id));
  return true;
}

export async function setEventCancelled(viewer: Viewer, id: string, cancelled: boolean) {
  const existing = await getEditableEvent(viewer, id);
  if (!existing) return false;
  await db
    .update(events)
    .set({ cancelledAt: cancelled ? new Date() : null, updatedAt: new Date() })
    .where(eq(events.id, id));
  return true;
}

/** Organisers delete their events; moderators remove other people's. */
export async function deleteEvent(viewer: Viewer, id: string): Promise<"deleted" | "removed" | null> {
  const [own] = await db
    .delete(events)
    .where(and(eq(events.id, id), eq(events.createdById, viewer.id)))
    .returning({ id: events.id });
  if (own) return "deleted";
  if (!isModerator(viewer)) return null;
  return (await removeEvent(viewer, id)) ? "removed" : null;
}

export async function removeEvent(moderator: Viewer, id: string) {
  if (!isModerator(moderator)) return false;
  const [removed] = await db
    .update(events)
    .set({ removedAt: new Date(), removedById: moderator.id })
    .where(and(eq(events.id, id), isNull(events.removedAt)))
    .returning({ id: events.id });
  if (removed) await audit(moderator.id, "content.remove", { type: "event", id });
  return Boolean(removed);
}

export type RsvpResult = "ok" | "full" | "unavailable";

/** Sets or clears the viewer's response. "Going" respects the event's capacity. */
export async function setRsvp(viewer: Viewer, id: string, status: RsvpStatus | null): Promise<RsvpResult> {
  const event = await getEvent(viewer, id);
  if (!event || event.removed || event.cancelled) return "unavailable";
  if (status === null) {
    await db.delete(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.userId, viewer.id)));
    return "ok";
  }
  if (status === "going" && event.myRsvp !== "going" && event.capacity !== null) {
    const [row] = await db
      .select({ value: count() })
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.status, "going")));
    if ((row?.value ?? 0) >= event.capacity) return "full";
  }
  await db
    .insert(eventRsvps)
    .values({ eventId: id, userId: viewer.id, status })
    .onConflictDoUpdate({
      target: [eventRsvps.eventId, eventRsvps.userId],
      set: { status, updatedAt: new Date() },
    });
  if (status === "going" && event.myRsvp !== "going" && event.organiser) {
    await notify({
      userId: event.organiser.id,
      type: "event_rsvp",
      actorId: viewer.id,
      link: `/events/${id}`,
      data: { title: event.title.slice(0, 80) },
    });
  }
  return "ok";
}

/** Upcoming events for the sidebar. */
export async function listUpcomingForSidebar(viewer: Viewer, limit = 3) {
  return listEvents(viewer, { scope: "upcoming", limit });
}
