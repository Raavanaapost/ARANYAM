import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getViewer } from "@/lib/auth/dal";
import { isActiveMember, isAdmin, isModerator, type Viewer } from "@/lib/auth/viewer";

/**
 * Every Server Action checks the session itself; a form being shown on a
 * member page is never enough.
 */
export async function memberForAction(locale: Locale): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/login`);
  if (isActiveMember(viewer)) return viewer;
  redirect(`/${locale}/${viewer.emailVerified ? "pending" : "verify-email"}`);
}

export async function moderatorForAction(locale: Locale): Promise<Viewer> {
  const viewer = await memberForAction(locale);
  if (!isModerator(viewer)) notFound();
  return viewer;
}

export async function adminForAction(locale: Locale): Promise<Viewer> {
  const viewer = await memberForAction(locale);
  if (!isAdmin(viewer)) notFound();
  return viewer;
}
