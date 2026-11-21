import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { DEFAULT_PREFERENCES, EMPTY_FAMILY, type FamilyConfig, type Preferences } from "./family/types";
import { normalizeFamily } from "./family/normalize";

export async function kvGet<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const rows = await db.select().from(schema.kv).where(eq(schema.kv.key, key)).limit(1);
  return rows[0] ? (rows[0].value as T) : null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.kv)
    .values({ key, value: value as unknown as object, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.kv.key, set: { value: value as unknown as object, updatedAt: new Date() } });
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.kv).where(eq(schema.kv.key, key));
}

export async function getFamily(): Promise<FamilyConfig> {
  const stored = await kvGet<FamilyConfig>("family");
  if (stored) return normalizeFamily(stored);
  const seed = process.env.FAMILY_CONFIG_JSON;
  if (seed) {
    try {
      const fam = normalizeFamily(JSON.parse(seed));
      await kvSet("family", fam);
      return fam;
    } catch {
      // fall through to empty config; Settings shows an error banner
    }
  }
  return EMPTY_FAMILY;
}

export async function saveFamily(f: FamilyConfig): Promise<void> {
  await kvSet("family", normalizeFamily(f));
}

export async function getPrefs(): Promise<Preferences> {
  const stored = await kvGet<Partial<Preferences>>("prefs");
  return { ...DEFAULT_PREFERENCES, ...(stored ?? {}) };
}

export async function savePrefs(p: Partial<Preferences>): Promise<Preferences> {
  const next = { ...(await getPrefs()), ...p };
  await kvSet("prefs", next);
  return next;
}
