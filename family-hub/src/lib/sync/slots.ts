import { localToDate, minutesOf } from "../time";

export type Interval = { start: Date; end: Date };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function hhmm(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/**
 * Finds the first free slot of `duration` minutes on `date` inside the local [from, to] window
 * that does not overlap any busy interval. Steps in `step`-minute increments.
 */
export function findSlot(opts: {
  date: string;
  window: [string, string];
  duration: number;
  busy: Interval[];
  step?: number;
  preferLate?: boolean;
}): { start: string; end: string } | null {
  const step = opts.step ?? 15;
  const from = minutesOf(opts.window[0]);
  const to = minutesOf(opts.window[1]);
  const candidates: number[] = [];
  for (let m = from; m + opts.duration <= to; m += step) candidates.push(m);
  if (opts.preferLate) candidates.reverse();
  for (const m of candidates) {
    const s = localToDate(opts.date, hhmm(m)).getTime();
    const e = s + opts.duration * 60_000;
    const clash = opts.busy.some((b) => b.start.getTime() < e && b.end.getTime() > s);
    if (!clash) return { start: hhmm(m), end: hhmm(m + opts.duration) };
  }
  return null;
}
