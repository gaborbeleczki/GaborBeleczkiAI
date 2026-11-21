import "server-only";
import { headers } from "next/headers";

/** Public base URL used for OAuth redirect URIs. Prefer APP_URL so preview deployments reuse production callbacks. */
export async function getAppUrl(): Promise<string> {
  const fromEnv = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
