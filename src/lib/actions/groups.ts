"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { GROUP_PRIVACY } from "@/lib/db/schema";
import type { FormState } from "@/lib/form-state";
import {
  answerJoinRequest,
  createGroup,
  deleteGroup,
  GROUP_COLORS,
  GROUP_ICONS,
  joinGroup,
  joinGroupByCode,
  leaveGroup,
  regenerateGroupInvite,
  removeGroupMember,
  setGroupRole,
  updateGroup,
} from "@/lib/services/groups";
import { memberForAction } from "./guard";
import { actionLocale, invalid, oneOf, text } from "./helpers";

const LIMITS = { name: 60, description: 500 };

export async function saveGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const id = text(formData, "id", 40);
  const values = {
    name: text(formData, "name", LIMITS.name + 1),
    description: text(formData, "description", LIMITS.description + 1),
    privacy: oneOf(formData, "privacy", GROUP_PRIVACY, "open"),
    icon: oneOf(formData, "icon", GROUP_ICONS, "🌳"),
    color: oneOf(formData, "color", GROUP_COLORS, "green"),
  };
  const errors = invalid(
    {
      name: values.name.length < 2 ? t.groups.nameRequired : values.name.length > LIMITS.name ? t.common.tooLong : undefined,
      description: values.description.length > LIMITS.description ? t.common.tooLong : undefined,
    },
    values,
  );
  if (errors) return errors;

  if (id) {
    if (!(await updateGroup(viewer, id, values))) return { status: "error", message: t.common.notAllowed, values };
    refresh();
    return { status: "success", message: t.common.saved, values };
  }
  const newId = await createGroup(viewer, values);
  if (!newId) return { status: "error", message: t.common.notAllowed, values };
  redirect(`/${locale}/groups/${newId}`);
}

export async function joinGroupAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await joinGroup(viewer, text(formData, "id", 40), text(formData, "note", 500));
  refresh();
}

export async function leaveGroupAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await leaveGroup(viewer, text(formData, "id", 40));
  refresh();
}

export async function joinGroupByCodeAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const groupId = await joinGroupByCode(viewer, text(formData, "code", 40));
  redirect(groupId ? `/${locale}/groups/${groupId}` : `/${locale}/groups`);
}

export async function answerJoinRequestAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await answerJoinRequest(
    viewer,
    text(formData, "groupId", 40),
    text(formData, "userId", 40),
    formData.get("approve") === "true",
  );
  refresh();
}

export async function setGroupRoleAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const role = formData.get("role") === "admin" ? "admin" : "member";
  await setGroupRole(viewer, text(formData, "groupId", 40), text(formData, "userId", 40), role);
  refresh();
}

export async function removeGroupMemberAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await removeGroupMember(viewer, text(formData, "groupId", 40), text(formData, "userId", 40));
  refresh();
}

export async function regenerateGroupInviteAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await regenerateGroupInvite(viewer, text(formData, "groupId", 40));
  refresh();
}

export async function deleteGroupAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  if (await deleteGroup(viewer, text(formData, "groupId", 40))) {
    redirect(formData.get("from") === "admin" ? `/${locale}/admin/groups` : `/${locale}/groups`);
  }
  refresh();
}
