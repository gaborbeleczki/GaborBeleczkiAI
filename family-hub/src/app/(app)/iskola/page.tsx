import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, GraduationCap, Mail, MessageSquareQuote, Paperclip } from "lucide-react";
import { AssessmentChip, Card, EmptyState, KidChip, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ItemRow } from "@/components/items/ItemRow";
import { NewItemButton, SyncButton } from "@/components/items/client";
import { pageContext } from "@/lib/page-context";
import { listItems } from "@/lib/items/repo";
import { recentEmails } from "@/lib/queries";
import { gmailUrl } from "@/lib/google/gmail";
import { addDaysISO, huDate, huWeekday, mondayOf, todayISO, weekdayISO } from "@/lib/time";
import { KID_STYLES, cx } from "@/lib/ui";
import type { Item } from "@/lib/db/schema";

export const metadata = { title: "Iskola" };

const DAYS = [0, 1, 2, 3, 4];

function cellTone(i: Item) {
  if (i.type === "assessment") return "bg-violet-600 text-white";
  if (i.type === "event") return "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100";
  if (i.type === "payment") return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100";
  if (i.category === "bring") return "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100";
  return "bg-surface-2 text-ink ring-1 ring-line ring-inset";
}

function cellIcon(i: Item) {
  if (i.type === "assessment") return "📝";
  if (i.type === "event") return "📅";
  if (i.type === "payment") return "💸";
  if (i.category === "bring") return "🎒";
  if (i.category === "practice") return "📚";
  return "•";
}

export default async function SchoolPage({ searchParams }: { searchParams: Promise<{ kid?: string; w?: string }> }) {
  const sp = await searchParams;
  const ctx = await pageContext();
  const { kids } = ctx;
  const today = todayISO();
  const defaultOffset = weekdayISO(today) >= 6 ? 1 : 0;
  const offset = sp.w !== undefined ? Number(sp.w) || 0 : defaultOffset;
  const monday = addDaysISO(mondayOf(today), offset * 7);
  const friday = addDaysISO(monday, 4);
  const activeKids = sp.kid ? kids.filter((k) => k.id === sp.kid) : kids;

  const weekItems = await listItems({
    statuses: ["open", "waiting", "done"],
    from: monday,
    to: addDaysISO(monday, 6),
    types: ["task", "event", "assessment", "reminder", "payment"],
  });
  const schoolWeek = weekItems.filter((i) => i.area === "school" || i.kidIds.length);
  const upcoming = (await listItems({ statuses: ["open", "waiting"], from: today, to: addDaysISO(today, 30), includeUndated: true, areas: ["school"] })).filter(
    (i) => !sp.kid || i.kidIds.includes(sp.kid),
  );

  const mails = await recentEmails(45, { categories: ["school", "kreta", "szmk", "school_money"], limit: 80 });

  const q = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { kid: sp.kid, w: String(offset), ...patch };
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    return `/iskola?${p}`;
  };

  return (
    <div className="rise">
      <PageHeader
        eyebrow="Iskola"
        title="Mi vár ránk a suliban?"
        subtitle="A tanítók leveleiből, a Krétából és az SZMK-tól kinyert teendők, gyerekenként és naponként."
        actions={
          <>
            <SyncButton />
            <NewItemButton kids={kids} defaults={{ area: "school", type: "task" }} />
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={q({ kid: undefined })} className={cx("rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset", !sp.kid ? "bg-ink text-surface ring-ink" : "ring-line text-ink-2 hover:bg-surface")}>
          Mindenki
        </Link>
        {kids.map((k) => (
          <Link
            key={k.id}
            href={q({ kid: k.id })}
            className={cx("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset", sp.kid === k.id ? "bg-ink text-surface ring-ink" : "ring-line text-ink-2 hover:bg-surface")}
          >
            <span className={cx("h-2.5 w-2.5 rounded-full", KID_STYLES[k.color].dot)} />
            {k.name}
            {k.className && <span className="text-xs opacity-70">{k.className}</span>}
          </Link>
        ))}
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Heti terv</p>
            <p className="font-display text-lg font-semibold">
              {huDate(monday, { long: true })} – {huDate(friday, { long: true })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link href={q({ w: offset - 1 })} className="rounded-full p-2 hover:bg-surface-2" aria-label="Előző hét">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <Link href={q({ w: 0 })} className="rounded-full px-3 py-1 text-xs font-medium ring-1 ring-line ring-inset hover:bg-surface-2">
              Ez a hét
            </Link>
            <Link href={q({ w: offset + 1 })} className="rounded-full p-2 hover:bg-surface-2" aria-label="Következő hét">
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
        <div className="soft-scroll overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[140px_repeat(5,1fr)] border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <div className="px-4 py-2">Gyerek</div>
              {DAYS.map((d) => {
                const date = addDaysISO(monday, d);
                return (
                  <div key={d} className={cx("px-3 py-2", date === today && "text-accent")}>
                    {huWeekday(date)} <span className="font-normal normal-case">{huDate(date)}</span>
                  </div>
                );
              })}
            </div>
            {activeKids.map((k) => {
              const mine = schoolWeek.filter((i) => i.kidIds.includes(k.id) || (!i.kidIds.length && i.area === "school"));
              const fuzzy = mine.filter((i) => i.datePrecision !== "exact");
              return (
                <div key={k.id} className="border-b border-line last:border-b-0">
                  <div className="grid grid-cols-[140px_repeat(5,1fr)]">
                    <div className={cx("flex flex-col justify-center gap-1 border-r border-line px-4 py-3", KID_STYLES[k.color].soft)}>
                      <KidChip kid={k} size="md" />
                      {k.className && <span className="text-xs text-muted">{k.className}</span>}
                    </div>
                    {DAYS.map((d) => {
                      const date = addDaysISO(monday, d);
                      const cell = mine.filter((i) => i.date === date && i.datePrecision === "exact");
                      return (
                        <div key={d} className={cx("min-h-24 space-y-1.5 border-r border-line p-2 last:border-r-0", date === today && "bg-accent-soft/40", date < today && "opacity-60")}>
                          {cell.map((i) => (
                            <a
                              key={i.id}
                              href={`#item-${i.id}`}
                              className={cx("block rounded-lg px-2 py-1.5 text-[12px] leading-snug", cellTone(i), i.status === "done" && "line-through opacity-60")}
                              title={i.details ?? i.title}
                            >
                              <span className="mr-1">{cellIcon(i)}</span>
                              {i.time && <span className="mr-1 font-mono opacity-80">{i.time}</span>}
                              {i.type === "assessment" ? `${i.subject ?? ""} ${i.assessmentKind === "temazaro" ? "témazáró" : i.assessmentKind ?? ""}`.trim() : i.title}
                            </a>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {fuzzy.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line bg-surface-2/60 px-4 py-2 text-xs">
                      <span className="font-semibold text-muted">Valamikor a héten:</span>
                      {fuzzy.map((i) => (
                        <span key={i.id} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-violet-300 px-2 py-0.5 text-violet-800 dark:text-violet-200">
                          {i.type === "assessment" && <AssessmentChip kind={i.assessmentKind} />}
                          {i.subject ?? i.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!activeKids.length && (
              <div className="p-6">
                <EmptyState icon={<GraduationCap className="h-6 w-6" />} title="Állítsd be a gyerekeket">
                  A Beállítások → Család részben add meg a gyerekeket, osztályokat és a tanárok e-mail címeit.
                </EmptyState>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-line px-5 py-2.5 text-[11px] text-muted">
          <span>📝 számonkérés</span>
          <span>📅 esemény</span>
          <span>🎒 bevinni</span>
          <span>💸 befizetés</span>
          <span>📚 gyakorolni</span>
        </div>
      </Card>

      <div className={cx("grid gap-6", activeKids.length > 1 ? "lg:grid-cols-2" : "")}>
        {activeKids.map((k) => {
          const kidUpcoming = upcoming.filter((i) => i.kidIds.includes(k.id));
          const kidMails = mails.filter((m) => m.kidIds.includes(k.id)).slice(0, 8);
          const materials = mails.filter((m) => m.kidIds.includes(k.id) && m.attachments.length).flatMap((m) => m.attachments.map((a) => ({ ...a, mail: m }))).slice(0, 10);
          return (
            <div key={k.id} className="space-y-6">
              <Card className="overflow-hidden">
                <div className={cx("h-1.5", KID_STYLES[k.color].band)} />
                <div className="p-5">
                  <SectionTitle icon={<span className={cx("h-2.5 w-2.5 rounded-full", KID_STYLES[k.color].dot)} />}>
                    {k.name} · következő 30 nap
                  </SectionTitle>
                  {kidUpcoming.length ? (
                    <ul className="-mx-3">
                      {kidUpcoming.map((i) => (
                        <ItemRow key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} showKids={false} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">Nincs nyitott iskolai teendő.</p>
                  )}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle icon={<MessageSquareQuote className="h-4 w-4" />}>Üzenetek a suliból</SectionTitle>
                {kidMails.length ? (
                  <ul className="space-y-4">
                    {kidMails.map((m) => (
                      <li key={m.id} className="group">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{m.fromName ?? m.fromEmail}</p>
                          <span className="shrink-0 text-xs text-muted">{m.receivedAt ? huDate(todayISO(m.receivedAt)) : ""}</span>
                        </div>
                        <p className="text-xs font-medium text-ink-2">{m.subject}</p>
                        {m.summary && <p className="mt-1 text-sm leading-snug text-muted">{m.summary}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                          <a href={gmailUrl(m.id, ctx.account)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink">
                            <Mail className="h-3.5 w-3.5" /> Levél
                          </a>
                          {m.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-muted">
                              <Paperclip className="h-3.5 w-3.5" /> {m.attachments.length} melléklet
                            </span>
                          )}
                          {m.itemIds.length > 0 && <span className="text-emerald-700 dark:text-emerald-300">{m.itemIds.length} tétel létrehozva</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Még nincs feldolgozott levél.</p>
                )}
              </Card>

              {materials.length > 0 && (
                <Card className="p-5">
                  <SectionTitle icon={<FileText className="h-4 w-4" />}>Anyagok, mellékletek</SectionTitle>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {materials.map((a, idx) => (
                      <li key={idx}>
                        <a
                          href={gmailUrl(a.mail.id, ctx.account)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm ring-1 ring-line ring-inset hover:ring-ink-2/30"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-muted" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{a.filename}</span>
                            <span className="block truncate text-xs text-muted">{a.mail.fromName ?? a.mail.fromEmail}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          );
        })}
      </div>

      {upcoming.some((i) => !i.kidIds.length) && (
        <Card className="mt-6 p-5">
          <SectionTitle>Közös / gyerekhez nem rendelt</SectionTitle>
          <ul className="-mx-3">
            {upcoming
              .filter((i) => !i.kidIds.length)
              .map((i) => (
                <ItemRow key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} />
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
