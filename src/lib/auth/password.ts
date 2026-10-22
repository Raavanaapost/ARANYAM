import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// scrypt parameters from the OWASP Password Storage Cheat Sheet
// (N=2^15, r=8, p=3: about 32 MiB of memory per hash).
const N = 32768;
const R = 8;
const P = 3;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password.normalize("NFKC"), salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Returns a self-describing hash: scrypt$N$r$p$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEMORY,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real password check. Used when no account matches,
 * so response times do not reveal which email addresses are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
  return false;
}

// A short list of the passwords most often found in breaches.
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "00000000",
  "12341234",
  "87654321",
  "qwertyui",
  "qwerty123",
  "qwertyuiop",
  "iloveyou",
  "letmein1",
  "welcome1",
  "welcome123",
  "admin123",
  "abc12345",
  "abcd1234",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "superman",
  "trustno1",
  "aranyam1",
  "aranyam123",
]);

export type PasswordProblem = "too_short" | "too_long" | "too_common" | "matches_email";

export function checkPasswordStrength(password: string, email?: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "too_short";
  if (password.length > PASSWORD_MAX_LENGTH) return "too_long";
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "too_common";
  if (/^(.)\1+$/.test(password)) return "too_common";
  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const localPart = normalizedEmail.split("@")[0];
    if (lower === normalizedEmail || (localPart.length >= 4 && lower === localPart)) {
      return "matches_email";
    }
  }
  return null;
}
