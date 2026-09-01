import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "crypto";
import { createLocalAccountUser, getLocalAccountByEmail } from "./db";

const KEY_LENGTH = 64;

export class LocalAccountError extends Error {
  constructor(public readonly code: "EMAIL_IN_USE" | "INVALID_CREDENTIALS") {
    super(code === "EMAIL_IN_USE" ? "Email ini sudah terdaftar. Silakan masuk." : "Email atau kata sandi tidak sesuai.");
  }
}

function derivePasswordKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => error ? reject(error) : resolve(key as Buffer));
  });
}

export function normalizeLocalEmail(email: string) { return email.trim().toLowerCase(); }

export async function hashLocalPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyLocalPassword(password: string, passwordHash: string) {
  const [algorithm, encodedSalt, encodedKey] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedKey) return false;
  const expected = Buffer.from(encodedKey, "base64url");
  const actual = await derivePasswordKey(password, Buffer.from(encodedSalt, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function registerLocalAccount(input: { name: string; email: string; password: string; }) {
  const email = normalizeLocalEmail(input.email);
  if (await getLocalAccountByEmail(email)) throw new LocalAccountError("EMAIL_IN_USE");
  const passwordHash = await hashLocalPassword(input.password);
  return createLocalAccountUser({ openId: `local_${randomUUID()}`, name: input.name.trim(), email, passwordHash });
}

export async function signInLocalAccount(input: { email: string; password: string; }) {
  const account = await getLocalAccountByEmail(normalizeLocalEmail(input.email));
  if (!account || !(await verifyLocalPassword(input.password, account.passwordHash))) throw new LocalAccountError("INVALID_CREDENTIALS");
  return account.user;
}
