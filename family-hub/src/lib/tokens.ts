import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { decrypt, encrypt } from "./crypto";

export type StoredToken = {
  provider: string;
  account: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
};

export async function loadToken(provider: "google" | "spotify"): Promise<StoredToken | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.oauthTokens).where(eq(schema.oauthTokens.provider, provider)).limit(1);
  if (!row) return null;
  return {
    provider,
    account: row.account,
    refreshToken: row.refreshToken ? decrypt(row.refreshToken) : null,
    accessToken: row.accessToken ? decrypt(row.accessToken) : null,
    expiresAt: row.expiresAt,
    scope: row.scope,
  };
}

export async function saveToken(
  provider: "google" | "spotify",
  t: { account?: string | null; refreshToken?: string | null; accessToken?: string | null; expiresIn?: number | null; scope?: string | null },
): Promise<void> {
  const db = await getDb();
  const existing = await loadToken(provider);
  const values = {
    provider,
    account: t.account ?? existing?.account ?? null,
    refreshToken: t.refreshToken ? encrypt(t.refreshToken) : existing?.refreshToken ? encrypt(existing.refreshToken) : null,
    accessToken: t.accessToken ? encrypt(t.accessToken) : null,
    expiresAt: t.expiresIn ? new Date(Date.now() + t.expiresIn * 1000) : null,
    scope: t.scope ?? existing?.scope ?? null,
    updatedAt: new Date(),
  };
  await db.insert(schema.oauthTokens).values(values).onConflictDoUpdate({ target: schema.oauthTokens.provider, set: values });
}

export async function deleteToken(provider: "google" | "spotify"): Promise<void> {
  const db = await getDb();
  await db.delete(schema.oauthTokens).where(eq(schema.oauthTokens.provider, provider));
}
