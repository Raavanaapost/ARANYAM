import { getViewer } from "@/lib/auth/dal";
import { isActiveMember } from "@/lib/auth/viewer";
import { env } from "@/lib/env";
import { buildCalendar } from "@/lib/ics";
import { getEvent } from "@/lib/services/events";

/**
 * "Add to calendar": the event as an .ics file. The address or meeting link is
 * only included for people who may see it on the event page.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/events/[id]/ics">) {
  const viewer = await getViewer();
  if (!isActiveMember(viewer)) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const event = await getEvent(viewer, id);
  if (!event || event.removed) return new Response("Not found", { status: 404 });

  const link = `${env.appUrl}/${viewer.locale}/events/${event.id}`;
  const privateDetails = event.canSeePrivate ? (event.mode === "online" ? event.onlineUrl : event.venue) : "";
  const location = [privateDetails, event.mode === "online" ? "" : event.city].filter(Boolean).join(", ");

  const calendar = buildCalendar({
    uid: `${event.id}@aranyam`,
    start: event.startsAt,
    end: event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000),
    title: event.title,
    description: [event.description, link].filter(Boolean).join("\n\n"),
    location,
    url: link,
    cancelled: event.cancelled,
  });

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aranyam-event.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
