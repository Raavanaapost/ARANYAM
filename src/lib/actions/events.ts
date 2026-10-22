"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { EVENT_FEATURES, EVENT_MODES, RSVP_STATUSES, type EventFeature } from "@/lib/db/schema";
import { env } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import {
  createEvent,
  deleteEvent,
  getEditableEvent,
  setEventCancelled,
  setRsvp,
  updateEvent,
} from "@/lib/services/events";
import { fromZonedParts } from "@/lib/timezone";
import { memberForAction } from "./guard";
import { actionLocale, invalid, isSafeHttpUrl, oneOf, text } from "./helpers";

const LIMITS = { title: 120, description: 5000, city: 80, venue: 300, url: 500 };

export async function saveEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const id = text(formData, "id", 40);
  const features = formData
    .getAll("features")
    .filter((value): value is EventFeature => (EVENT_FEATURES as readonly unknown[]).includes(value));
  const values = {
    title: text(formData, "title", LIMITS.title + 1),
    description: text(formData, "description", LIMITS.description + 1),
    date: text(formData, "date", 10),
    start: text(formData, "start", 5),
    end: text(formData, "end", 5),
    mode: oneOf(formData, "mode", EVENT_MODES, "in_person"),
    city: text(formData, "city", LIMITS.city + 1),
    venue: text(formData, "venue", LIMITS.venue + 1),
    onlineUrl: text(formData, "onlineUrl", LIMITS.url + 1),
    capacity: text(formData, "capacity", 6),
    groupId: text(formData, "groupId", 40),
    features: features.join(","),
  };

  const startsAt = fromZonedParts(values.date, values.start, env.timezone);
  const endsAt = values.end ? fromZonedParts(values.date, values.end, env.timezone) : null;
  const capacity = values.capacity ? Number(values.capacity) : null;
  const existing = id ? await getEditableEvent(viewer, id) : null;
  if (id && !existing) return { status: "error", message: t.common.notAllowed, values };

  const errors = invalid(
    {
      title: !values.title ? t.events.titleRequired : values.title.length > LIMITS.title ? t.common.tooLong : undefined,
      description: values.description.length > LIMITS.description ? t.common.tooLong : undefined,
      date: !startsAt
        ? t.events.invalidDate
        : // New events must be in the future; edits may keep a past date.
          !existing && startsAt.getTime() < Date.now()
          ? t.events.inPast
          : undefined,
      end:
        values.end && (!endsAt || (startsAt && endsAt.getTime() <= startsAt.getTime()))
          ? t.events.endBeforeStart
          : undefined,
      city: values.city.length > LIMITS.city ? t.common.tooLong : undefined,
      venue: values.venue.length > LIMITS.venue ? t.common.tooLong : undefined,
      onlineUrl:
        values.onlineUrl && (values.onlineUrl.length > LIMITS.url || !isSafeHttpUrl(values.onlineUrl))
          ? t.events.invalidUrl
          : undefined,
      capacity:
        capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10_000)
          ? t.events.capacityInvalid
          : undefined,
    },
    values,
  );
  if (errors || !startsAt) return errors ?? { status: "error", values };

  const input = {
    title: values.title,
    description: values.description,
    startsAt,
    endsAt,
    mode: values.mode,
    city: values.city,
    venue: values.mode === "in_person" ? values.venue : "",
    onlineUrl: values.mode === "online" ? values.onlineUrl : "",
    capacity,
    features,
  };
  const savedId = id
    ? (await updateEvent(viewer, id, input))
      ? id
      : null
    : await createEvent(viewer, { ...input, groupId: values.groupId || null });
  if (!savedId) return { status: "error", message: t.common.notAllowed, values };
  redirect(`/${locale}/events/${savedId}`);
}

export async function rsvpAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  const status = formData.get("status");
  await setRsvp(
    viewer,
    text(formData, "id", 40),
    (RSVP_STATUSES as readonly unknown[]).includes(status) ? (status as "going" | "interested") : null,
  );
  refresh();
}

export async function cancelEventAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  await setEventCancelled(viewer, text(formData, "id", 40), formData.get("cancelled") === "true");
  refresh();
}

export async function deleteEventAction(formData: FormData) {
  const { locale } = actionLocale(formData);
  const viewer = await memberForAction(locale);
  if (await deleteEvent(viewer, text(formData, "id", 40))) redirect(`/${locale}/events`);
  refresh();
}
