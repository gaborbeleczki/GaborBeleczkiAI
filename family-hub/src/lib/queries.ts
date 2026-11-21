import "server-only";
import { and, desc, gte, inArray } from "drizzle-orm";
import { getDb, schema } from "./db";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export async function recentEmails(days: number, opts: { categories?: string[]; limit?: number } = {}) {
  const db = await getDb();
  return db
    .select()
    .from(schema.emails)
    .where(and(gte(schema.emails.receivedAt, daysAgo(days)), opts.categories ? inArray(schema.emails.category, opts.categories) : undefined))
    .orderBy(desc(schema.emails.receivedAt))
    .limit(opts.limit ?? 150);
}

export async function recentMedia(days: number, limit = 60) {
  const db = await getDb();
  return db
    .select()
    .from(schema.items)
    .where(and(inArray(schema.items.type, ["reading", "podcast"]), inArray(schema.items.status, ["open", "done"]), gte(schema.items.createdAt, daysAgo(days))))
    .orderBy(desc(schema.items.confidence))
    .limit(limit);
}
