import { describe, expect, it } from "vitest";
import type { ItemDraft } from "@/lib/ai/schemas";
import { draftToValues, findDuplicate, titleSimilarity } from "@/lib/items/drafts";

const base: ItemDraft = {
  type: "task",
  area: "school",
  title: "Pom Pom könyv bevitele",
  details: "",
  kid_ids: ["lili"],
  category: "bring",
  subject: "",
  assessment_kind: "none",
  topics: "",
  date: "2026-11-23",
  time: "",
  end_date: "",
  end_time: "",
  date_precision: "exact",
  amount: 0,
  currency: "",
  payee: "",
  payment_account: "",
  payment_reference: "",
  payment_status: "none",
  invoice_number: "",
  url: "",
  priority: "normal",
  estimate_minutes: 0,
  confidence: 0.9,
  source_quote: "",
  existing_item_id: "",
};
const kids = ["bence", "lili"];

describe("draftToValues", () => {
  it("keeps a clean, confident draft as-is", () => {
    const v = draftToValues(base, kids);
    expect(v).toMatchObject({ type: "task", date: "2026-11-23", kidIds: ["lili"], needsReview: false, status: "open" });
  });
  it("drops invalid dates/times and unknown kids, and flags review", () => {
    const v = draftToValues({ ...base, type: "event", date: "2026-02-31", time: "25:00", kid_ids: ["ghost"] }, kids);
    expect(v.date).toBeNull();
    expect(v.time).toBeNull();
    expect(v.kidIds).toEqual([]);
    expect(v.datePrecision).toBe("unknown");
    expect(v.needsReview).toBe(true);
  });
  it("marks week-only assessments for review", () => {
    const v = draftToValues({ ...base, type: "assessment", assessment_kind: "temazaro", subject: "Angol", date: "2026-11-23", end_date: "2026-11-27", date_precision: "week" }, kids);
    expect(v).toMatchObject({ datePrecision: "week", endDate: "2026-11-27", needsReview: true, assessmentKind: "temazaro" });
  });
  it("treats receipts and direct debits as paid", () => {
    const v = draftToValues({ ...base, type: "bill", area: "finance", amount: 5939, currency: "Ft", payment_status: "autopay" }, kids);
    expect(v).toMatchObject({ status: "done", area: "finance", currency: "HUF", amount: 5939 });
    expect(v.paidAt).toBeInstanceOf(Date);
    expect(v.paymentInfo?.method).toBe("csoportos beszedés");
  });
  it("rejects negative or non-finite amounts", () => {
    expect(draftToValues({ ...base, type: "payment", amount: -5 }, kids).amount).toBeNull();
  });
});

describe("duplicate detection", () => {
  it("scores Hungarian titles accent-insensitively", () => {
    expect(titleSimilarity("Angol témazáró – Unit 2", "angol temazaro unit 2")).toBe(1);
  });
  it("merges the same assessment announced twice", () => {
    const v = draftToValues({ ...base, type: "assessment", title: "Angol témazáró", subject: "Angol", assessment_kind: "temazaro", date: "2026-11-25" }, kids);
    const dup = findDuplicate(v, [
      { id: "a", type: "assessment", title: "Unit 2 témazáró angolból", kidIds: ["lili"], date: "2026-11-23", amount: null, subject: "angol", assessmentKind: "temazaro" },
      { id: "b", type: "assessment", title: "Angol témazáró", kidIds: ["bence"], date: "2026-11-25", amount: null, subject: "Angol", assessmentKind: "temazaro" },
    ]);
    expect(dup?.id).toBe("a");
  });
  it("does not merge far-apart dates", () => {
    const v = draftToValues(base, kids);
    expect(findDuplicate(v, [{ id: "x", type: "task", title: "Pom Pom könyv bevitele", kidIds: ["lili"], date: "2027-01-10", amount: null, subject: null, assessmentKind: null }])).toBeNull();
  });
});

describe("sentinel handling", () => {
  it("turns empty strings, zeros and 'none' into nulls", () => {
    const v = draftToValues({ ...base, category: "none", amount: 0, subject: "", url: "", payment_status: "none" }, kids);
    expect(v).toMatchObject({ category: null, amount: null, subject: null, url: null, paymentInfo: null });
  });
  it("normalises enum casing defensively", () => {
    const v = draftToValues({ ...base, type: "Event" as ItemDraft["type"], priority: "High" as ItemDraft["priority"] }, kids);
    expect(v.type).toBe("event");
    expect(v.priority).toBe("high");
  });
});
