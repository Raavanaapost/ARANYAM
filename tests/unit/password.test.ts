import { describe, expect, it } from "vitest";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("a quiet walk by the sea");
    expect(hash.startsWith("scrypt$32768$8$3$")).toBe(true);
    await expect(verifyPassword("a quiet walk by the sea", hash)).resolves.toBe(true);
    await expect(verifyPassword("a quiet walk by the sea ", hash)).resolves.toBe(false);
    await expect(verifyPassword("A quiet walk by the sea", hash)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    const [first, second] = await Promise.all([hashPassword("same password"), hashPassword("same password")]);
    expect(first).not.toBe(second);
  });

  it("accepts Tamil passwords however the keyboard composed them", async () => {
    // "கொ" can be typed as one precomposed letter or as consonant + vowel sign.
    const composed = "கொஞ்சம் பொறுமை".normalize("NFC");
    const decomposed = composed.normalize("NFD");
    const hash = await hashPassword(composed);
    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });

  it("rejects stored values that are not our hashes", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt$abc")).resolves.toBe(false);
  });
});

describe("password strength", () => {
  it("explains what is wrong", () => {
    expect(checkPasswordStrength("short")).toBe("too_short");
    expect(checkPasswordStrength("x".repeat(201))).toBe("too_long");
    expect(checkPasswordStrength("password123")).toBe("too_common");
    expect(checkPasswordStrength("aaaaaaaaaa")).toBe("too_common");
    expect(checkPasswordStrength("meenakshi", "meenakshi@example.com")).toBe("matches_email");
    expect(checkPasswordStrength("Meenakshi@Example.com", "meenakshi@example.com")).toBe("matches_email");
  });

  it("accepts a good sentence", () => {
    expect(checkPasswordStrength("our garden has three mango trees", "meena@example.com")).toBeNull();
  });
});
