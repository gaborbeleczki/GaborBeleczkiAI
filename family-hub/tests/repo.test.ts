import { beforeAll, describe, expect, it } from "vitest";
import type { ItemDraft } from "@/lib/ai/schemas";

process.env.PGLITE_DIR = "memory://";

const draft = (p: Partial<ItemDraft>): ItemDraft => ({
  type: "assessment",
  area: "school",
  title: "Angol témazáró – Unit 2",
  details: "",
  kid_ids: ["lili"],
  category: "none",
  subject: "Angol",
  assessment_kind: "temazaro",
  topics: "his/her mondatok",
  date: "2026-11-23",
  time: "",
  end_date: "2026-11-27",
  end_time: "",
  date_precision: "week",
  amount: 0,
  currency: "",
  payee: "",
  payment_account: "",
  payment_reference: "",
  payment_status: "none",
  invoice_number: "",
  url: "",
  priority: "high",
  estimate_minutes: 0,
  confidence: 0.6,
  source_quote: "",
  existing_item_id: "",
  ...p,
});

let repo: typeof import("@/lib/items/repo");

beforeAll(async () => {
  repo = await import("@/lib/items/repo");
});

describe("items repository (PGlite)", () => {
  it("merges a later, more precise announcement into the same item", async () => {
    const first = await repo.applyDrafts({ drafts: [draft({})], emailId: "m1", contactName: "Nagy Péter", knownKidIds: ["bence", "lili"], minConfidence: 0.7, source: "email" });
    expect(first.created).toHaveLength(1);
    const id = first.created[0];
    expect((await repo.getItem(id))?.needsReview).toBe(true);

    // Kréta later announces the exact day
    const second = await repo.applyDrafts({
      drafts: [draft({ title: "Angol témazáró", date: "2026-11-25", end_date: "", date_precision: "exact", confidence: 0.95, topics: "" })],
      emailId: "m2",
      contactName: "Kréta",
      knownKidIds: ["bence", "lili"],
      minConfidence: 0.7,
      source: "email",
    });
    expect(second.created).toHaveLength(0);
    expect(second.updated).toEqual([id]);
    const merged = await repo.getItem(id);
    expect(merged).toMatchObject({ date: "2026-11-25", datePrecision: "exact", topics: "his/her mondatok", needsReview: false });
    expect(merged?.meta.emailIds).toEqual(["m1", "m2"]);
  });

  it("honours an explicit existing_item_id and completes paid items", async () => {
    const { created } = await repo.applyDrafts({
      drafts: [draft({ type: "bill", area: "finance", title: "Telekom számla", subject: "", assessment_kind: "none", amount: 5939, currency: "HUF", date: "2026-11-25", end_date: "", date_precision: "exact", confidence: 0.95, payment_status: "unpaid" })],
      emailId: "b1",
      contactName: "Telekom",
      knownKidIds: [],
      minConfidence: 0.7,
      source: "email",
    });
    const id = created[0];
    const brief = await repo.openItemsBrief([]);
    expect(brief.some((b) => b.id === id)).toBe(true);
    await repo.completeItems([id]);
    const done = await repo.getItem(id);
    expect(done?.status).toBe("done");
    expect(done?.paidAt).toBeInstanceOf(Date);
  });

  it("filters items by kid", async () => {
    await repo.applyDrafts({ drafts: [draft({ type: "task", title: "Tornacucc", kid_ids: ["bence"], subject: "", assessment_kind: "none", date: "2026-11-26", end_date: "", date_precision: "exact", confidence: 0.9, category: "bring" })], emailId: null, contactName: null, knownKidIds: ["bence", "lili"], minConfidence: 0.7, source: "manual" });
    const bence = await repo.listItems({ kidId: "bence", types: ["task"] });
    expect(bence.map((i) => i.title)).toEqual(["Tornacucc"]);
    const lili = await repo.listItems({ kidId: "lili", types: ["task"] });
    expect(lili).toHaveLength(0);
  });
});
