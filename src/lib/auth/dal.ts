import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getLocale } from "@/i18n/server";
import { isLocale } from "@/i18n/config";
import { safeNextPath } from "@/lib/params";
import { findUserById } from "@/lib/services/accounts";
import { getAuth } from "./auth";
import { isAdmin, isModerator, viewerFromUser, type Viewer } from "./viewer";

export type { Viewer } from "./viewer";
export { isActiveMember, isAdmin, isModerator } from "./viewer";

const loadViewer = cache(async (): Promise<Viewer | null> => {
  // Sessions are checked against the clock and the database on every request,
  // so this never becomes part of a prerendered or prefetched page.
  await connection();
  const result = await getAuth().api.getSession({ headers: await headers() });
  if (!result) return null;
  // Better Auth knows the account's sign-in details; roles, approval and the
  // rest of the profile come from Aranyam's own columns.
  const user = await findUserById(result.user.id);
  return user ? viewerFromUser(user, result.session.id) : null;
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
