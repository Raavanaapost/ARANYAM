import type { Locale } from "@/i18n/config";
import type { UserRole, UserStatus } from "@/lib/db/schema";

/**
 * The signed-in person, reduced to the fields the app needs. Created by the
 * data access layer (dal.ts) after checking the session against the database.
 */
export type Viewer = {
  id: string;
  sessionId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  locale: Locale;
  avatarHue: number;
  bio: string;
  location: string;
  createdAt: Date;
};

/** A member whose email is confirmed and who was welcomed in by a moderator. */
export type ActiveViewer = Viewer & { emailVerified: true; status: "approved" };

export function isActiveMember(viewer: Viewer | null): viewer is ActiveViewer {
  return viewer !== null && viewer.emailVerified && viewer.status === "approved";
}

export function isModerator(viewer: Viewer | null): viewer is ActiveViewer {
  return isActiveMember(viewer) && (viewer.role === "moderator" || viewer.role === "admin");
}

export function isAdmin(viewer: Viewer | null): viewer is ActiveViewer {
  return isActiveMember(viewer) && viewer.role === "admin";
}
