import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.APP_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only-insecure-secret-change-me-please-0123456789");
  if (!s || s.length < 32) throw new Error("APP_SECRET must be set to a random string of at least 32 characters.");
  return s;
}

/** Derives a purpose-specific 32-byte key from APP_SECRET. */
export function deriveKey(purpose: "session" | "tokens" | "state"): Uint8Array {
  return new Uint8Array(hkdfSync("sha256", secret(), "family-hub", purpose, 32));
}

/** AES-256-GCM, output: v1.<iv>.<tag>.<ciphertext> (base64url) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("tokens"), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("tokens"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
