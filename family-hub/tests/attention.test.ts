import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/db/schema";
import { primaryAction, selectFresh, selectTop, urgency } from "@/lib/attention";
import { addDaysISO } from "@/lib/time";

const today = "2026-11-25";
const now = new Date("2026-11-25T08:00:00+01:00");
const due = today;

function item(p: Partial<Item>): Item {
  return {
    id: "i1",
    type: "task",
    area: "school",
    title: "Teszt",
    details: null,
    kidIds: ["bence"],
    category: null,
    subject: null,
    assessmentKind: null,
    topics: null,
    date: due,
    time: null,
    endDate: null,
    endTime: null,
    datePrecision: "exact",
    status: "open",
    priority: "normal",
    needsReview: false,
    confidence: 0.95,
    estimateMinutes: null,
    amount: null,
    currency: null,
    payee: null,
    paymentInfo: null,
    paidAt: null,
    url: null,
    source: "email",
    sourceEmailId: null,
    sourceContact: null,
    sourceQuote: null,
    meta: {},
    calendarEventId: null,
    calendarPrepIds: [],
    calendarSyncedAt: null,
    calendarError: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...p,
  };
}

describe("urgency", () => {
  it("ranks overdue tasks above today, today above tomorrow", () => {
    const overdue = urgency(item({ date: addDaysISO(today, -2) }), today);
    const t = urgency(item({ date: today }), today);
    const tm = urgency(item({ date: addDaysISO(today, 1) }), today);
    expect(overdue.reason).toBe("lejárt");
    expect(t.reason).toBe("ma");
    expect(tm.reason).toBe("holnap");
    expect(overdue.score).toBeGreaterThan(t.score);
    expect(t.score).toBeGreaterThan(tm.score);
  });
  it("treats a running week-precision exam as 'a héten', and past events as irrelevant", () => {
    const wk = urgency(item({ type: "assessment", date: addDaysISO(today, -2), endDate: addDaysISO(today, 2), datePrecision: "week" }), today);
    expect(wk.reason).toBe("a héten");
    expect(urgency(item({ type: "event", date: addDaysISO(today, -1) }), today).score).toBe(0);
  });
});

describe("selectFresh", () => {
  const old = new Date(now.getTime() - 10 * 86_400_000);
  it("keeps recent untriaged scan items, drops triaged/snoozed/manual/old/past ones", () => {
    const items = [
      item({ id: "new", date: addDaysISO(today, 3) }),
      item({ id: "triaged", meta: { triage: { at: now.toISOString(), action: "ack" } } }),
      item({ id: "snoozed", meta: { snoozeUntil: addDaysISO(today, 1) } }),
      item({ id: "snooze-over", meta: { snoozeUntil: today } }),
      item({ id: "manual", source: "manual" }),
      item({ id: "old", createdAt: old }),
      item({ id: "old-review", createdAt: old, needsReview: true }),
      item({ id: "past-event", type: "event", date: addDaysISO(today, -1) }),
      item({ id: "done", status: "done" }),
      item({ id: "reading", type: "reading" }),
    ];
    expect(selectFresh(items, today, now).map((i) => i.id).sort()).toEqual(["new", "old-review", "snooze-over"]);
  });
  it("orders the deck by urgency", () => {
    const items = [item({ id: "later", date: addDaysISO(today, 6) }), item({ id: "today", date: today }), item({ id: "overdue", date: addDaysISO(today, -1) })];
    expect(selectFresh(items, today, now).map((i) => i.id)).toEqual(["overdue", "today", "later"]);
  });
});

describe("selectTop", () => {
  it("returns only urgent items, at most the limit", () => {
    const items = [
      item({ id: "a", date: today }),
      item({ id: "b", date: addDaysISO(today, 1) }),
      item({ id: "c", date: addDaysISO(today, 10) }),
      item({ id: "d", date: addDaysISO(today, 6), priority: "high" }),
      item({ id: "e", date: addDaysISO(today, -3) }),
    ];
    const top = selectTop(items, today, 3).map((x) => x.item.id);
    expect(top).toEqual(["e", "a", "b"]);
    expect(selectTop(items, today).map((x) => x.item.id)).not.toContain("c");
  });
});

describe("primaryAction", () => {
  it("maps the right swipe to what makes sense per type", () => {
    expect(primaryAction("bill", true).action).toBe("paid");
    expect(primaryAction("task", true).action).toBe("done");
    expect(primaryAction("event", true).action).toBe("calendar");
    expect(primaryAction("event", false).action).toBe("ack");
    expect(primaryAction("assessment", true).label).toMatch(/naptár/);
  });
});
