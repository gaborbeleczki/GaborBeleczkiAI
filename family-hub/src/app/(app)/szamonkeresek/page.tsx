import Link from "next/link";
import { BookOpenCheck, CalendarCheck2, Mail, NotebookPen } from "lucide-react";
import { AssessmentChip, Card, EmptyState, KidChip, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { DoneCheckbox, ItemMenu, NewItemButton } from "@/components/items/client";
import { toLite } from "@/components/items/ItemRow";
import { SourceQuote } from "@/components/items/SourceQuote";
import { pageContext } from "@/lib/page-context";
import { listItems } from "@/lib/items/repo";
import { gmailUrl } from "@/lib/google/gmail";
import { addDaysISO, diffDays, huDate, huRelative, huWeekday, mondayOf, todayISO } from "@/lib/time";
import { ASSESSMENT_KIND, KID_STYLES, cx } from "@/lib/ui";
import type { Item } from "@/lib/db/schema";
import type { Kid } from "@/lib/family/types";

export const metadata = { title: "Számonkérések" };

function bucket(i: Item, today: string): string {
  const d = i.date!;
  const thisMon = mondayOf(today);
  if (d < addDaysISO(thisMon, 7)) return "Ezen a héten";
  if (d < addDaysISO(thisMon, 14)) return "Jövő héten";
  if (d < addDaysISO(thisMon, 35)) return "A következő hetekben";
  return "Később";
}

function Countdown({ days, kid }: { days: number; kid?: Kid }) {
  const pct = Math.max(0.06, Math.min(1, 1 - days / 14));
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-14 w-14 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-line" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          className={cx(days <= 2 ? "stroke-red-500" : kid ? KID_STYLES[kid.color].stroke : "stroke-violet-500")}
        />
      </svg>
      <div className="text-center leading-none">
        <div className="text-base font-bold">{days}</div>
        <div className="text-[9px] uppercase text-muted">nap</div>
      </div>
    </div>
  );
}

function AssessmentCard({ item, kids, account, calendarEnabled, today }: { item: Item; kids: Kid[]; account: string | null; calendarEnabled: boolean; today: string }) {
  const kid = kids.find((k) => k.id === item.kidIds[0]);
  const days = Math.max(0, diffDays(today, item.date!));
  const fuzzy = item.datePrecision !== "exact";
  const kind = ASSESSMENT_KIND[item.assessmentKind ?? "egyeb"] ?? ASSESSMENT_KIND.egyeb;
  return (
    <article className={cx("card relative flex gap-4 overflow-hidden p-4 pl-5", fuzzy && "border-dashed")}>
      <span className={cx("absolute inset-y-0 left-0 w-1.5", kid ? KID_STYLES[kid.color].band : "bg-stone-400")} />
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-surface-2 py-2 text-center ring-1 ring-line ring-inset">
        <span className="text-[11px] font-semibold uppercase text-muted">{huWeekday(item.date!, true)}</span>
        <span className="font-display text-2xl font-semibold leading-none">{item.date!.slice(8).replace(/^0/, "")}</span>
        <span className="text-[11px] text-muted">{huDate(item.date!).split(" ")[0]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <AssessmentChip kind={item.assessmentKind} />
          {kid && <KidChip kid={kid} />}
          {fuzzy && <span className="rounded-full border border-dashed border-violet-400 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">pontos nap még nem ismert</span>}
        </div>
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug">{item.subject && !item.title.toLowerCase().includes(item.subject.toLowerCase()) ? `${item.subject} – ${item.title}` : item.title}</h3>
        {item.topics && (
          <p className="mt-1 text-sm leading-snug text-ink-2">
            <span className="font-semibold">Miből: </span>
            {item.topics}
          </p>
        )}
        {item.details && !item.topics && <p className="mt-1 line-clamp-2 text-sm text-muted">{item.details}</p>}
        <SourceQuote quote={item.sourceQuote} emailId={item.sourceEmailId} contact={item.sourceContact} account={account} />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>{fuzzy ? `${huDate(item.date!)} – ${item.endDate ? huDate(item.endDate) : "?"}` : huRelative(item.date!, today)}</span>
          {item.sourceContact && <span>{item.sourceContact}</span>}
          {item.calendarPrepIds?.length ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
              <CalendarCheck2 className="h-3.5 w-3.5" /> {item.calendarPrepIds.length} gyakorlás a naptárban
            </span>
          ) : null}
          {item.sourceEmailId && (
            <a href={gmailUrl(item.sourceEmailId, account)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              <Mail className="h-3.5 w-3.5" /> forrás
            </a>
          )}
          <span className="hidden sm:inline">súly: {"●".repeat(kind.weight)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        {!fuzzy ? <Countdown days={days} kid={kid} /> : <div className="h-14" />}
        <div className="flex items-center gap-1">
          <DoneCheckbox id={item.id} done={item.status === "done"} label="Megírva" />
          <ItemMenu item={toLite(item)} kids={kids} calendarEnabled={calendarEnabled} />
        </div>
      </div>
    </article>
  );
}

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<{ kid?: string }> }) {
  const sp = await searchParams;
  const ctx = await pageContext();
  const { kids } = ctx;
  const today = todayISO();
  const all = await listItems({ types: ["assessment"], statuses: ["open", "waiting", "done"], from: addDaysISO(today, -45), to: addDaysISO(today, 120) });
  const filtered = sp.kid ? all.filter((i) => i.kidIds.includes(sp.kid!)) : all;
  const upcoming = filtered.filter((i) => i.status !== "done" && i.date && (i.endDate ?? i.date) >= today);
  const past = filtered.filter((i) => !upcoming.includes(i)).reverse().slice(0, 12);
  const groups = new Map<string, Item[]>();
  for (const i of upcoming) {
    const b = bucket(i, today);
    groups.set(b, [...(groups.get(b) ?? []), i]);
  }

  return (
    <div className="rise">
      <PageHeader
        eyebrow="Dolgozatok · Témazárók · Beadandók"
        title="Számonkérések"
        subtitle="Mikor, kinek, miből. A témazárók előtt a naptárba automatikusan gyakorló idősávok kerülnek."
        actions={<NewItemButton kids={kids} defaults={{ type: "assessment", area: "school", datePrecision: "exact" }} label="Új számonkérés" />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kids.map((k) => {
          const mine = upcoming.filter((i) => i.kidIds.includes(k.id));
          const next = mine[0];
          return (
            <Link
              key={k.id}
              href={sp.kid === k.id ? "/szamonkeresek" : `/szamonkeresek?kid=${k.id}`}
              className={cx("card flex flex-col gap-1 p-4 ring-inset transition-shadow hover:shadow-md", sp.kid === k.id && "ring-2", KID_STYLES[k.color].ring)}
            >
              <div className="flex items-center justify-between">
                <KidChip kid={k} size="md" />
                <span className="font-display text-2xl font-semibold">{mine.length}</span>
              </div>
              <p className="text-xs text-muted">
                {next ? (
                  <>
                    Következő: <span className="font-medium text-ink-2">{next.subject ?? next.title}</span> · {huRelative(next.date!, today)}
                  </>
                ) : (
                  "Nincs közelgő számonkérés"
                )}
              </p>
              <div className="mt-1 flex gap-1">
                {mine.slice(0, 8).map((i) => (
                  <span key={i.id} className={cx("h-1.5 flex-1 rounded-full", i.assessmentKind === "temazaro" ? "bg-violet-600" : KID_STYLES[k.color].bar)} title={i.subject ?? i.title} />
                ))}
              </div>
            </Link>
          );
        })}
      </div>

      {upcoming.length === 0 ? (
        <EmptyState icon={<BookOpenCheck className="h-7 w-7" />} title="Nincs közelgő számonkérés">
          Amint egy tanító vagy a Kréta dolgozatot, témazárót vagy beadandót jelez, itt megjelenik.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {Array.from(groups.entries()).map(([label, list]) => (
            <section key={label}>
              <SectionTitle icon={<NotebookPen className="h-4 w-4" />}>
                {label} <span className="font-normal normal-case tracking-normal text-muted">· {list.length}</span>
              </SectionTitle>
              <div className="grid gap-3 xl:grid-cols-2">
                {list.map((i) => (
                  <AssessmentCard key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} today={today} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <Card className="mt-10 p-5">
          <SectionTitle>Korábbiak</SectionTitle>
          <ul className="divide-y divide-line">
            {past.map((i) => {
              const kid = kids.find((k) => k.id === i.kidIds[0]);
              return (
                <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted">{i.date ? huDate(i.date) : "—"}</span>
                  <AssessmentChip kind={i.assessmentKind} />
                  <span className="flex-1 truncate">{i.subject ?? i.title}</span>
                  {kid && <KidChip kid={kid} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
