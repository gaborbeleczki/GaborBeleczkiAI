import type { Item } from "./db/schema";
import { addDaysISO, diffDays } from "./time";

/** What the user did with a card in the morning-scan deck. */
export type TriageAction = "done" | "paid" | "calendar" | "ack" | "dismiss" | "star" | "later";

export type TriageMeta = { at: string; action: TriageAction };

const ACTIONABLE = new Set(["task", "event", "reminder", "assessment", "payment", "bill"]);
const FRESH_DAYS = 7;

/**
 * Urgency score used both to order the swipe deck and to pick the day's top priorities.
 * Higher = more urgent. Purely date/priority based so it is predictable for the family.
 */
export function urgency(i: Item, today: string): { score: number; reason: string } {
  let score = 0;
  let reason = "";
  if (i.date) {
    const start = diffDays(today, i.date);
    const end = i.endDate ? diffDays(today, i.endDate) : start;
    const fuzzy = i.datePrecision !== "exact";
    if (end < 0 && i.type !== "event" && i.type !== "assessment") {
      score = 100;
      reason = "lejárt";
    } else if (end < 0) {
      score = 0;
    } else if (fuzzy && start <= 0 && end >= 0) {
      score = 60;
      reason = "a héten";
    } else if (start === 0) {
      score = 90;
      reason = "ma";
    } else if (start === 1) {
      score = 70;
      reason = "holnap";
    } else if (start <= 3) {
      score = 50;
      reason = `${start} nap múlva`;
    } else if (start <= 7) {
      score = 30;
      reason = `${start} nap múlva`;
    } else {
      score = 10;
    }
  } else if (i.type === "payment" || i.type === "bill") {
    score = 25;
    reason = "fizetendő";
  } else {
    score = 15;
  }
  if (i.priority === "high") {
    score += 20;
    if (!reason) reason = "fontos";
  }
  if (i.type === "assessment" && i.assessmentKind === "temazaro") score += 15;
  if (i.status === "waiting") score -= 20;
  if (i.needsReview) score += 3;
  return { score, reason };
}

function meta(i: Item) {
  return (i.meta ?? {}) as { triage?: TriageMeta; snoozeUntil?: string };
}

/** Items from the daily mail scan that still need a decision: the swipe deck. */
export function selectFresh(items: Item[], today: string, now = new Date()): Item[] {
  const cutoff = now.getTime() - FRESH_DAYS * 86_400_000;
  return items
    .filter((i) => ACTIONABLE.has(i.type) && (i.status === "open" || i.status === "waiting"))
    .filter((i) => i.source === "email")
    .filter((i) => !meta(i).triage)
    .filter((i) => !meta(i).snoozeUntil || meta(i).snoozeUntil! <= today)
    .filter((i) => i.needsReview || new Date(i.createdAt).getTime() >= cutoff)
    .filter((i) => {
      // events/assessments that are already over need no decision
      if (i.type !== "event" && i.type !== "assessment") return true;
      const last = i.endDate ?? i.date;
      return !last || last >= today;
    })
    .map((i) => ({ i, u: urgency(i, today) }))
    .sort((a, b) => b.u.score - a.u.score || +new Date(b.i.createdAt) - +new Date(a.i.createdAt))
    .map((x) => x.i);
}

/** The handful of things that matter most today (overdue, today, tomorrow, this-week exams, high priority). */
export function selectTop(items: Item[], today: string, limit = 5): { item: Item; reason: string; score: number }[] {
  return items
    .filter((i) => ACTIONABLE.has(i.type) && (i.status === "open" || i.status === "waiting"))
    .filter((i) => !meta(i).snoozeUntil || meta(i).snoozeUntil! <= today || (i.date !== null && i.date <= addDaysISO(today, 1)))
    .map((item) => ({ item, ...urgency(item, today) }))
    .filter((x) => x.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** The "positive" swipe (→) that makes sense for each item type. */
export function primaryAction(type: string, calendarEnabled: boolean): { action: TriageAction; label: string } {
  if (type === "payment" || type === "bill") return { action: "paid", label: "Fizetve" };
  if (type === "event") return calendarEnabled ? { action: "calendar", label: "Naptárba" } : { action: "ack", label: "Rendben" };
  if (type === "assessment") return calendarEnabled ? { action: "calendar", label: "Gyakorlás a naptárba" } : { action: "ack", label: "Rendben" };
  return { action: "done", label: "Kész" };
}
