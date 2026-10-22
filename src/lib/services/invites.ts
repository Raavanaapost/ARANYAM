import { and, desc, eq, isNull } from "drizzle-orm";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { newId, newInviteCode } from "@/lib/ids";
import { isActiveMember, type Viewer } from "@/lib/auth/viewer";

const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export type InviteStatus = "active" | "used" | "expired" | "revoked";

export function inviteUrl(locale: Locale, code: string) {
  return `${env.appUrl}/${locale}/join/${code}`;
}

/** A single-use link that lets a trusted family join (and, by default, skip moderation). */
export async function createInvite(viewer: Viewer, note: string): Promise<string | null> {
  if (!isActiveMember(viewer)) return null;
  const code = newInviteCode();
  await db.insert(invites).values({
    id: newId(),
    code,
    createdById: viewer.id,
    note: note.slice(0, 100),
    maxUses: 1,
    expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
  });
  return code;
}

export async function listInvites(viewer: Viewer) {
  const rows = await db
    .select()
    .from(invites)
    .where(eq(invites.createdById, viewer.id))
    .orderBy(desc(invites.createdAt))
    .limit(50);
  const now = Date.now();
  return rows.map((row) => {
    const status: InviteStatus = row.revokedAt
      ? "revoked"
      : row.uses >= row.maxUses
        ? "used"
        : row.expiresAt.getTime() <= now
          ? "expired"
          : "active";
    return { id: row.id, code: row.code, note: row.note, expiresAt: row.expiresAt, createdAt: row.createdAt, status };
  });
}

export async function revokeInvite(viewer: Viewer, id: string) {
  const [revoked] = await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, id), eq(invites.createdById, viewer.id), isNull(invites.revokedAt)))
    .returning({ id: invites.id });
  return Boolean(revoked);
}
