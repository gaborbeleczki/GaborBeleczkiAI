import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { kvGet, kvSet } from "../kv";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 8;

function digest(s: string) {
  return createHash("sha256").update(s, "utf8").digest();
}

/** Constant-time comparison of the submitted password against APP_PASSWORD. */
export function passwordMatches(submitted: string, expected: string): boolean {
  if (!expected) return false;
  return timingSafeEqual(digest(submitted), digest(expected));
}

type Attempts = { count: number; first: number };

function keyFor(ip: string) {
  return `login_fail:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
}

/** Simple DB-backed brute-force guard: max 8 failed attempts per IP per 15 minutes. */
export async function isLockedOut(ip: string): Promise<boolean> {
  const a = await kvGet<Attempts>(keyFor(ip));
  return Boolean(a && Date.now() - a.first < WINDOW_MS && a.count >= MAX_FAILURES);
}

export async function recordFailure(ip: string): Promise<void> {
  const key = keyFor(ip);
  const a = await kvGet<Attempts>(key);
  const fresh = !a || Date.now() - a.first >= WINDOW_MS;
  await kvSet<Attempts>(key, fresh ? { count: 1, first: Date.now() } : { count: a.count + 1, first: a.first });
}
