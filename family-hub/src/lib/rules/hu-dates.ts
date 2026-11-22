import { addDaysISO, diffDays, isISODate, mondayOf, weekdayISO } from "../time";

/**
 * Rule-based Hungarian date/time understanding for teacher and billing emails, used when no
 * LLM is configured. All results are local (Europe/Budapest) calendar strings.
 */

export type DateHit = { date: string; endDate: string | null; precision: "exact" | "week"; time: string | null };

const MONTHS: [RegExp, number][] = [
  [/^jan/, 1],
  [/^feb/, 2],
  [/^m[áa]rc/, 3],
  [/^[áa]pr/, 4],
  [/^m[áa]j/, 5],
  [/^j[úu]n/, 6],
  [/^j[úu]l/, 7],
  [/^aug/, 8],
  [/^szep/, 9],
  [/^okt/, 10],
  [/^nov/, 11],
  [/^dec/, 12],
];

const WEEKDAYS: [RegExp, number][] = [
  [/h[ée]tf[őo]/i, 1],
  [/(^|[^a-záéíóöőúüű])kedd/i, 2],
  [/szerd[aá]/i, 3],
  [/cs[üu]t[öo]rt[öo]k/i, 4],
  [/p[ée]ntek/i, 5],
  [/szombat/i, 6],
  [/vas[áa]rnap/i, 7],
];

const MONTH_WORD =
  /(janu[áa]r|jan\.?|febru[áa]r|febr?\.?|m[áa]rcius|m[áa]rc\.?|[áa]prilis|[áa]pr\.?|m[áa]jus|m[áa]j\.?|j[úu]nius|j[úu]n\.?|j[úu]lius|j[úu]l\.?|augusztus|aug\.?|szeptember|szept?\.?|okt[óo]ber|okt\.?|november|nov\.?|december|dec\.?)\s*(\d{1,2})\s*\.?(?:\s*[-–]\s*(?:ig\s*)?(\d{1,2}))?/i;

function monthOf(word: string): number | null {
  const w = word.toLowerCase();
  for (const [re, m] of MONTHS) if (re.test(w)) return m;
  return null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Picks the year that puts a month/day closest after (or shortly before) the reference date. */
function withYear(month: number, day: number, ref: string): string | null {
  const y = Number(ref.slice(0, 4));
  for (const year of [y, y + 1, y - 1]) {
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    if (!isISODate(iso)) return null;
    const d = diffDays(ref, iso);
    if (d >= -60 && d <= 300) return iso;
  }
  return null;
}

export function weekdayIn(text: string): number | null {
  for (const [re, wd] of WEEKDAYS) if (re.test(text)) return wd;
  return null;
}

export function mentionsNextWeek(text: string): boolean {
  return /j[öo]v[őo]\s*h[ée]t/i.test(text);
}

/** Date of a weekday relative to the reference: on weekends, or with "jövő hét", it means next week. */
export function resolveWeekday(wd: number, ref: string, nextWeek: boolean): string {
  const refWd = weekdayISO(ref);
  const thisMonday = mondayOf(ref);
  if (nextWeek || refWd >= 6 || wd <= refWd) return addDaysISO(thisMonday, 7 + wd - 1);
  return addDaysISO(thisMonday, wd - 1);
}

export function findTime(text: string): string | null {
  let m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) return `${pad(Number(m[1]))}:${m[2]}`;
  m = text.match(/\b([01]?\d|2[0-3])\.([0-5]\d)\s*(?:-?\s*(?:t[óoőö]l|kor|ig)|\s*[óo]r[áa])/i);
  if (m) return `${pad(Number(m[1]))}:${m[2]}`;
  m = text.match(/\b([01]?\d|2[0-3])\s*[óo]r[áa](?:t[óoőö]l|kor|ra)\b/i);
  if (m) return `${pad(Number(m[1]))}:00`;
  return null;
}

/**
 * Finds the first date expression in a sentence.
 * @param ref email send date (YYYY-MM-DD)
 * @param nextWeekContext the surrounding email talks about next week
 */
export function findDate(text: string, ref: string, nextWeekContext = false): DateHit | null {
  const time = findTime(text);

  // 2026. 11. 17. / 2026.11.25 / 2026-11-25
  let m = text.match(/\b(20\d{2})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})\b/);
  if (m) {
    const iso = `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
    if (isISODate(iso)) return { date: iso, endDate: null, precision: "exact", time };
  }

  // november 25., dec. 2-7., december2- 7- ig
  m = text.match(MONTH_WORD);
  if (m) {
    const month = monthOf(m[1]);
    const day = Number(m[2]);
    if (month && day >= 1 && day <= 31) {
      const iso = withYear(month, day, ref);
      if (iso) {
        const endDay = m[3] ? Number(m[3]) : null;
        const end = endDay && endDay > day ? withYear(month, endDay, ref) : null;
        return { date: iso, endDate: end, precision: "exact", time };
      }
    }
  }

  if (/holnaput[áa]n/i.test(text)) return { date: addDaysISO(ref, 2), endDate: null, precision: "exact", time };
  if (/\bholnap/i.test(text)) return { date: addDaysISO(ref, 1), endDate: null, precision: "exact", time };

  const nextWeek = nextWeekContext || mentionsNextWeek(text);
  const wd = weekdayIn(text);
  if (wd) return { date: resolveWeekday(wd, ref, nextWeek), endDate: null, precision: "exact", time };

  if (mentionsNextWeek(text)) {
    const monday = addDaysISO(mondayOf(ref), 7);
    return { date: monday, endDate: addDaysISO(monday, 4), precision: "week", time: null };
  }
  if (/(ezen a h[ée]ten|e h[ée]ten|a h[ée]t (v[ée]g[ée]ig|folyam[áa]n))/i.test(text)) {
    const friday = addDaysISO(mondayOf(ref), 4);
    return { date: ref, endDate: friday > ref ? friday : null, precision: "week", time: null };
  }
  return null;
}

/** "7 137,00 Ft", "5 939 Ft", "12.500 Ft", "3000 forint" → number */
export function findAmount(text: string): number | null {
  const m = text.match(/(\d{1,3}(?:[  .]\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:Ft|HUF|forint)\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[  .]/g, "") + (m[2] ? `.${m[2]}` : ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}
