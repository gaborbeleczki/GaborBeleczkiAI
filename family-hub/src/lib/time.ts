import { TZDate } from "@date-fns/tz";

export const TZ = "Europe/Budapest";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Local Budapest calendar date + time for an instant. */
export function toLocal(d: Date = new Date()): { date: string; time: string } {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function todayISO(now: Date = new Date()): string {
  return toLocal(now).date;
}

export function isISODate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

export function isHHMM(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday: Monday = 1 … Sunday = 7 */
export function weekdayISO(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function mondayOf(iso: string): string {
  return addDaysISO(iso, 1 - weekdayISO(iso));
}

export function diffDays(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Budapest wall-clock → absolute instant. */
export function localToDate(dateISO: string, time = "00:00"): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, TZ).getTime());
}

export function addMinutesHHMM(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const HU_WEEKDAYS = ["hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat", "vasárnap"];
const HU_WEEKDAYS_SHORT = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const HU_MONTHS = [
  "január",
  "február",
  "március",
  "április",
  "május",
  "június",
  "július",
  "augusztus",
  "szeptember",
  "október",
  "november",
  "december",
];
const HU_MONTHS_SHORT = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];

export function huWeekday(iso: string, short = false): string {
  return (short ? HU_WEEKDAYS_SHORT : HU_WEEKDAYS)[weekdayISO(iso) - 1];
}

/** "nov. 24." / "november 24., kedd" */
export function huDate(iso: string, opts: { long?: boolean; weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = opts.long ? HU_MONTHS[m - 1] : HU_MONTHS_SHORT[m - 1];
  let s = `${opts.year ? `${y}. ` : ""}${month} ${d}.`;
  if (opts.weekday) s += `, ${huWeekday(iso)}`;
  return s;
}

export function huMonth(m: number): string {
  return HU_MONTHS[m - 1];
}

/** "ma", "holnap", "holnapután", "csütörtök", "5 nap múlva", "tegnap", "3 napja" */
export function huRelative(iso: string, today = todayISO()): string {
  const n = diffDays(today, iso);
  if (n === 0) return "ma";
  if (n === 1) return "holnap";
  if (n === 2) return "holnapután";
  if (n === -1) return "tegnap";
  if (n < 0) return `${-n} napja`;
  if (n < 7) return huWeekday(iso);
  return `${n} nap múlva`;
}

export function huGreeting(now: Date = new Date()): string {
  const h = Number(toLocal(now).time.slice(0, 2));
  if (h < 5) return "Jó éjt";
  if (h < 10) return "Jó reggelt";
  if (h < 18) return "Szép napot";
  return "Szép estét";
}

export function formatHuf(amount: number | null | undefined, currency = "HUF"): string {
  if (amount == null) return "—";
  const cur = (currency || "HUF").toUpperCase();
  const num = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: cur === "HUF" ? 0 : 2 }).format(amount);
  return cur === "HUF" ? `${num} Ft` : `${num} ${cur}`;
}
