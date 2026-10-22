import { createHash, randomBytes } from "node:crypto";

// 32 symbols without look-alikes (no 0/o, 1/l), so codes are easy to read aloud.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Random string from a 32-symbol alphabet (5 bits of entropy per character). */
export function randomString(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  // 256 is a multiple of 32, so the modulo introduces no bias.
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

/** Non-sequential ids, so URLs cannot be guessed or counted. */
export const newId = () => randomString(16);

/** Codes for invite links: 60 bits, short enough to share in a message. */
export const newInviteCode = () => randomString(12);

/** 256-bit secret for sessions and email links. */
export function generateSecretToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Secrets are stored hashed, so a database leak does not expose live tokens. */
export function hashSecret(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function randomHue(): number {
  return randomBytes(2).readUInt16BE(0) % 360;
}
