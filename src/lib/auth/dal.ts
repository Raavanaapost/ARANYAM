import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after, connection } from "next/server";
import { cache } from "react";
import { getLocale } from "@/i18n/server";
import { isLocale } from "@/i18n/config";
import { safeNextPath } from "@/lib/params";
import { readSessionCookie } from "./cookies";
import { renewSession, validateSessionToken } from "./session";
import { isAdmin, isModerator, viewerFromUser, type Viewer } from "./viewer";

export type { Viewer } from "./viewer";
export { isActiveMember, isAdmin, isModerator } from "./viewer";

const HOUR = 60 * 60 * 1000;

const loadViewer = cache(async (): Promise<Viewer | null> => {
  // Sessions are checked against the clock and the database on every request,
  // so this never becomes part of a prerendered or prefetched page.
  await connection();
  const token = await readSessionCookie();
  if (!token) return null;
  const result = await validateSessionToken(token);
  if (!result) return null;
  const { session, user } = result;
  if (result.shouldRenew || Date.now() - session.lastUsedAt.getTime() > HOUR) {
    after(() => renewSession(session.id));
  }
  return viewerFromUser(user, session.id);
});

/** The current user, or null for visitors. Safe to call many times per request. */
export async function getViewer(): Promise<Viewer | null> {
  return loadViewer();
}

/** Only allow redirects back into this site, never to another domain. */
async function currentPath(): Promise<string | null> {
  return safeNextPath((await headers()).get("x-aranyam-path"));
}

function stripLocale(path: string): string {
  const [, maybeLocale, ...rest] = path.split("/");
  return isLocale(maybeLocale) ? `/${rest.join("/")}` : path;
}

/** For pages that need a signed-in user (any status). */
export async function requireUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer) return viewer;
  const locale = await getLocale();
  const path = await currentPath();
  const next = path ? `?next=${encodeURIComponent(stripLocale(path))}` : "";
  redirect(`/${locale}/login${next}`);
}

/** For member pages: signed in, email confirmed and approved by a moderator. */
export async function requireMember(): Promise<Viewer> {
  const viewer = await requireUser();
  if (viewer.emailVerified && viewer.status === "approved") return viewer;
  const locale = await getLocale();
  redirect(viewer.emailVerified ? `/${locale}/pending` : `/${locale}/verify-email`);
}

export async function requireModerator(): Promise<Viewer> {
  const viewer = await requireMember();
  if (!isModerator(viewer)) notFound();
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireMember();
  if (!isAdmin(viewer)) notFound();
  return viewer;
}
