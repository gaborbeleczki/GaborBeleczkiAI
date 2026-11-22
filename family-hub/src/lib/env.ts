import "server-only";

function list(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[,\s;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const isProd = process.env.NODE_ENV === "production";

export const env = {
  appSecret: process.env.APP_SECRET ?? (isProd ? "" : "dev-only-insecure-secret-change-me-please-0123456789"),
  allowedEmails: list(process.env.ALLOWED_EMAILS),
  mailboxOwner: (process.env.MAILBOX_OWNER_EMAIL || list(process.env.ALLOWED_EMAILS)[0] || "").toLowerCase(),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  // DATABASE_URL, or POSTGRES_URL as injected by the Vercel ↔ Supabase/Neon integrations
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  cronSecret: process.env.CRON_SECRET ?? "",
  appUrl: (process.env.APP_URL ?? "").replace(/\/$/, ""),
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? "",
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
  familyConfigJson: process.env.FAMILY_CONFIG_JSON ?? "",
  devLogin: !isProd && process.env.DEV_LOGIN === "1",
  /** Optional shared family password (testing phase / fallback when Google sign-in is not set up). */
  appPassword: (process.env.APP_PASSWORD ?? "").length >= 12 ? (process.env.APP_PASSWORD as string) : "",
};

export const googleLoginConfigured = () => Boolean(env.googleClientId && env.googleClientSecret);

export function assertAppSecret() {
  if (!env.appSecret || env.appSecret.length < 32) {
    throw new Error("APP_SECRET must be set to a random string of at least 32 characters.");
  }
}

export const TZ = "Europe/Budapest";
