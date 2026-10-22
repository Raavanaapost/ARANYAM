import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, type Executor } from "@/lib/db";
import { notifications, users, type NotificationType } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export type NewNotification = {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  actorAnonymous?: boolean;
  /** Path inside the app without the language prefix. */
  link?: string;
  data?: Record<string, string>;
};

export async function notify(input: NewNotification, executor: Executor = db) {
  // People are never notified about their own actions.
  if (input.actorId && input.actorId === input.userId) return;
  await executor.insert(notifications).values({
    id: newId(),
    userId: input.userId,
    type: input.type,
    actorId: input.actorId ?? null,
    actorAnonymous: input.actorAnonymous ?? false,
    link: input.link ?? "",
    data: input.data ?? {},
  });
}

export async function countUnread(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

export async function listNotifications(userId: string, limit = 50) {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      link: notifications.link,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorAnonymous: notifications.actorAnonymous,
      actorName: users.displayName,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  // Never reveal who is behind an anonymous comment.
  return rows.map(({ actorAnonymous, actorName, ...rest }) => ({
    ...rest,
    actorName: actorAnonymous ? null : actorName,
  }));
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
