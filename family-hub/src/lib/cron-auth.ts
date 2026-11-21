import "server-only";
import { safeEqual } from "./crypto";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; external schedulers must do the same. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const header = req.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}
