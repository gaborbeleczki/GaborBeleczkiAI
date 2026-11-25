import Link from "next/link";
import { ArrowRight, Flame, Sparkles } from "lucide-react";
import type { Item } from "@/lib/db/schema";
import type { Kid } from "@/lib/family/types";
import { primaryAction, selectFresh, selectTop, urgency } from "@/lib/attention";
import { gmailUrl } from "@/lib/google/gmail";
import { formatHuf, huDate, huRelative } from "@/lib/time";
import { ASSESSMENT_KIND, KID_STYLES, TYPE_META, cx } from "@/lib/ui";
import { DoneCheckbox } from "@/components/items/client";
import { SwipeDeck, type SwipeCard } from "./SwipeDeck";

const DECK_LIMIT = 25;

function whenLabel(i: Item, today: string): string | null {
  if (!i.date) return null;
  if (i.datePrecision !== "exact") return `${huDate(i.date)}–${i.endDate ? huDate(i.endDate) : "?"} között · pontos nap még nem ismert`;
  const time = i.time ? ` · ${i.time}${i.endTime ? `–${i.endTime}` : ""}` : "";
  const range = i.endDate && i.endDate !== i.date ? ` – ${huDate(i.endDate)}` : "";
  const rel = huRelative(i.date, today);
  // huRelative already names the weekday for dates later this week; only add it for "ma"/"holnap"
  const date = huDate(i.date, { weekday: rel === "ma" || rel === "holnap" });
  return `${rel.charAt(0).toUpperCase()}${rel.slice(1)} · ${date}${range}${time}`;
}

function toCard(i: Item, today: string, account: string | null, calendarEnabled: boolean): SwipeCard {
  const kind = i.type === "assessment" ? ASSESSMENT_KIND[i.assessmentKind ?? "egyeb"] ?? ASSESSMENT_KIND.egyeb : null;
  const tm = TYPE_META[i.type] ?? TYPE_META.task;
  const u = urgency(i, today);
  return {
    id: i.id,
    type: i.type,
    typeLabel: kind ? kind.label : tm.label,
    typeChip: kind ? kind.chip : tm.chip,
    title: i.subject && i.type === "assessment" && !i.title.toLowerCase().includes(i.subject.toLowerCase()) ? `${i.subject} – ${i.title}` : i.title,
    details: i.details,
    topics: i.type === "assessment" ? i.topics : null,
    kidIds: i.kidIds,
    subject: i.subject,
    when: whenLabel(i, today),
    reason: u.reason,
    urgent: u.score >= 70,
    amount: i.amount != null ? formatHuf(i.amount, i.currency ?? "HUF") : null,
    payee: i.payee,
    quote: i.sourceQuote,
    contact: i.sourceContact,
    mailUrl: i.sourceEmailId ? gmailUrl(i.sourceEmailId, account) : null,
    needsReview: i.needsReview,
    primary: primaryAction(i.type, calendarEnabled),
  };
}

export function MorningHero({
  items,
  kids,
  today,
  account,
  calendarEnabled,
  headline,
}: {
  items: Item[];
  kids: Kid[];
  today: string;
  account: string | null;
  calendarEnabled: boolean;
  headline: string | null;
}) {
  const fresh = selectFresh(items, today);
  const top = selectTop(items, today, 5);
  const cards = fresh.slice(0, DECK_LIMIT).map((i) => toCard(i, today, account, calendarEnabled));
  const deckKids = kids.map((k) => ({ id: k.id, name: k.name, color: k.color }));

  return (
    <section className="relative mb-8 overflow-hidden rounded-[28px] bg-[#0b0a12] text-white shadow-2xl ring-1 ring-white/5 sm:rounded-[36px]">
      {/* light & atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="aurora absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full bg-violet-600/40 blur-[110px]" />
        <div className="aurora-slow absolute -right-20 top-10 h-[380px] w-[380px] rounded-full bg-rose-500/30 blur-[120px]" />
        <div className="aurora absolute -bottom-40 left-1/3 h-[360px] w-[520px] rounded-full bg-amber-400/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>

      {/* phones: headline → deck → top list; desktop: headline + top list left, deck right */}
      <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-10 lg:gap-y-8 lg:p-10">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Reggeli szkennelés
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl">
            {fresh.length ? (
              <>
                <span className="bg-gradient-to-r from-amber-200 via-rose-200 to-violet-200 bg-clip-text text-transparent">{fresh.length}</span> új dolog vár a döntésedre
              </>
            ) : (
              "Minden friss tételről döntöttél"
            )}
          </h2>
          {headline && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">{headline}</p>}
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <SwipeDeck cards={cards} kids={deckKids} total={cards.length} />
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              <Flame className="h-3.5 w-3.5 text-rose-300" /> Ma a legfontosabb
            </p>
            {top.length ? (
              <ol className="space-y-2">
                {top.map(({ item, reason }, n) => {
                  const kidList = item.kidIds.map((id) => kids.find((k) => k.id === id)).filter(Boolean) as Kid[];
                  return (
                    <li
                      key={item.id}
                      className="group flex items-center gap-4 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-white/[0.08]"
                    >
                      <span className="w-6 shrink-0 font-display text-3xl font-semibold leading-none text-white/25 tabular-nums">{n + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{item.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/55">
                          <span
                            className={cx(
                              "rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wider",
                              reason === "lejárt" || reason === "ma" ? "bg-rose-500/90 text-white" : "bg-white/10 text-white/80",
                            )}
                          >
                            {reason}
                          </span>
                          {kidList.map((k) => (
                            <span key={k.id} className="inline-flex items-center gap-1">
                              <span className={cx("h-1.5 w-1.5 rounded-full", KID_STYLES[k.color].dot)} />
                              {k.name}
                            </span>
                          ))}
                          {item.time && <span>{item.time}</span>}
                          {item.amount != null && <span className="font-semibold text-white/80">{formatHuf(item.amount, item.currency ?? "HUF")}</span>}
                        </p>
                      </div>
                      {item.type !== "event" && item.type !== "assessment" && (
                        <div className="shrink-0 rounded-full bg-white/90 p-0.5">
                          <DoneCheckbox id={item.id} done={false} label={item.title} tone={item.type === "payment" || item.type === "bill" ? "money" : "default"} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/60 ring-1 ring-white/10">Ma nincs sürgős tennivaló – élvezzétek a napot.</p>
            )}
            <Link href="/teendok" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-white/60 hover:text-white">
              Összes teendő <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
