import Link from "next/link";
import { after } from "next/server";
import { ArrowRight, Backpack, CalendarClock, CalendarDays, Inbox, NotebookPen, PiggyBank, Sparkles, Sun, TriangleAlert } from "lucide-react";
import { Banner, Card, EmptyState, KidChip, KidChips, PageHeader, SectionTitle, StatTile, AssessmentChip } from "@/components/ui/primitives";
import { ItemRow } from "@/components/items/ItemRow";
import { NewItemButton, QuickAdd, SyncButton } from "@/components/items/client";
import { pageContext } from "@/lib/page-context";
import { listItems } from "@/lib/items/repo";
import { getDigest, isStale, lastSyncInfo, latestDigest, runMailSync } from "@/lib/sync/run";
import { listEvents, type GEvent } from "@/lib/google/calendar";
import { addDaysISO, formatHuf, huDate, huGreeting, huRelative, huWeekday, localToDate, mondayOf, todayISO, toLocal, weekdayISO } from "@/lib/time";
import { KID_STYLES, cx } from "@/lib/ui";
import type { Item } from "@/lib/db/schema";

export const metadata = { title: "Ma" };

type AgendaEntry = { key: string; time: string | null; endTime?: string | null; title: string; sub?: string; kind: "calendar" | "item"; item?: Item };

async function todaysEvents(calendarIds: string[], date: string): Promise<GEvent[]> {
  const res = await Promise.all(
    calendarIds.map((id) => listEvents(id, localToDate(date, "00:00"), localToDate(addDaysISO(date, 1), "00:00")).catch(() => [] as GEvent[])),
  );
  const seen = new Set<string>();
  return res.flat().filter((e) => {
    if (e.extendedProperties?.private?.familyHub) return false; // our own events are shown as items
    const k = `${e.summary}|${e.start.dateTime ?? e.start.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default async function TodayPage() {
  const ctx = await pageContext();
  const { kids, prefs, google, user } = ctx;
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  // on Friday–Sunday the next backpack that matters is Monday's
  const bagDay = weekdayISO(tomorrow) >= 6 ? addDaysISO(mondayOf(today), 7) : tomorrow;

  const [open, sync, digestToday, digestLatest] = await Promise.all([
    listItems({ statuses: ["open", "waiting"], from: addDaysISO(today, -21), to: addDaysISO(today, 14), types: ["task", "event", "reminder", "assessment", "payment", "bill"] }),
    lastSyncInfo(),
    getDigest(today),
    latestDigest(),
  ]);
  const digest = digestToday ?? digestLatest;
  const unpaid = await listItems({ statuses: ["open"], types: ["payment", "bill"] });

  // Opportunistic background sync when the data is older than 30 minutes.
  if (google.hasGmail && isStale(sync?.at, 30)) {
    after(() => runMailSync({ trigger: "visit" }).then(() => undefined));
  }

  let events: GEvent[] = [];
  if (google.hasCalendar) events = await todaysEvents(Array.from(new Set([prefs.calendarId, ...prefs.readCalendarIds])), today).catch(() => []);

  const dueToday = open.filter((i) => i.date === today && i.datePrecision === "exact");
  const overdue = open.filter((i) => i.date && i.date < today && i.datePrecision === "exact" && i.type !== "event" && i.type !== "assessment");
  const bringTomorrow = open.filter(
    (i) => i.type === "task" && i.category === "bring" && i.date && (i.date === bagDay || (i.endDate && i.date <= bagDay && i.endDate >= bagDay)),
  );
  const assessments = open.filter((i) => i.type === "assessment" && i.date && (i.endDate ?? i.date) >= today).slice(0, 5);
  const nextDays = Array.from({ length: 7 }, (_, n) => addDaysISO(today, n + 1)).map((d) => ({
    date: d,
    items: open.filter((i) => i.date === d && i.datePrecision === "exact"),
  }));
  const unpaidTotal = unpaid.filter((i) => (i.currency ?? "HUF") === "HUF").reduce((s, i) => s + (i.amount ?? 0), 0);
  const reviewCount = (await listItems({ needsReview: true, statuses: ["open", "waiting"] })).length;

  const agenda: AgendaEntry[] = [
    ...events.map((e) => ({
      key: `ev-${e.id}`,
      time: e.start.dateTime ? toLocal(new Date(e.start.dateTime)).time : null,
      endTime: e.end.dateTime ? toLocal(new Date(e.end.dateTime)).time : null,
      title: e.summary ?? "(esemény)",
      sub: e.location,
      kind: "calendar" as const,
    })),
    ...dueToday.map((i) => ({ key: i.id, time: i.time, endTime: i.endTime, title: i.title, kind: "item" as const, item: i })),
  ].sort((a, b) => (a.time ?? "00:00").localeCompare(b.time ?? "00:00"));

  const firstName = user.name.split(" ").slice(-1)[0] || user.name;

  return (
    <div className="rise">
      <PageHeader
        eyebrow={`${huWeekday(today)}, ${huDate(today, { long: true })}`}
        title={
          <>
            {huGreeting()}, {firstName}!
          </>
        }
        subtitle={digest?.headline ?? `${dueToday.length} tétel ma, ${assessments.length} közelgő számonkérés.`}
        actions={
          <>
            {google.hasGmail && <SyncButton />}
            <NewItemButton kids={kids} />
          </>
        }
      />

      {!google.connected && (
        <Banner tone="warn">
          A Gmail és a Naptár még nincs összekapcsolva. <Link href="/beallitasok" className="font-semibold underline">Beállítások → Kapcsolatok</Link>
        </Banner>
      )}
      {sync?.error && <Banner tone="error">Legutóbbi szinkron hibája: {sync.error}</Banner>}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Ma" value={dueToday.length + events.length} hint={`${events.length} naptáresemény`} icon={<Sun className="h-4 w-4" />} tone="accent" />
        <StatTile label="Számonkérés" value={assessments.length} hint="a következő 2 hétben" icon={<NotebookPen className="h-4 w-4" />} tone="violet" />
        <StatTile label="Fizetendő" value={formatHuf(unpaidTotal)} hint={`${unpaid.length} tétel`} icon={<PiggyBank className="h-4 w-4" />} tone="emerald" />
        <StatTile
          label="Átnézendő"
          value={reviewCount}
          hint={<Link href="/atnezendo" className="underline-offset-2 hover:underline">AI által bizonytalan tételek</Link>}
          icon={<Inbox className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <SectionTitle icon={<CalendarClock className="h-4 w-4" />} action={<Link href="/naptar" className="text-xs font-medium text-muted hover:text-ink">Heti nézet →</Link>}>
              Mai napirend
            </SectionTitle>
            {agenda.length ? (
              <ol className="relative ml-2 space-y-1 border-l border-line pl-5">
                {agenda.map((a) => (
                  <li key={a.key} className="relative py-1.5">
                    <span className={cx("absolute -left-[27px] top-3 h-3 w-3 rounded-full border-2 border-surface", a.kind === "calendar" ? "bg-sky-400" : "bg-accent")} />
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="w-24 shrink-0 font-mono text-xs text-muted">{a.time ? `${a.time}${a.endTime ? `–${a.endTime}` : ""}` : "egész nap"}</span>
                      <span className="font-medium text-ink">{a.title}</span>
                      {a.item && <KidChips kids={kids} ids={a.item.kidIds} />}
                      {a.sub && <span className="text-xs text-muted">{a.sub}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={<Sun className="h-6 w-6" />} title="Nyugodt nap">
                Nincs mára rögzített esemény vagy határidő.
              </EmptyState>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle icon={<Backpack className="h-4 w-4" />}>
              {bagDay === tomorrow ? "Holnapi táska" : "Hétfői táska"} · {huDate(bagDay, { weekday: true })}
            </SectionTitle>
            {kids.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {kids.map((k) => {
                  const mine = bringTomorrow.filter((i) => i.kidIds.includes(k.id));
                  return (
                    <div key={k.id} className={cx("rounded-2xl p-4 ring-1 ring-inset", KID_STYLES[k.color].soft, KID_STYLES[k.color].ring)}>
                      <div className="mb-2 flex items-center justify-between">
                        <KidChip kid={k} size="md" />
                        <Backpack className={cx("h-5 w-5", KID_STYLES[k.color].text)} />
                      </div>
                      {mine.length ? (
                        <ul className="space-y-1.5 text-sm">
                          {mine.map((i) => (
                            <li key={i.id} className="flex gap-2">
                              <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", KID_STYLES[k.color].dot)} />
                              <span>{i.title}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted">Nincs extra bepakolnivaló.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Még nincsenek gyerekek beállítva">
                <Link href="/beallitasok#csalad" className="underline">Család beállítása</Link>
              </EmptyState>
            )}
          </Card>

          {overdue.length > 0 && (
            <Card className="border-red-200 p-5 dark:border-red-900">
              <SectionTitle icon={<TriangleAlert className="h-4 w-4 text-red-600" />}>Lejárt, még nyitott</SectionTitle>
              <ul className="-mx-3">
                {overdue.map((i) => (
                  <ItemRow key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} />
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <SectionTitle icon={<CalendarDays className="h-4 w-4" />}>Következő 7 nap</SectionTitle>
            <div className="space-y-4">
              {nextDays.map((d) => (
                <div key={d.date} className="grid gap-2 sm:grid-cols-[110px_1fr]">
                  <div className="pt-2.5">
                    <p className="text-sm font-semibold text-ink first-letter:uppercase">{huRelative(d.date, today)}</p>
                    <p className="text-xs text-muted">{huDate(d.date)}</p>
                  </div>
                  {d.items.length ? (
                    <ul className="-mx-3">
                      {d.items.map((i) => (
                        <ItemRow key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} compact />
                      ))}
                    </ul>
                  ) : (
                    <p className="pt-2.5 text-sm text-muted/70">—</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <QuickAdd />

          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-accent-soft to-transparent p-5">
              <SectionTitle icon={<Sparkles className="h-4 w-4 text-accent" />}>Napi összefoglaló</SectionTitle>
              {digest ? (
                <>
                  <p className="font-display text-lg leading-snug text-ink">{digest.headline}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
                    {digest.focus.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {digest.date !== today && <p className="mt-2 text-xs text-muted">({huDate(digest.date)} összefoglalója)</p>}
                </>
              ) : (
                <p className="text-sm text-muted">Az első összefoglaló reggel készül el, vagy generáld most a Napi oldalon.</p>
              )}
              <Link href="/napi" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                Javaslatok, olvasnivaló, podcastok <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={<NotebookPen className="h-4 w-4" />} action={<Link href="/szamonkeresek" className="text-xs font-medium text-muted hover:text-ink">Mind →</Link>}>
              Számonkérések
            </SectionTitle>
            {assessments.length ? (
              <ul className="space-y-2.5">
                {assessments.map((a) => {
                  const kid = kids.find((k) => k.id === a.kidIds[0]);
                  return (
                    <li key={a.id} className="flex items-center gap-3">
                      <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white", kid ? KID_STYLES[kid.color].band : "bg-stone-500")}>
                        <span className="text-[15px] font-bold leading-none">{a.date!.slice(8)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <AssessmentChip kind={a.assessmentKind} />
                          <span className="truncate text-sm font-medium">{a.subject ?? a.title}</span>
                        </div>
                        <p className="text-xs text-muted">
                          {kid?.name} · {a.datePrecision === "week" ? "a héten (nap még nem ismert)" : huRelative(a.date!, today)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nincs közelgő dolgozat vagy témazáró. 🎉</p>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle icon={<PiggyBank className="h-4 w-4" />} action={<Link href="/befizetesek" className="text-xs font-medium text-muted hover:text-ink">Részletek →</Link>}>
              Fizetendő
            </SectionTitle>
            {unpaid.length ? (
              <ul className="space-y-2 text-sm">
                {unpaid.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {p.title}
                      {p.date && <span className="text-xs text-muted"> · {huRelative(p.date, today)}</span>}
                    </span>
                    <span className="shrink-0 font-semibold">{formatHuf(p.amount, p.currency ?? "HUF")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Minden kifizetve.</p>
            )}
          </Card>

          {sync && (
            <p className="px-1 text-xs text-muted">
              Utolsó szinkron: {new Date(sync.at).toLocaleString("hu-HU", { timeZone: "Europe/Budapest", dateStyle: "short", timeStyle: "short" })} · {sync.stats.created} új, {sync.stats.updated} frissített
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
