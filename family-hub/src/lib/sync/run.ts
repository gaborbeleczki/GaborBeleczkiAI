import { normalizeDigest, type StoredDigest } from "../digest-normalize";
import "server-only";
import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { Item } from "../db/schema";
import { aiConfigured } from "../ai/client";
import { extractEmail, triageEmails, writeDigest, type TriageInput } from "../ai/tasks";
import { getMessage, listMessageIds } from "../google/gmail";
import { googleConnection } from "../google/oauth";
import { listEvents } from "../google/calendar";
import type { ParsedEmail } from "../google/mime";
import { applyDrafts, completeItems, listItems, openItemsBrief } from "../items/repo";
import { getFamily, getPrefs, kvDelete, kvGet, kvSet } from "../kv";
import { addDaysISO, formatHuf, localToDate, todayISO, toLocal } from "../time";
import { classifyEmail, type Classification } from "./classify";
import { loadBusy, syncItemCalendar, type CalendarContext } from "./calendar-sync";
import { getAppUrlSafe } from "./app-url";
import { ruleExtract } from "../rules/extract";
import { ruleDigest } from "../rules/digest";

export type SyncStats = {
  listed: number;
  fresh: number;
  extracted: number;
  triaged: number;
  skipped: number;
  created: number;
  updated: number;
  completed: number;
  calendar: number;
  errors: string[];
  remaining: number;
};

const LOCK_KEY = "sync_lock";
const LOCK_MS = 5 * 60_000;

async function withLock<T>(fn: () => Promise<T>): Promise<T | { locked: true }> {
  const lock = await kvGet<{ at: number }>(LOCK_KEY);
  if (lock && Date.now() - lock.at < LOCK_MS) return { locked: true };
  await kvSet(LOCK_KEY, { at: Date.now() });
  try {
    return await fn();
  } finally {
    await kvDelete(LOCK_KEY);
  }
}

async function startRun(kind: string, trigger: string) {
  const db = await getDb();
  const [run] = await db.insert(schema.syncRuns).values({ kind, trigger }).returning();
  return run.id;
}

async function finishRun(id: number, status: string, stats: unknown, error?: string) {
  const db = await getDb();
  await db
    .update(schema.syncRuns)
    .set({ status, stats: stats as object, error: error ?? null, finishedAt: new Date() })
    .where(eq(schema.syncRuns.id, id));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runMailSync(opts: { trigger: string; lookbackDays?: number }): Promise<SyncStats | { locked: true }> {
  return withLock(async () => {
    const runId = await startRun("mail", opts.trigger);
    const stats: SyncStats = { listed: 0, fresh: 0, extracted: 0, triaged: 0, skipped: 0, created: 0, updated: 0, completed: 0, calendar: 0, errors: [], remaining: 0 };
    try {
      const conn = await googleConnection();
      if (!conn.connected || !conn.hasGmail) throw new Error("A Gmail nincs összekapcsolva (Beállítások → Kapcsolatok).");
      const [family, prefs] = await Promise.all([getFamily(), getPrefs()]);
      // Without a Claude key the sync runs on the rule-based Hungarian extractor.
      const useAI = aiConfigured();
      // EXTRACTION_MODE=external: the scheduled Claude run extracts items; the app only ingests mail.
      const external = !useAI && process.env.EXTRACTION_MODE === "external";
      const db = await getDb();
      const last = await kvGet<{ at: string }>("last_mail_sync");
      const sinceDays = last ? Math.max(2, Math.ceil((Date.now() - Date.parse(last.at)) / 86_400_000) + 1) : prefs.initialSyncDays;
      const lookback = Math.min(opts.lookbackDays ?? sinceDays, 60);

      const ids = await listMessageIds(`newer_than:${lookback}d -in:sent -in:drafts -in:spam -in:trash -in:chats`, useAI ? 500 : 1500);
      stats.listed = ids.length;
      const seen = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const rows = await db.select({ id: schema.emails.id, status: schema.emails.status }).from(schema.emails).where(inArray(schema.emails.id, chunk));
        rows.filter((r) => r.status !== "pending").forEach((r) => seen.add(r.id));
      }
      const fresh = ids.filter((id) => !seen.has(id));
      stats.fresh = fresh.length;
      const batch = fresh.slice(0, useAI ? prefs.maxEmailsPerRun : 400);
      stats.remaining = fresh.length - batch.length;

      // 1. fetch + classify
      const parsed: { email: ParsedEmail; cls: Classification }[] = [];
      await mapLimit(batch, 8, async (id) => {
        try {
          const email = await getMessage(id);
          const cls = classifyEmail(email, family);
          parsed.push({ email, cls });
          const row = {
            id: email.id,
            threadId: email.threadId,
            fromEmail: email.from.email,
            fromName: email.from.name,
            toEmails: [...email.to, ...email.cc].map((a) => a.email),
            subject: email.subject,
            receivedAt: email.date,
            snippet: email.snippet,
            excerpt: cls.mode === "skip" ? null : email.text.slice(0, 4000),
            labels: email.labels,
            category: cls.category,
            kidIds: cls.kidIds,
            attachments: email.attachments,
            links: email.links.slice(0, 20),
            status: cls.mode === "skip" ? "skipped" : external ? "awaiting_ai" : "pending",
            processedAt: cls.mode === "skip" ? new Date() : null,
          };
          await db.insert(schema.emails).values(row).onConflictDoUpdate({ target: schema.emails.id, set: row });
          if (cls.mode === "skip") stats.skipped++;
        } catch (e) {
          stats.errors.push(`${id}: ${(e as Error).message}`.slice(0, 200));
        }
      });

      const touched = new Set<string>();
      const knownKidIds = family.kids.map((k) => k.id);

      // 2. detailed extraction for school + finance mail (oldest first so later mails refine earlier ones)
      const toExtract = parsed.filter((p) => !external && p.cls.mode === "extract").sort((a, b) => a.email.date.getTime() - b.email.date.getTime());
      for (const { email, cls } of toExtract) {
        try {
          if (!useAI) {
            const r = ruleExtract(email, cls, family);
            const { created, updated } = r.items.length
              ? await applyDrafts({
                  drafts: r.items,
                  emailId: email.id,
                  contactName: cls.forwardedFrom?.name || cls.contact?.name || email.from.name || email.from.email,
                  knownKidIds,
                  minConfidence: prefs.minConfidenceForAuto,
                  source: "email",
                })
              : { created: [] as string[], updated: [] as string[] };
            const completed = r.paidDomain ? await completeBillsFrom(r.paidDomain, email.date) : [];
            [...created, ...updated, ...completed].forEach((id) => touched.add(id));
            stats.created += created.length;
            stats.updated += updated.length;
            stats.completed += completed.length;
            stats.extracted++;
            await db
              .update(schema.emails)
              .set({ status: "processed", summary: r.summary, kidIds: cls.kidIds, itemIds: [...created, ...updated, ...completed], processedAt: new Date(), error: null })
              .where(eq(schema.emails.id, email.id));
            continue;
          }
          const existing = await openItemsBrief(cls.kidIds);
          const result = await extractEmail(email, cls, family, existing);
          const kidIds = result.kid_ids.filter((k) => knownKidIds.includes(k));
          const { created, updated } = await applyDrafts({
            drafts: result.items,
            emailId: email.id,
            contactName: result.original_author || cls.forwardedFrom?.name || cls.contact?.name || email.from.name || email.from.email,
            knownKidIds,
            minConfidence: prefs.minConfidenceForAuto,
            source: "email",
          });
          await completeItems(result.completed_item_ids.filter((id) => existing.some((e) => e.id === id)));
          stats.completed += result.completed_item_ids.length;
          [...created, ...updated, ...result.completed_item_ids].forEach((id) => touched.add(id));
          stats.created += created.length;
          stats.updated += updated.length;
          stats.extracted++;
          await db
            .update(schema.emails)
            .set({
              status: "processed",
              summary: result.summary,
              kidIds: kidIds.length ? kidIds : cls.kidIds,
              category: cls.category === "finance" ? (result.category === "school_money" ? "school_money" : "finance") : cls.category,
              itemIds: [...created, ...updated],
              ai: result as object,
              processedAt: new Date(),
              error: null,
            })
            .where(eq(schema.emails.id, email.id));
        } catch (e) {
          const msg = (e as Error).message.slice(0, 300);
          stats.errors.push(`${email.subject}: ${msg}`);
          await db.update(schema.emails).set({ status: "error", error: msg }).where(eq(schema.emails.id, email.id));
        }
      }

      // 3. batched triage for newsletters / personal mail
      const toTriage = parsed.filter((p) => !external && p.cls.mode === "triage");
      if (!useAI) {
        for (const { email, cls } of toTriage) {
          try {
            const r = ruleExtract(email, cls, family);
            const itemIds: string[] = [];
            if (r.reading) {
              const [row] = await db
                .insert(schema.items)
                .values({
                  type: "reading",
                  area: "media",
                  title: r.reading.title,
                  details: r.summary,
                  url: /^https?:\/\//.test(r.reading.url) ? r.reading.url : null,
                  source: "email",
                  sourceEmailId: email.id,
                  sourceContact: r.reading.source,
                  confidence: 0.6,
                  date: todayISO(),
                  meta: { why: r.reading.why, minutes: r.reading.minutes, readingSource: r.reading.source, emailIds: [email.id] },
                })
                .returning();
              itemIds.push(row.id);
            }
            if (r.podcast) {
              const [row] = await db
                .insert(schema.items)
                .values({
                  type: "podcast",
                  area: "media",
                  title: r.podcast.episode,
                  details: r.summary,
                  url: /^https?:\/\//.test(r.podcast.url) ? r.podcast.url : null,
                  source: "email",
                  sourceEmailId: email.id,
                  sourceContact: r.podcast.show,
                  confidence: 0.6,
                  date: todayISO(),
                  meta: { why: r.podcast.why, show: r.podcast.show, episodeTitle: r.podcast.episode, spotifyQuery: r.podcast.query, worthy: false, emailIds: [email.id] },
                })
                .returning();
              itemIds.push(row.id);
            }
            stats.created += itemIds.length;
            await db
              .update(schema.emails)
              .set({ status: "processed", summary: r.summary, itemIds, processedAt: new Date(), error: null })
              .where(eq(schema.emails.id, email.id));
            stats.triaged++;
          } catch (e) {
            stats.errors.push(`${email.subject}: ${(e as Error).message}`.slice(0, 200));
          }
        }
      }
      for (let i = 0; useAI && i < toTriage.length; i += 10) {
        const chunk = toTriage.slice(i, i + 10);
        const input: TriageInput[] = chunk.map((p) => ({ email: p.email, excerptChars: p.cls.category === "newsletter" ? 2500 : 3500 }));
        try {
          const result = await triageEmails(input, family);
          for (const entry of result.emails) {
            const src = chunk.find((c) => c.email.id === entry.email_id);
            if (!src) continue;
            const itemIds: string[] = [];
            if (entry.items.length) {
              const { created, updated } = await applyDrafts({
                drafts: entry.items,
                emailId: src.email.id,
                contactName: src.email.from.name ?? src.email.from.email,
                knownKidIds,
                minConfidence: prefs.minConfidenceForAuto,
                source: "email",
              });
              itemIds.push(...created, ...updated);
              [...created, ...updated].forEach((id) => touched.add(id));
              stats.created += created.length;
              stats.updated += updated.length;
            }
            for (const r of result.readings.filter((x) => x.email_id === src.email.id)) {
              const [row] = await db
                .insert(schema.items)
                .values({
                  type: "reading",
                  area: "media",
                  title: r.title,
                  details: entry.summary,
                  url: /^https?:\/\//.test(r.url) ? r.url : null,
                  source: "email",
                  sourceEmailId: src.email.id,
                  sourceContact: r.source,
                  confidence: r.score,
                  date: todayISO(),
                  meta: { why: r.why, minutes: r.minutes > 0 ? r.minutes : undefined, readingSource: r.source, emailIds: [src.email.id] },
                })
                .returning();
              itemIds.push(row.id);
              stats.created++;
            }
            for (const p of result.podcasts.filter((x) => x.email_id === src.email.id)) {
              const [row] = await db
                .insert(schema.items)
                .values({
                  type: "podcast",
                  area: "media",
                  title: p.episode_title,
                  details: entry.summary,
                  url: /^https?:\/\//.test(p.url) ? p.url : null,
                  source: "email",
                  sourceEmailId: src.email.id,
                  sourceContact: p.show,
                  confidence: p.score,
                  date: todayISO(),
                  meta: {
                    why: p.why,
                    show: p.show,
                    episodeTitle: p.episode_title,
                    spotifyQuery: p.spotify_query,
                    worthy: p.worthy,
                    minutes: p.minutes > 0 ? p.minutes : undefined,
                    emailIds: [src.email.id],
                  },
                })
                .returning();
              itemIds.push(row.id);
              stats.created++;
            }
            await db
              .update(schema.emails)
              .set({ status: "processed", summary: entry.summary, itemIds, ai: entry as object, processedAt: new Date(), category: entry.kind === "noise" ? "promo" : src.cls.category })
              .where(eq(schema.emails.id, src.email.id));
            stats.triaged++;
          }
        } catch (e) {
          stats.errors.push(`triage: ${(e as Error).message}`.slice(0, 300));
        }
      }

      // 4. calendar
      if (prefs.autoCalendar && conn.hasCalendar && touched.size) {
        stats.calendar = await syncCalendarFor(Array.from(touched));
      }

      if (stats.remaining === 0) await kvSet("last_mail_sync", { at: new Date().toISOString() });
      await kvSet("last_sync_result", { at: new Date().toISOString(), stats });
      await finishRun(runId, stats.errors.length ? "partial" : "ok", stats);
      return stats;
    } catch (e) {
      const msg = (e as Error).message;
      stats.errors.push(msg);
      await kvSet("last_sync_result", { at: new Date().toISOString(), stats, error: msg });
      await finishRun(runId, "error", stats, msg);
      return stats;
    }
  });
}

/** A "payment successful" mail closes the latest open bill from the same sender domain. */
async function completeBillsFrom(domain: string, paidAt: Date): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.items.id, fromEmail: schema.emails.fromEmail, createdAt: schema.items.createdAt })
    .from(schema.items)
    .innerJoin(schema.emails, eq(schema.items.sourceEmailId, schema.emails.id))
    .where(and(eq(schema.items.type, "bill"), inArray(schema.items.status, ["open", "waiting"])))
    .orderBy(desc(schema.emails.receivedAt));
  const match = rows.find((r) => (r.fromEmail ?? "").toLowerCase().endsWith(domain.toLowerCase()));
  if (!match) return [];
  await db
    .update(schema.items)
    .set({ status: "done", paidAt, completedAt: paidAt, updatedAt: new Date() })
    .where(eq(schema.items.id, match.id));
  return [match.id];
}

export async function calendarContext(): Promise<CalendarContext> {
  const [family, prefs, conn] = await Promise.all([getFamily(), getPrefs(), googleConnection()]);
  return { family, prefs, busy: await loadBusy(prefs), appUrl: await getAppUrlSafe(), account: conn.account };
}

/** Pushes the given items (or every open dated item) to Google Calendar. */
export async function syncCalendarFor(itemIds?: string[], opts: { force?: boolean } = {}): Promise<number> {
  const conn = await googleConnection();
  if (!conn.hasCalendar) return 0;
  const db = await getDb();
  const today = todayISO();
  const rows: Item[] = itemIds
    ? itemIds.length
      ? await db.select().from(schema.items).where(inArray(schema.items.id, itemIds))
      : []
    : await db
        .select()
        .from(schema.items)
        .where(and(gte(schema.items.date, addDaysISO(today, -1)), ne(schema.items.type, "reading"), ne(schema.items.type, "podcast")));
  if (!rows.length) return 0;
  const ctx = await calendarContext();
  let n = 0;
  for (const item of rows) {
    if (item.date && item.date < addDaysISO(today, -1)) continue;
    const after = await syncItemCalendar(item, ctx, opts);
    if (after.calendarSyncedAt && after.calendarSyncedAt !== item.calendarSyncedAt) n++;
  }
  return n;
}

export type { StoredDigest } from "../digest-normalize";

export async function getDigest(date = todayISO()): Promise<StoredDigest | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.digests).where(eq(schema.digests.date, date)).limit(1);
  return row ? normalizeDigest(row.data, row.date) : null;
}

export async function latestDigest(): Promise<StoredDigest | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.digests).orderBy(desc(schema.digests.date)).limit(1);
  return row ? normalizeDigest(row.data, row.date) : null;
}

function itemLine(i: Item, family: Awaited<ReturnType<typeof getFamily>>): string {
  const kids = i.kidIds.map((k) => family.kids.find((x) => x.id === k)?.name ?? k).join(", ");
  const money = i.amount != null ? ` ${formatHuf(i.amount, i.currency ?? "HUF")}` : "";
  return `- [${i.id}] ${i.type}${i.assessmentKind ? `/${i.assessmentKind}` : ""}${i.category ? `/${i.category}` : ""} ${i.date ?? "?"}${i.time ? ` ${i.time}` : ""}${
    i.datePrecision !== "exact" ? ` (${i.datePrecision})` : ""
  } ${kids ? `(${kids}) ` : ""}${i.title}${money}${i.subject ? ` – ${i.subject}` : ""}`;
}

export async function runDigest(opts: { trigger: string; date?: string }): Promise<StoredDigest> {
  const runId = await startRun("digest", opts.trigger);
  try {
    const date = opts.date ?? todayISO();
    const db = await getDb();
    // A Claude-authored digest (written by the scheduled morning refresh) is never overwritten
    // by the rule-based fallback; the user can still force a rebuild from the UI.
    if (!aiConfigured() && opts.trigger === "cron") {
      const existing = await getDigest(date);
      if ((existing as { author?: string } | null)?.author === "claude") {
        await finishRun(runId, "ok", { note: "claude digest kept" });
        return existing!;
      }
    }
    const [family, prefs, conn] = await Promise.all([getFamily(), getPrefs(), googleConnection()]);

    const upcoming = await listItems({ statuses: ["open", "waiting"], from: addDaysISO(date, -14), to: addDaysISO(date, 10), types: ["task", "event", "reminder", "assessment", "payment", "bill"] });
    const undated = await listItems({ statuses: ["open", "waiting"], types: ["task", "payment", "bill"], limit: 30, order: "recent" });
    const overdue = upcoming.filter((i) => i.date && i.date < date && i.type !== "event");
    const media = await db
      .select()
      .from(schema.items)
      .where(and(inArray(schema.items.type, ["reading", "podcast"]), eq(schema.items.status, "open"), gte(schema.items.createdAt, new Date(Date.now() - 3 * 86_400_000))))
      .orderBy(desc(schema.items.confidence))
      .limit(25);
    const mails = await db
      .select()
      .from(schema.emails)
      .where(and(gte(schema.emails.receivedAt, new Date(Date.now() - 36 * 3_600_000)), eq(schema.emails.status, "processed")))
      .orderBy(desc(schema.emails.receivedAt))
      .limit(60);

    let agenda = "(naptár nincs összekapcsolva)";
    let agendaCount = 0;
    if (conn.hasCalendar) {
      try {
        const evs = (
          await Promise.all(
            Array.from(new Set([prefs.calendarId, ...prefs.readCalendarIds])).map((id) =>
              listEvents(id, localToDate(date, "00:00"), localToDate(addDaysISO(date, 2), "00:00")).catch(() => []),
            ),
          )
        ).flat();
        agendaCount = evs.filter((e) => (e.start.dateTime ? toLocal(new Date(e.start.dateTime)).date : e.start.date) === date).length;
        agenda =
          evs
            .map((e) => `- ${e.start.dateTime ? toLocal(new Date(e.start.dateTime)).date + " " + toLocal(new Date(e.start.dateTime)).time : e.start.date + " (egész nap)"} ${e.summary ?? ""}`)
            .sort()
            .join("\n") || "(nincs esemény)";
      } catch {
        /* ignore */
      }
    }

    const input = `Ma: ${date}.

## Naptár (ma és holnap)
${agenda}

## Lejárt / elmaradt
${overdue.map((i) => itemLine(i, family)).join("\n") || "(nincs)"}

## Közelgő 10 nap (nyitott tételek)
${upcoming.filter((i) => !i.date || i.date >= date).map((i) => itemLine(i, family)).join("\n") || "(nincs)"}

## Dátum nélküli nyitott teendők / fizetendők
${undated.filter((i) => !i.date).map((i) => itemLine(i, family)).join("\n") || "(nincs)"}

## Tegnapi és mai levelek (feldolgozva)
${mails.map((m) => `- [email ${m.id}] (${m.category}) ${m.fromName ?? m.fromEmail}: ${m.subject} — ${m.summary ?? ""}`).join("\n") || "(nincs)"}

## Olvasnivaló és podcast jelöltek
${media.map((m) => `- [${m.id}] ${m.type} score=${(m.confidence ?? 0).toFixed(2)} ${m.sourceContact ?? ""}: ${m.title} — ${m.meta?.why ?? ""}`).join("\n") || "(nincs)"}`;

    const openAll = Array.from(new Map([...upcoming, ...undated].map((i) => [i.id, i])).values());
    const digest = aiConfigured()
      ? await writeDigest(input, family)
      : ruleDigest({
          date,
          family,
          open: openAll,
          media,
          agendaCount,
          reviewCount: (await listItems({ needsReview: true, statuses: ["open", "waiting"] })).length,
          unsubscribe: await unsubscribeSuggestions(),
        });
    const validIds = new Set([...upcoming, ...undated, ...media].map((i) => i.id));
    const validEmails = new Set(mails.map((m) => m.id));
    const stored: StoredDigest = {
      ...digest,
      suggested_actions: digest.suggested_actions.map((a) => ({
        ...a,
        item_id: a.item_id && validIds.has(a.item_id) ? a.item_id : "",
        email_id: a.email_id && validEmails.has(a.email_id) ? a.email_id : "",
      })),
      reading_pick_ids: digest.reading_pick_ids.filter((id) => validIds.has(id)),
      podcast_pick_ids: digest.podcast_pick_ids.filter((id) => validIds.has(id)),
      generatedAt: new Date().toISOString(),
      date,
    };
    await db
      .insert(schema.digests)
      .values({ date, data: stored as object })
      .onConflictDoUpdate({ target: schema.digests.date, set: { data: stored as object, createdAt: new Date() } });
    await finishRun(runId, "ok", { actions: stored.suggested_actions.length });
    return stored;
  } catch (e) {
    await finishRun(runId, "error", null, (e as Error).message);
    throw e;
  }
}

/** Newsletter senders that keep arriving but are never opened — candidates to unsubscribe. */
export async function unsubscribeSuggestions(limit = 6) {
  const db = await getDb();
  const rows = await db
    .select({ fromEmail: schema.emails.fromEmail, fromName: schema.emails.fromName, labels: schema.emails.labels, category: schema.emails.category })
    .from(schema.emails)
    .where(and(gte(schema.emails.receivedAt, new Date(Date.now() - 30 * 86_400_000)), inArray(schema.emails.category, ["newsletter", "promo"])));
  const by = new Map<string, { name: string; total: number; unread: number }>();
  for (const r of rows) {
    if (!r.fromEmail) continue;
    const cur = by.get(r.fromEmail) ?? { name: r.fromName ?? r.fromEmail, total: 0, unread: 0 };
    cur.total++;
    if (r.labels.includes("UNREAD")) cur.unread++;
    by.set(r.fromEmail, cur);
  }
  return Array.from(by.entries())
    .map(([email, v]) => ({ email, ...v, ratio: v.unread / v.total }))
    .filter((v) => v.total >= 4 && v.ratio >= 0.8)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export async function lastSyncInfo() {
  return kvGet<{ at: string; stats: SyncStats; error?: string }>("last_sync_result");
}

export function isStale(at: string | undefined, minutes: number): boolean {
  return !at || Date.now() - Date.parse(at) > minutes * 60_000;
}

