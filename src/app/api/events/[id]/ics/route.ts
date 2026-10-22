import { getViewer } from "@/lib/auth/dal";
import { isActiveMember } from "@/lib/auth/viewer";
import { env } from "@/lib/env";
import { getEvent } from "@/lib/services/events";

/** Text values in iCalendar escape backslashes, commas, semicolons and line breaks. */
function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Lines longer than 75 bytes are folded onto continuation lines that start with a space. */
function fold(line: string) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  for (const char of line) {
    if (encoder.encode(current + char).length > (chunks.length ? 74 : 75)) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

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
  const endsAt = event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const description = [event.description, link].filter(Boolean).join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aranyam//Community events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@aranyam`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    `DTEND:${utcStamp(endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    location ? `LOCATION:${escapeText(location)}` : null,
    `URL:${link}`,
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aranyam-event.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
