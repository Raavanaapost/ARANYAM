import { describe, expect, it } from "vitest";
import { initials } from "@/components/ui/avatar";

describe("avatar initials", () => {
  it("uses two letters for names in Latin letters", () => {
    expect(initials("Priya Amma")).toBe("PA");
    expect(initials("  meena   sundaram  ")).toBe("MS");
    expect(initials("Ganesh")).toBe("G");
  });

  it("uses one whole letter for Tamil names", () => {
    // "அனிதா ராஜன்": the second word starts with ரா, a consonant with a vowel sign.
    expect(initials("அனிதா ராஜன்")).toBe("அ");
    expect(initials("கொடி")).toBe("கொ");
  });

  it("copes with an empty name", () => {
    expect(initials("   ")).toBe("");
  });
});
