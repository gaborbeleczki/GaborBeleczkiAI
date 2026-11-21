import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { Item, ItemMeta } from "../db/schema";
import type { ItemDraft } from "../ai/schemas";
import type { ExistingItemBrief } from "../ai/tasks";
import { draftToValues, findDuplicate, type ItemValues } from "./drafts";

const { items } = schema;

export type ItemFilter = {
  types?: string[];
  areas?: string[];
  statuses?: string[];
  kidId?: string;
  from?: string;
  to?: string;
  includeUndated?: boolean;
  needsReview?: boolean;
  limit?: number;
  order?: "date" | "recent";
};

export async function listItems(f: ItemFilter = {}): Promise<Item[]> {
  const db = await getDb();
  const where: SQL[] = [];
  if (f.types?.length) where.push(inArray(items.type, f.types));
  if (f.areas?.length) where.push(inArray(items.area, f.areas));
  if (f.statuses?.length) where.push(inArray(items.status, f.statuses));
  if (f.kidId) where.push(sql`${f.kidId} = ANY(${items.kidIds})`);
  if (f.needsReview !== undefined) where.push(eq(items.needsReview, f.needsReview));
  if (f.from || f.to) {
    const range: SQL[] = [];
    if (f.from) range.push(gte(sql`coalesce(${items.endDate}, ${items.date})`, f.from));
    if (f.to) range.push(lte(items.date, f.to));
    const dated = and(...range)!;
    where.push(f.includeUndated ? or(dated, isNull(items.date))! : dated);
  }
  const q = db
    .select()
    .from(items)
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      ...(f.order === "recent"
        ? [desc(items.createdAt)]
        : [sql`${items.date} asc nulls last`, sql`${items.time} asc nulls first`, asc(items.createdAt)]),
    );
  return f.limit ? q.limit(f.limit) : q;
}

export async function getItem(id: string): Promise<Item | null> {
  const db = await getDb();
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  return row ?? null;
}

export async function openItemsBrief(kidIds: string[] = [], limit = 60): Promise<ExistingItemBrief[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(items)
    .where(
      and(
        inArray(items.status, ["open", "waiting"]),
        inArray(items.type, ["task", "event", "reminder", "assessment", "payment", "bill"]),
        kidIds.length
          ? or(
              sql`${items.kidIds} && ARRAY[${sql.join(
                kidIds.map((k) => sql`${k}`),
                sql`, `,
              )}]::text[]`,
              sql`cardinality(${items.kidIds}) = 0`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(items.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    kidIds: r.kidIds,
    date: r.date,
    status: r.status,
    amount: r.amount,
    payee: r.payee,
  }));
}

function appendHistory(meta: ItemMeta, note: string): ItemMeta {
  const history = [...(meta.history ?? []), { at: new Date().toISOString(), note }].slice(-20);
  return { ...meta, history };
}

/** Insert or merge AI drafts. Returns ids of touched items. */
export async function applyDrafts(opts: {
  drafts: ItemDraft[];
  emailId: string | null;
  contactName: string | null;
  knownKidIds: string[];
  minConfidence: number;
  source: "email" | "ai" | "manual";
  createdBy?: string;
}): Promise<{ created: string[]; updated: string[] }> {
  const db = await getDb();
  const created: string[] = [];
  const updated: string[] = [];
  const candidates = await db
    .select()
    .from(items)
    .where(and(ne(items.status, "dismissed"), gte(items.createdAt, new Date(Date.now() - 120 * 86_400_000))));

  for (const draft of opts.drafts) {
    const v = draftToValues(draft, opts.knownKidIds, opts.minConfidence);
    const linked = draft.existing_item_id ? candidates.find((c) => c.id === draft.existing_item_id) : undefined;
    const dup = linked ?? findDuplicate(v, candidates.filter((c) => c.status !== "done" || c.type === "bill" || c.type === "payment"));

    if (dup) {
      const current = candidates.find((c) => c.id === dup.id)!;
      const patch = mergeValues(current, v);
      const meta = appendHistory(
        { ...(current.meta ?? {}), emailIds: Array.from(new Set([...(current.meta?.emailIds ?? []), ...(opts.emailId ? [opts.emailId] : [])])) },
        opts.emailId ? "Frissítve egy újabb levél alapján" : "Frissítve",
      );
      await db.update(items).set({ ...patch, meta, updatedAt: new Date() }).where(eq(items.id, dup.id));
      Object.assign(current, patch, { meta });
      updated.push(dup.id);
      continue;
    }

    const [row] = await db
      .insert(items)
      .values({
        ...v,
        source: opts.source,
        sourceEmailId: opts.emailId,
        sourceContact: opts.contactName,
        createdBy: opts.createdBy ?? null,
        meta: { emailIds: opts.emailId ? [opts.emailId] : [] },
        completedAt: v.status === "done" ? new Date() : null,
      })
      .returning();
    candidates.push(row);
    created.push(row.id);
  }
  return { created, updated };
}

/** Prefer more precise / newer information without clobbering user edits like done/paid. */
function mergeValues(cur: Item, v: ItemValues): Partial<Item> {
  const rank = { exact: 3, week: 2, month: 1, unknown: 0 } as Record<string, number>;
  const patch: Partial<Item> = {};
  if (v.date && (rank[v.datePrecision] ?? 0) >= (rank[cur.datePrecision] ?? 0)) {
    patch.date = v.date;
    patch.endDate = v.endDate;
    patch.datePrecision = v.datePrecision;
    if (v.time) patch.time = v.time;
    if (v.endTime) patch.endTime = v.endTime;
  }
  if (v.details && (!cur.details || !cur.details.includes(v.details))) patch.details = cur.details ? `${cur.details}\n${v.details}`.slice(0, 2000) : v.details;
  if (v.topics && !cur.topics) patch.topics = v.topics;
  if (v.amount != null && cur.amount == null) patch.amount = v.amount;
  if (v.payee && !cur.payee) patch.payee = v.payee;
  if (v.paymentInfo && !cur.paymentInfo) patch.paymentInfo = v.paymentInfo;
  if (v.kidIds.length) patch.kidIds = Array.from(new Set([...cur.kidIds, ...v.kidIds]));
  if (v.status === "done" && cur.status !== "done") {
    patch.status = "done";
    patch.paidAt = v.paidAt;
    patch.completedAt = new Date();
  }
  if ((v.confidence ?? 0) > (cur.confidence ?? 0)) {
    patch.confidence = v.confidence;
    patch.needsReview = v.needsReview && cur.needsReview;
  }
  if (v.priority === "high") patch.priority = "high";
  return patch;
}

export async function completeItems(ids: string[], note = "Teljesítve (levél alapján)"): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const rows = await db.select().from(items).where(inArray(items.id, ids));
  for (const r of rows) {
    if (r.status === "done") continue;
    await db
      .update(items)
      .set({
        status: "done",
        completedAt: new Date(),
        paidAt: r.type === "bill" || r.type === "payment" ? new Date() : r.paidAt,
        meta: appendHistory(r.meta ?? {}, note),
        updatedAt: new Date(),
      })
      .where(eq(items.id, r.id));
  }
}

export async function updateItem(id: string, patch: Partial<typeof items.$inferInsert>): Promise<Item | null> {
  const db = await getDb();
  const [row] = await db.update(items).set({ ...patch, updatedAt: new Date() }).where(eq(items.id, id)).returning();
  return row ?? null;
}

export async function insertItem(v: typeof items.$inferInsert): Promise<Item> {
  const db = await getDb();
  const [row] = await db.insert(items).values(v).returning();
  return row;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(items).where(eq(items.id, id));
}
