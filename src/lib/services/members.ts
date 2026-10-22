import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";
import { isActiveMember, type Viewer } from "@/lib/auth/viewer";

export type MemberProfile = {
  id: string;
  displayName: string;
  bio: string;
  location: string;
  role: UserRole;
  avatarHue: number;
  joinedAt: Date;
};

/** A member's public profile, as other approved members see it. Never includes the email. */
export async function getMemberProfile(viewer: Viewer, id: string): Promise<MemberProfile | null> {
  if (!isActiveMember(viewer)) return null;
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      bio: users.bio,
      location: users.location,
      role: users.role,
      avatarHue: users.avatarHue,
      joinedAt: users.approvedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, id), eq(users.status, "approved")))
    .limit(1);
  if (!row) return null;
  return { ...row, joinedAt: row.joinedAt ?? row.createdAt };
}
