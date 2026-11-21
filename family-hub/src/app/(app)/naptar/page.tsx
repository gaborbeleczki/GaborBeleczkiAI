import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Banner, PageHeader } from "@/components/ui/primitives";
import { pageContext } from "@/lib/page-context";
import { listItems } from "@/lib/items/repo";
import { listEvents, type GEvent } from "@/lib/google/calendar";
import { addDaysISO, huDate, huWeekday, localToDate, mondayOf, todayISO, toLocal } from "@/lib/time";
import { KID_STYLES, cx } from "@/lib/ui";

export const metadata = { title: "Naptár" };

type Entry = { key: string; date: string; time: string | null; end: string | null; title: string; tone: string; fh: boolean; role?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const sp = await searchParams;
  const ctx = await pageContext();
  const { kids, prefs, google } = ctx;
  const today = todayISO();
  const offset = Number(sp.w) || 0;
  const monday = addDaysISO(mondayOf(today), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));

  let events: GEvent[] = [];
  let calError: string | null = null;
  if (google.hasCalendar) {
    try {
      const ids = Array.from(new Set([prefs.calendarId, ...prefs.readCalendarIds]));
      const res = await Promise.all(ids.map((id) => listEvents(id, localToDate(monday, "00:00"), localToDate(addDaysISO(monday, 7), "00:00")).catch(() => [] as GEvent[])));
      const seen = new Set<string>();
      events = res.flat().filter((e) => {
        const k = e.id ?? `${e.summary}${e.start.dateTime}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    } catch (e) {
      calError = (e as Error).message;
    }
  }
  const items = await listItems({ statuses: ["open", "waiting"], from: monday, to: addDaysISO(monday, 6), types: ["task", "event", "reminder", "assessment", "payment", "bill"] });

  const entries: Entry[] = [];
  const syncedIds = new Set<string>();
  for (const e of events) {
    const fh = Boolean(e.extendedProperties?.private?.familyHub);
    if (fh && e.extendedProperties?.private?.itemId) syncedIds.add(e.extendedProperties.private.itemId);
    const start = e.start.dateTime ? toLocal(new Date(e.start.dateTime)) : { date: e.start.date!, time: null };
    const end = e.end.dateTime ? toLocal(new Date(e.end.dateTime)).time : null;
    const itemId = e.extendedProperties?.private?.itemId;
    const item = itemId ? items.find((i) => i.id === itemId) : undefined;
    const kid = item ? kids.find((k) => k.id === item.kidIds[0]) : undefined;
    entries.push({
      key: e.id ?? `${e.summary}-${start.date}-${start.time}`,
      date: start.date,
      time: start.time,
      end,
      title: e.summary ?? "(esemény)",
      tone: fh ? (kid ? cx(KID_STYLES[kid.color].soft, KID_STYLES[kid.color].ring, "ring-1 ring-inset") : "bg-accent-soft/60") : "bg-surface-2 ring-1 ring-line ring-inset",
      fh,
      role: e.extendedProperties?.private?.role,
    });
  }
  // items that are not (yet) on the calendar
  for (const i of items) {
    if (syncedIds.has(i.id) || !i.date || i.datePrecision !== "exact") continue;
    const kid = kids.find((k) => k.id === i.kidIds[0]);
    entries.push({
      key: `item-${i.id}`,
      date: i.date,
      time: i.time,
      end: i.endTime,
      title: kid ? `${kid.name}: ${i.title}` : i.title,
      tone: "border border-dashed border-line bg-surface",
      fh: false,
      role: "unsynced",
    });
  }

  return (
    <div className="rise">
      <PageHeader
        eyebrow="Naptár"
        title={`${huDate(monday, { long: true })} – ${huDate(addDaysISO(monday, 6), { long: true })}`}
        subtitle="A Google Naptár eseményei és a Family Hub által időblokkolt teendők egy nézetben."
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/naptar?w=${offset - 1}`} className="rounded-full p-2 ring-1 ring-line ring-inset hover:bg-surface" aria-label="Előző hét">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <Link href="/naptar" className="rounded-full px-3 py-2 text-sm ring-1 ring-line ring-inset hover:bg-surface">
              Ma
            </Link>
            <Link href={`/naptar?w=${offset + 1}`} className="rounded-full p-2 ring-1 ring-line ring-inset hover:bg-surface" aria-label="Következő hét">
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        }
      />
      {!google.hasCalendar && (
        <Banner tone="warn">
          A Google Naptár nincs összekapcsolva – csak a Family Hub tételei látszanak. <Link href="/beallitasok" className="font-semibold underline">Összekapcsolás</Link>
        </Banner>
      )}
      {calError && <Banner tone="error">{calError}</Banner>}

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const list = entries.filter((e) => e.date === d).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
          return (
            <div key={d} className={cx("card flex min-h-40 flex-col p-3", d === today && "ring-2 ring-accent/50")}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className={cx("text-xs font-semibold uppercase tracking-wider", d === today ? "text-accent" : "text-muted")}>{huWeekday(d, true)}</span>
                <span className="font-display text-xl font-semibold">{Number(d.slice(8))}</span>
              </div>
              <ul className="space-y-1.5">
                {list.map((e) => (
                  <li key={e.key} className={cx("rounded-lg px-2 py-1.5 text-[12px] leading-snug", e.tone)}>
                    <div className="flex items-center gap-1 font-mono text-[10px] text-muted">
                      {e.time ? `${e.time}${e.end ? `–${e.end}` : ""}` : "egész nap"}
                      {e.fh && <Sparkles className="h-3 w-3 text-accent" aria-label="Family Hub" />}
                      {e.role === "unsynced" && <span className="text-[10px]">· nincs naptárban</span>}
                    </div>
                    <div className="text-ink">{e.title}</div>
                  </li>
                ))}
                {!list.length && <li className="pt-4 text-center text-xs text-muted/60">—</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <CalendarDays className="h-3.5 w-3.5" /> <Sparkles className="h-3 w-3 text-accent" /> = a Family Hub hozta létre (pl. gyakorlás témazáró előtt, bepakolás előző este, fizetési idősáv).
      </p>
    </div>
  );
}
