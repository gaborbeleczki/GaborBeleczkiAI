import "server-only";
import { createHash } from "node:crypto";
import type { Item } from "../db/schema";
import type { FamilyConfig, KidColor, Preferences } from "../family/types";
import { deleteEvent, insertEvent, listEvents, patchEvent, type GEvent } from "../google/calendar";
import { gmailUrl } from "../google/gmail";
import { updateItem } from "../items/repo";
import { addDaysISO, addMinutesHHMM, formatHuf, localToDate, TZ, todayISO, toLocal, weekdayISO } from "../time";
import { findSlot } from "./slots";

export type BusyInterval = { start: Date; end: Date; itemId?: string };

export type CalendarContext = {
  prefs: Preferences;
  family: FamilyConfig;
  busy: BusyInterval[];
  appUrl: string;
  account: string | null;
};

const KID_COLOR_ID: Record<KidColor, string> = { sky: "7", rose: "4", violet: "3", amber: "5", emerald: "10", teal: "2" };
const PREP_BLOCKS: Record<string, number> = { temazaro: 3, dolgozat: 2, beadando: 3, felmeres: 1, teszt: 1, szobeli: 1, egyeb: 1 };
export const ASSESSMENT_LABEL: Record<string, string> = {
  dolgozat: "dolgozat",
  temazaro: "témazáró",
  beadando: "beadandó",
  felmeres: "felmérés",
  teszt: "teszt",
  szobeli: "szóbeli",
  egyeb: "számonkérés",
};

export async function loadBusy(prefs: Preferences): Promise<BusyInterval[]> {
  const from = localToDate(todayISO(), "00:00");
  const to = localToDate(addDaysISO(todayISO(), 45), "00:00");
  const ids = Array.from(new Set([prefs.calendarId, ...prefs.readCalendarIds]));
  const out: BusyInterval[] = [];
  for (const id of ids) {
    try {
      const events = await listEvents(id, from, to);
      for (const e of events) {
        if (!e.start.dateTime || !e.end.dateTime || e.transparency === "transparent") continue;
        out.push({
          start: new Date(e.start.dateTime),
          end: new Date(e.end.dateTime),
          itemId: e.extendedProperties?.private?.itemId,
        });
      }
    } catch {
      // a calendar we cannot read should not block the sync
    }
  }
  return out;
}

function kidPrefix(item: Item, family: FamilyConfig): string {
  const names = item.kidIds.map((id) => family.kids.find((k) => k.id === id)?.name ?? id);
  return names.length ? `${names.join(", ")}: ` : "";
}

function emoji(item: Item): string {
  if (item.type === "assessment") return "📝";
  if (item.type === "payment") return "💸";
  if (item.type === "bill") return "🧾";
  if (item.type === "reminder") return "🔔";
  if (item.type === "event") return "📅";
  if (item.category === "bring") return "🎒";
  return "✅";
}

function colorFor(item: Item, family: FamilyConfig): string | undefined {
  const kid = family.kids.find((k) => k.id === item.kidIds[0]);
  if (kid) return KID_COLOR_ID[kid.color];
  if (item.type === "bill" || item.type === "payment") return "6";
  return "8";
}

function describe(item: Item, ctx: CalendarContext): string {
  const lines: string[] = [];
  if (item.details) lines.push(item.details);
  if (item.topics) lines.push(`Miből: ${item.topics}`);
  if (item.amount != null) lines.push(`Összeg: ${formatHuf(item.amount, item.currency ?? "HUF")}${item.payee ? ` – ${item.payee}` : ""}`);
  if (item.paymentInfo?.account) lines.push(`Számla/link: ${item.paymentInfo.account}`);
  if (item.paymentInfo?.reference) lines.push(`Közlemény: ${item.paymentInfo.reference}`);
  if (item.sourceContact) lines.push(`Forrás: ${item.sourceContact}`);
  if (item.sourceEmailId) lines.push(`Levél: ${gmailUrl(item.sourceEmailId, ctx.account)}`);
  lines.push(`Family Hub: ${ctx.appUrl}/teendok?item=${item.id}`);
  return lines.join("\n");
}

export function shouldHaveCalendar(item: Item, prefs: Preferences): boolean {
  if (["reading", "podcast"].includes(item.type)) return false;
  if (item.status === "dismissed") return false;
  if (!item.date || item.datePrecision !== "exact") return false;
  if (item.source !== "manual" && item.needsReview && (item.confidence ?? 0) < prefs.minConfidenceForAuto) return false;
  if (item.status === "done" && ["task", "payment", "bill", "reminder"].includes(item.type)) return false;
  return true;
}

function calendarKey(item: Item, prefs: Preferences): string {
  return createHash("sha1")
    .update(
      JSON.stringify([
        item.type,
        item.title,
        item.date,
        item.time,
        item.endDate,
        item.endTime,
        item.kidIds,
        item.status,
        item.category,
        item.assessmentKind,
        prefs.calendarId,
        prefs.studyBlockMinutes,
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}

function windowFor(date: string, prefs: Preferences): [string, string] {
  return weekdayISO(date) >= 6 ? prefs.studyWindowWeekend : prefs.studyWindowWeekday;
}

function timed(date: string, start: string, end: string): Pick<GEvent, "start" | "end"> {
  return { start: { dateTime: `${date}T${start}:00`, timeZone: TZ }, end: { dateTime: `${date}T${end}:00`, timeZone: TZ } };
}

function allDay(date: string, endDate?: string | null): Pick<GEvent, "start" | "end"> {
  return { start: { date }, end: { date: addDaysISO(endDate && endDate >= date ? endDate : date, 1) } };
}

function busyFor(ctx: CalendarContext, itemId: string) {
  return ctx.busy.filter((b) => b.itemId !== itemId);
}

/** Main calendar entry for an item, with timeboxing for tasks and payments. */
export function planMainEvent(item: Item, ctx: CalendarContext): Pick<GEvent, "start" | "end" | "reminders"> {
  const today = todayISO();
  const date = item.date!;
  const busy = busyFor(ctx, item.id);
  const popup = (minutes: number) => ({ useDefault: false, overrides: [{ method: "popup" as const, minutes }] });

  if (item.type === "event" || item.type === "reminder") {
    if (item.time) {
      const end = item.endTime ?? addMinutesHHMM(item.time, item.type === "reminder" ? 15 : 60);
      return { ...timed(date, item.time, end), reminders: popup(item.type === "reminder" ? 0 : 60) };
    }
    return { ...allDay(date, item.endDate), reminders: popup(360) };
  }
  if (item.type === "assessment") {
    return { ...allDay(date), reminders: popup(360) };
  }
  if (item.type === "task") {
    if (item.time) {
      return { ...timed(date, item.time, item.endTime ?? addMinutesHHMM(item.time, item.estimateMinutes ?? 30)), reminders: popup(15) };
    }
    if (item.category === "bring") {
      const day = addDaysISO(date, -1) >= today ? addDaysISO(date, -1) : date;
      const start = day === date ? "07:00" : ctx.prefs.eveningPrepTime;
      return { ...timed(day, start, addMinutesHHMM(start, 15)), reminders: popup(0) };
    }
    const minutes = Math.round(Math.min(120, Math.max(15, item.estimateMinutes ?? 20)) / 5) * 5;
    for (const day of [addDaysISO(date, -1), date]) {
      if (day < today) continue;
      const slot = findSlot({ date: day, window: windowFor(day, ctx.prefs), duration: minutes, busy, preferLate: true });
      if (slot) return { ...timed(day, slot.start, slot.end), reminders: popup(10) };
    }
    return { ...allDay(date), reminders: popup(360) };
  }
  // payment / bill → a short slot two days before the deadline
  for (const offset of [-2, -1, 0]) {
    const day = addDaysISO(date, offset);
    if (day < today) continue;
    const slot = findSlot({ date: day, window: ["18:00", "21:00"], duration: 15, busy });
    if (slot) return { ...timed(day, slot.start, slot.end), reminders: popup(0) };
  }
  return { ...allDay(date), reminders: popup(360) };
}

/** Study/practice blocks on the days before an assessment, placed in free time. */
export function planPrepBlocks(item: Item, ctx: CalendarContext): { date: string; start: string; end: string }[] {
  if (item.type !== "assessment" || item.status !== "open" || !item.date) return [];
  const today = todayISO();
  const want = PREP_BLOCKS[item.assessmentKind ?? "egyeb"] ?? 1;
  const out: { date: string; start: string; end: string }[] = [];
  const busy = [...busyFor(ctx, item.id)];
  for (let back = 1; back <= 6 && out.length < want; back++) {
    const day = addDaysISO(item.date, -back);
    if (day < today) break;
    if (day === today && toLocal().time >= "20:00") continue;
    const slot = findSlot({ date: day, window: windowFor(day, ctx.prefs), duration: ctx.prefs.studyBlockMinutes, busy });
    if (!slot) continue;
    out.push({ date: day, ...slot });
    busy.push({ start: localToDate(day, slot.start), end: localToDate(day, slot.end) });
  }
  return out.reverse();
}

export async function syncItemCalendar(item: Item, ctx: CalendarContext, opts: { force?: boolean } = {}): Promise<Item> {
  const calId = ctx.prefs.calendarId;
  const removeAll = async () => {
    if (item.calendarEventId) await deleteEvent(calId, item.calendarEventId);
    for (const id of item.calendarPrepIds ?? []) await deleteEvent(calId, id);
  };

  try {
    if (!shouldHaveCalendar(item, ctx.prefs)) {
      if (item.calendarEventId || item.calendarPrepIds?.length) {
        // keep past events as history, remove the future ones
        await removeAll();
        return (
          (await updateItem(item.id, {
            calendarEventId: null,
            calendarPrepIds: [],
            calendarSyncedAt: new Date(),
            calendarError: null,
            meta: { ...item.meta, calendarKey: undefined },
          })) ?? item
        );
      }
      return item;
    }

    const key = calendarKey(item, ctx.prefs);
    if (!opts.force && item.calendarEventId && item.meta?.calendarKey === key) return item;

    const main = planMainEvent(item, ctx);
    const ev: GEvent = {
      summary: `${emoji(item)} ${kidPrefix(item, ctx.family)}${item.title}${item.status === "done" ? " ✓" : ""}`,
      description: describe(item, ctx),
      colorId: colorFor(item, ctx.family),
      ...main,
      extendedProperties: { private: { familyHub: "1", itemId: item.id, role: "main" } },
      source: { title: "Family Hub", url: `${ctx.appUrl}/teendok?item=${item.id}` },
    };

    let mainId = item.calendarEventId;
    if (mainId) {
      try {
        await patchEvent(calId, mainId, ev);
      } catch (e) {
        if ((e as { status?: number }).status === 404 || (e as { status?: number }).status === 410) mainId = null;
        else throw e;
      }
    }
    if (!mainId) mainId = (await insertEvent(calId, ev)).id ?? null;
    if (ev.start.dateTime && ev.end.dateTime) {
      const [sd, st] = ev.start.dateTime.split("T");
      const [ed, et] = ev.end.dateTime.split("T");
      ctx.busy.push({ start: localToDate(sd, st.slice(0, 5)), end: localToDate(ed, et.slice(0, 5)), itemId: item.id });
    }

    // prep blocks are always rebuilt (cheap, keeps them aligned with the latest date)
    for (const id of item.calendarPrepIds ?? []) await deleteEvent(calId, id);
    const prepIds: string[] = [];
    const blocks = planPrepBlocks(item, ctx);
    const label = ASSESSMENT_LABEL[item.assessmentKind ?? "egyeb"];
    for (const [i, b] of blocks.entries()) {
      const created = await insertEvent(calId, {
        summary: `📚 ${kidPrefix(item, ctx.family)}${item.subject ?? ""} ${label} – gyakorlás (${i + 1}/${blocks.length})`.replace(/\s+/g, " "),
        description: [item.topics ? `Miből: ${item.topics}` : null, `Számonkérés: ${item.date}`, `Family Hub: ${ctx.appUrl}/szamonkeresek`]
          .filter(Boolean)
          .join("\n"),
        colorId: colorFor(item, ctx.family),
        ...timed(b.date, b.start, b.end),
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
        extendedProperties: { private: { familyHub: "1", itemId: item.id, role: "prep" } },
      });
      if (created.id) prepIds.push(created.id);
      ctx.busy.push({ start: localToDate(b.date, b.start), end: localToDate(b.date, b.end), itemId: item.id });
    }

    return (
      (await updateItem(item.id, {
        calendarEventId: mainId,
        calendarPrepIds: prepIds,
        calendarSyncedAt: new Date(),
        calendarError: null,
        meta: { ...item.meta, calendarKey: key, calendarDate: item.date ?? undefined },
      })) ?? item
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (await updateItem(item.id, { calendarError: msg.slice(0, 300) })) ?? item;
  }
}
