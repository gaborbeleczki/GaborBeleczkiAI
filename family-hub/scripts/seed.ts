/**
 * Loads sample data into the local PGlite database (.data/pglite) for UI development.
 *
 *   npm run seed                      # fictional demo family (scripts/demo-seed.json)
 *   npm run seed -- .local/mine.json  # your own private seed (keep it out of git)
 *
 * Dates may be absolute ("2026-11-24") or relative to today ("+3", "-1").
 * Never run against production: it refuses when DATABASE_URL is set.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/lib/db/schema";
import { addDaysISO, todayISO } from "../src/lib/time";

if (process.env.DATABASE_URL) {
  console.error("Refusing to seed: DATABASE_URL is set (this script is for the local PGlite database only).");
  process.exit(1);
}

const file = process.argv[2] ?? path.join("scripts", "demo-seed.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const today = todayISO();
const d = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  const s = String(v);
  if (/^[+-]?\d{1,3}$/.test(s)) return addDaysISO(today, Number(s));
  return s;
};
const ts = (v: unknown): Date => {
  if (typeof v === "string" && /^[+-]\d+(\s+\d{2}:\d{2})?$/.test(v)) {
    const [off, time] = v.split(/\s+/);
    return new Date(`${addDaysISO(today, Number(off))}T${time ?? "08:00"}:00+01:00`);
  }
  return v ? new Date(String(v)) : new Date();
};

async function main() {
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  for (const t of [schema.items, schema.emails, schema.digests, schema.kv, schema.syncRuns]) await db.delete(t);

  await db.insert(schema.kv).values([
    { key: "family", value: data.family },
    { key: "prefs", value: data.prefs ?? {} },
    {
      key: "last_sync_result",
      value: {
        at: new Date(Date.now() - 12 * 60_000).toISOString(),
        stats: { listed: 212, fresh: 37, extracted: 14, triaged: 11, skipped: 12, created: (data.items ?? []).length, updated: 4, completed: 2, calendar: 9, errors: [], remaining: 0 },
      },
    },
  ]);

  const emailRows = (data.emails ?? []).map((e: Record<string, unknown>) => ({
    id: String(e.id),
    threadId: String(e.id),
    fromEmail: String(e.fromEmail ?? ""),
    fromName: (e.fromName as string) ?? null,
    toEmails: (e.toEmails as string[]) ?? [],
    subject: (e.subject as string) ?? null,
    receivedAt: ts(e.receivedAt),
    snippet: (e.summary as string) ?? null,
    excerpt: null,
    labels: (e.labels as string[]) ?? [],
    category: (e.category as string) ?? "other",
    kidIds: (e.kidIds as string[]) ?? [],
    status: (e.status as string) ?? "processed",
    summary: (e.summary as string) ?? null,
    attachments: (e.attachments as { filename: string; mimeType: string }[]) ?? [],
    links: [],
    itemIds: [],
    processedAt: new Date(),
  }));
  if (emailRows.length) await db.insert(schema.emails).values(emailRows);

  const idByKey = new Map<string, string>();
  for (const it of data.items ?? []) {
    const [row] = await db
      .insert(schema.items)
      .values({
        type: it.type,
        area: it.area ?? (it.kidIds?.length ? "school" : "home"),
        title: it.title,
        details: it.details ?? null,
        kidIds: it.kidIds ?? [],
        category: it.category ?? null,
        subject: it.subject ?? null,
        assessmentKind: it.assessmentKind ?? null,
        topics: it.topics ?? null,
        date: d(it.date),
        time: it.time ?? null,
        endDate: d(it.endDate),
        endTime: it.endTime ?? null,
        datePrecision: it.datePrecision ?? (it.date ? "exact" : "unknown"),
        status: it.status ?? "open",
        priority: it.priority ?? "normal",
        needsReview: it.needsReview ?? false,
        confidence: it.confidence ?? 0.9,
        amount: it.amount ?? null,
        currency: it.amount != null ? (it.currency ?? "HUF") : null,
        payee: it.payee ?? null,
        paymentInfo: it.paymentInfo ?? null,
        paidAt: it.status === "done" && (it.type === "bill" || it.type === "payment") ? ts(it.paidAt ?? "-1") : null,
        url: it.url ?? null,
        source: it.sourceEmailId ? "email" : "manual",
        sourceEmailId: it.sourceEmailId ?? null,
        sourceContact: it.sourceContact ?? null,
        sourceQuote: it.sourceQuote ?? null,
        calendarEventId: it.onCalendar ? `demo-${Math.random().toString(36).slice(2)}` : null,
        calendarPrepIds: it.prepBlocks ? Array.from({ length: it.prepBlocks }, (_, i) => `demo-prep-${i}`) : [],
        meta: it.meta ?? {},
        createdAt: it.createdAt ? ts(it.createdAt) : new Date(),
      })
      .returning();
    if (it.key) idByKey.set(it.key, row.id);
  }

  if (data.digest) {
    const resolve = (ids: string[] = []) => ids.map((k) => idByKey.get(k)).filter(Boolean);
    const digest = {
      ...data.digest,
      suggested_actions: (data.digest.suggested_actions ?? []).map((a: Record<string, unknown>) => ({
        ...a,
        item_id: a.item_key ? (idByKey.get(String(a.item_key)) ?? null) : null,
        email_id: a.email_id ?? null,
      })),
      reading_pick_ids: resolve(data.digest.reading_pick_keys),
      podcast_pick_ids: resolve(data.digest.podcast_pick_keys),
      generatedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      date: today,
    };
    await db.insert(schema.digests).values({ date: today, data: digest });
  }

  console.log(`Seeded ${data.items?.length ?? 0} items, ${emailRows.length} emails into ${dir}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
