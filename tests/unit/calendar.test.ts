import { describe, expect, it } from "vitest";
import { buildCalendar, escapeIcsText, foldIcsLine, icsUtcStamp } from "@/lib/ics";
import { fromZonedParts, toZonedParts } from "@/lib/timezone";

describe("calendar files", () => {
  it("escapes special characters in text", () => {
    expect(escapeIcsText("Tea, snacks; and a \\ slash\nSee you")).toBe("Tea\\, snacks\\; and a \\\\ slash\\nSee you");
    expect(escapeIcsText("one\r\ntwo\rthree")).toBe("one\\ntwo\\nthree");
  });

  it("writes UTC times in the compact form", () => {
    expect(icsUtcStamp(new Date("2026-11-08T05:00:00.000Z"))).toBe("20261108T050000Z");
  });

  it("folds long lines at 75 bytes without breaking Tamil letters", () => {
    const line = `SUMMARY:${"பேச்சுப் பயிற்சியாளருடன் கேள்வி பதில் ".repeat(4)}`;
    const folded = foldIcsLine(line);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const [index, part] of lines.entries()) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
      if (index > 0) expect(part.startsWith(" ")).toBe(true);
    }
    // Unfolding (removing CRLF + space) gives back the original line.
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("builds a complete event", () => {
    const calendar = buildCalendar({
      uid: "abc@aranyam",
      start: new Date("2026-11-08T05:00:00Z"),
      end: new Date("2026-11-08T07:00:00Z"),
      title: "Park morning",
      description: "Bring water, a mat; and snacks",
      location: "Anna Nagar Tower Park, Chennai",
      url: "http://localhost:3000/en/events/abc",
      cancelled: false,
      stamp: new Date("2026-10-22T00:00:00Z"),
    });
    expect(calendar.endsWith("\r\n")).toBe(true);
    expect(calendar.split("\r\n")).toEqual(
      expect.arrayContaining([
        "BEGIN:VEVENT",
        "DTSTART:20261108T050000Z",
        "DTEND:20261108T070000Z",
        "SUMMARY:Park morning",
        "DESCRIPTION:Bring water\\, a mat\\; and snacks",
        "LOCATION:Anna Nagar Tower Park\\, Chennai",
        "STATUS:CONFIRMED",
      ]),
    );
  });

  it("leaves out the location when it must stay private", () => {
    const calendar = buildCalendar({
      uid: "abc@aranyam",
      start: new Date(),
      end: new Date(),
      title: "Online talk",
      description: "",
      location: "",
      url: "http://localhost:3000/en/events/abc",
      cancelled: true,
    });
    expect(calendar).not.toContain("LOCATION");
    expect(calendar).toContain("STATUS:CANCELLED");
  });
});

describe("event times on the community clock", () => {
  it("turns an Indian date and time into the right instant", () => {
    expect(fromZonedParts("2026-11-08", "10:30", "Asia/Kolkata")?.toISOString()).toBe("2026-11-08T05:00:00.000Z");
    expect(toZonedParts(new Date("2026-11-08T05:00:00.000Z"), "Asia/Kolkata")).toEqual({ date: "2026-11-08", time: "10:30" });
  });

  it("handles places with daylight saving time", () => {
    // New York changes from EDT (UTC-4) to EST (UTC-5) on 1 November 2026.
    expect(fromZonedParts("2026-10-31", "10:00", "America/New_York")?.toISOString()).toBe("2026-10-31T14:00:00.000Z");
    expect(fromZonedParts("2026-11-02", "10:00", "America/New_York")?.toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });

  it("rejects dates that do not exist", () => {
    expect(fromZonedParts("2026-02-30", "10:00", "Asia/Kolkata")).toBeNull();
    expect(fromZonedParts("2026-13-01", "10:00", "Asia/Kolkata")).toBeNull();
    expect(fromZonedParts("2026-11-08", "24:00", "Asia/Kolkata")).toBeNull();
    expect(fromZonedParts("8/11/2026", "10:00", "Asia/Kolkata")).toBeNull();
  });
});
