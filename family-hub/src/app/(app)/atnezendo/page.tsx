import { CheckCheck, Inbox, Mail, Quote } from "lucide-react";
import { Card, EmptyState, KidChips, PageHeader, Pill, SectionTitle, TypeChip, AssessmentChip } from "@/components/ui/primitives";
import { ItemMenu, ReviewButtons } from "@/components/items/client";
import { DateLabel, toLite } from "@/components/items/ItemRow";
import { RetryButton } from "./retry";
import { pageContext } from "@/lib/page-context";
import { listItems } from "@/lib/items/repo";
import { recentEmails } from "@/lib/queries";
import { gmailUrl } from "@/lib/google/gmail";
import { formatHuf, huDate, todayISO } from "@/lib/time";
import { cx } from "@/lib/ui";

export const metadata = { title: "Átnézendő" };

const CAT_LABEL: Record<string, string> = {
  school: "Iskola",
  kreta: "Kréta",
  szmk: "SZMK",
  school_money: "Iskolai pénz",
  finance: "Számla",
  newsletter: "Hírlevél",
  promo: "Reklám",
  social: "Közösségi",
  security: "Biztonsági (kihagyva)",
  other: "Egyéb",
  ignore: "Figyelmen kívül",
};

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const sp = await searchParams;
  const ctx = await pageContext();
  const { kids } = ctx;
  const review = await listItems({ needsReview: true, statuses: ["open", "waiting"], order: "recent", limit: 100 });
  const mails = await recentEmails(10, { limit: 150 });
  const shown = sp.cat ? mails.filter((m) => m.category === sp.cat) : mails.filter((m) => m.status !== "skipped");
  const counts = mails.reduce<Record<string, number>>((acc, m) => ((acc[m.category ?? "other"] = (acc[m.category ?? "other"] ?? 0) + 1), acc), {});

  return (
    <div className="rise">
      <PageHeader
        eyebrow="Ellenőrzés"
        title="Átnézendő"
        subtitle="Amit az AI nem tudott teljes bizonyossággal értelmezni (pl. csak a hét ismert, vagy nem egyértelmű, melyik gyerek). Egy kattintással jóváhagyhatod vagy javíthatod."
      />

      <section className="mb-10">
        {review.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {review.map((i) => (
              <Card key={i.id} as="article" className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {i.type === "assessment" ? <AssessmentChip kind={i.assessmentKind} /> : <TypeChip type={i.type} />}
                      <KidChips kids={kids} ids={i.kidIds} />
                      {!i.kidIds.length && i.area === "school" && <Pill tone="amber">melyik gyerek?</Pill>}
                      {!i.date ? <Pill tone="amber">nincs dátum</Pill> : i.datePrecision !== "exact" && <Pill tone="amber">pontatlan dátum</Pill>}
                      {i.confidence != null && <span className="text-[11px] text-muted">biztonság: {Math.round(i.confidence * 100)}%</span>}
                    </div>
                    <h3 className="mt-1.5 font-medium leading-snug">{i.title}</h3>
                    <div className="mt-1 text-xs">
                      <DateLabel item={i} />
                      {i.amount != null && <span className="ml-2 font-semibold">{formatHuf(i.amount, i.currency ?? "HUF")}</span>}
                    </div>
                  </div>
                  <ItemMenu item={toLite(i)} kids={kids} calendarEnabled={ctx.calendarEnabled} />
                </div>
                {i.sourceQuote && (
                  <blockquote className="flex gap-2 rounded-xl bg-surface-2 p-3 text-sm italic text-ink-2">
                    <Quote className="h-4 w-4 shrink-0 text-muted" />
                    {i.sourceQuote}
                  </blockquote>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    {i.sourceContact}
                    {i.sourceEmailId && (
                      <a href={gmailUrl(i.sourceEmailId, ctx.account)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 hover:text-ink">
                        <Mail className="h-3.5 w-3.5" /> levél
                      </a>
                    )}
                  </span>
                  <ReviewButtons id={i.id} />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<CheckCheck className="h-7 w-7" />} title="Nincs átnézendő tétel">
            Minden kinyert teendő egyértelmű volt.
          </EmptyState>
        )}
      </section>

      <Card className="p-5">
        <SectionTitle icon={<Inbox className="h-4 w-4" />}>Feldolgozott levelek (10 nap)</SectionTitle>
        <div className="mb-4 flex flex-wrap gap-2">
          <a href="/atnezendo" className={cx("rounded-full px-3 py-1 text-xs ring-1 ring-inset", !sp.cat ? "bg-ink text-surface ring-ink" : "ring-line text-ink-2")}>
            Releváns
          </a>
          {Object.entries(counts).map(([c, n]) => (
            <a key={c} href={`/atnezendo?cat=${c}`} className={cx("rounded-full px-3 py-1 text-xs ring-1 ring-inset", sp.cat === c ? "bg-ink text-surface ring-ink" : "ring-line text-ink-2")}>
              {CAT_LABEL[c] ?? c} · {n}
            </a>
          ))}
        </div>
        {shown.length ? (
          <ul className="divide-y divide-line">
            {shown.map((m) => (
              <li key={m.id} className="grid gap-1 py-3 sm:grid-cols-[90px_1fr_auto] sm:items-start sm:gap-4">
                <span className="text-xs text-muted">{m.receivedAt ? huDate(todayISO(m.receivedAt)) : ""}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{m.fromName ?? m.fromEmail}</span>
                    <Pill tone={m.status === "error" ? "red" : m.category === "school" || m.category === "kreta" ? "violet" : "stone"}>{CAT_LABEL[m.category ?? "other"] ?? m.category}</Pill>
                    <KidChips kids={kids} ids={m.kidIds} />
                  </div>
                  <p className="truncate text-sm text-ink-2">{m.subject}</p>
                  {m.summary && <p className="text-sm leading-snug text-muted">{m.summary}</p>}
                  {m.error && <p className="text-xs text-red-700 dark:text-red-300">Hiba: {m.error}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {m.itemIds.length > 0 && <span className="text-emerald-700 dark:text-emerald-300">{m.itemIds.length} tétel</span>}
                  {m.status === "error" && <RetryButton id={m.id} />}
                  <a href={gmailUrl(m.id, ctx.account)} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" aria-label="Megnyitás Gmailben">
                    <Mail className="h-4 w-4" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Még nincs feldolgozott levél.</p>
        )}
      </Card>
    </div>
  );
}
