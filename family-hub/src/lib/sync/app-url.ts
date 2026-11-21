import "server-only";

/** App base URL for links written into calendar events. Works inside and outside a request. */
export async function getAppUrlSafe(): Promise<string> {
  const fromEnv = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    const { getAppUrl } = await import("../app-url");
    return await getAppUrl();
  } catch {
    return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";
  }
}
