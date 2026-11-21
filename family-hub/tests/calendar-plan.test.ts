import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/db/schema";
import { DEFAULT_PREFERENCES } from "@/lib/family/types";
import { planMainEvent, planPrepBlocks, shouldHaveCalendar, type CalendarContext } from "@/lib/sync/calendar-sync";
import { addDaysISO, localToDate, todayISO, weekdayISO } from "@/lib/time";
import { family } from "./fixtures";

const today = todayISO();
// next Wednesday at least 5 days away keeps the test independent of the run date
let due = addDaysISO(today, 5);
while (weekdayISO(due) !== 3) due = addDaysISO(due, 1);

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
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...p,
  };
}

const ctx = (busy: CalendarContext["busy"] = []): CalendarContext => ({ prefs: DEFAULT_PREFERENCES, family, busy, appUrl: "https://hub.test", account: null });

describe("calendar planning", () => {
  it("reminds to pack the evening before", () => {
    const ev = planMainEvent(item({ category: "bring" }), ctx());
    expect(ev.start).toEqual({ dateTime: `${addDaysISO(due, -1)}T19:30:00`, timeZone: "Europe/Budapest" });
  });

  it("timeboxes a task into free time the day before", () => {
    const prev = addDaysISO(due, -1);
    const ev = planMainEvent(item({ category: "prepare", estimateMinutes: 30 }), ctx([{ start: localToDate(prev, "19:00"), end: localToDate(prev, "19:30") }]));
    expect(ev.start.dateTime).toBe(`${prev}T18:30:00`);
    expect(ev.end.dateTime).toBe(`${prev}T19:00:00`);
  });

  it("places a payment slot two days before the deadline", () => {
    const ev = planMainEvent(item({ type: "payment", amount: 3000 }), ctx());
    expect(ev.start.dateTime?.startsWith(addDaysISO(due, -2))).toBe(true);
  });

  it("creates study blocks before a témazáró on free afternoons", () => {
    const blocked = addDaysISO(due, -1);
    const blocks = planPrepBlocks(
      item({ type: "assessment", assessmentKind: "temazaro", subject: "Angol" }),
      ctx([{ start: localToDate(blocked, "00:00"), end: localToDate(blocked, "23:59") }]),
    );
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.date)).not.toContain(blocked);
    expect(blocks.every((b) => b.date < due)).toBe(true);
    expect(new Set(blocks.map((b) => b.date)).size).toBe(3);
  });

  it("keeps unsure or week-only items off the calendar", () => {
    expect(shouldHaveCalendar(item({ datePrecision: "week" }), DEFAULT_PREFERENCES)).toBe(false);
    expect(shouldHaveCalendar(item({ needsReview: true, confidence: 0.5 }), DEFAULT_PREFERENCES)).toBe(false);
    expect(shouldHaveCalendar(item({ type: "bill", status: "done" }), DEFAULT_PREFERENCES)).toBe(false);
    expect(shouldHaveCalendar(item({ type: "event", status: "done" }), DEFAULT_PREFERENCES)).toBe(true);
    expect(shouldHaveCalendar(item({ type: "reading" }), DEFAULT_PREFERENCES)).toBe(false);
  });
});
