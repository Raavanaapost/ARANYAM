/**
 * Event times are entered as a date and a time on the community's clock
 * (APP_TIMEZONE, India by default) and stored as UTC instants.
 */

/** Milliseconds the given time zone is ahead of UTC at `date`. */
function offsetAt(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const wallClock = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return wallClock - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-08" + "10:30" on the community clock, as an instant. Null for invalid input. */
export function fromZonedParts(date: string, time: string, timeZone: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [year, month, day, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(asUtc);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  // Two passes handle a daylight-saving change between the guess and the answer.
  let instant = asUtc - offsetAt(new Date(asUtc), timeZone);
  instant = asUtc - offsetAt(new Date(instant), timeZone);
  return new Date(instant);
}

/** The date and time inputs for an instant, on the community clock. */
export function toZonedParts(instant: Date, timeZone: string): { date: string; time: string } {
  const shifted = new Date(instant.getTime() + offsetAt(instant, timeZone));
  const iso = shifted.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
