import type { Digest } from "../ai/schemas";
import type { Item } from "../db/schema";
import type { FamilyConfig } from "../family/types";
import { addDaysISO, formatHuf, huDate, huRelative } from "../time";

/** Rule-based daily briefing used when no LLM is configured. Same shape as the AI digest. */
export function ruleDigest(input: {
  date: string;
  family: FamilyConfig;
  open: Item[];
  media: Item[];
  agendaCount: number;
  reviewCount: number;
  unsubscribe: { name: string; total: number; unread: number }[];
}): Digest {
  const { date, family, open } = input;
  const tomorrow = addDaysISO(date, 1);
  const kidName = (i: Item) => i.kidIds.map((k) => family.kids.find((x) => x.id === k)?.name ?? k).join(", ");
  const label = (i: Item) => `${kidName(i) ? `${kidName(i)}: ` : ""}${i.title}`;
  const exact = open.filter((i) => i.date && i.datePrecision === "exact");
  const today = exact.filter((i) => i.date === date);
  const tmr = exact.filter((i) => i.date === tomorrow);
  const overdue = exact.filter((i) => i.date! < date && !["event", "assessment"].includes(i.type));
  const tests = open.filter((i) => i.type === "assessment" && i.date && i.date >= date && i.date <= addDaysISO(date, 7));
  const pay = open.filter((i) => (i.type === "payment" || i.type === "bill") && (!i.date || i.date <= addDaysISO(date, 7)));
  const payTotal = pay.filter((i) => (i.currency ?? "HUF") === "HUF").reduce((s, i) => s + (i.amount ?? 0), 0);
  const bring = tmr.filter((i) => i.category === "bring");

  const parts = [
    today.length + input.agendaCount ? `Ma ${today.length + input.agendaCount} tétel a napirenden` : "Ma nincs rögzített teendő",
    tests.length ? `${tests.length} számonkérés a következő 7 napban` : null,
    pay.length ? `${formatHuf(payTotal)} fizetendő` : null,
  ].filter(Boolean);
  const headline = `${parts.join(", ")}.`;

  const focus: string[] = [];
  for (const i of [...today, ...tmr].slice(0, 4)) focus.push(`${huRelative(i.date!, date).replace(/^./, (c) => c.toUpperCase())}: ${label(i)}${i.time ? ` (${i.time})` : ""}`);
  for (const t of tests.slice(0, 2)) if (focus.length < 5) focus.push(`${t.subject ?? t.title} (${kidName(t)}) – ${t.datePrecision === "week" ? "a héten" : huRelative(t.date!, date)}`);
  if (!focus.length) focus.push("Nincs sürgős teendő – jó alkalom a heti áttekintésre.");

  const actions: Digest["suggested_actions"] = [];
  for (const i of overdue.slice(0, 3)) actions.push({ title: `Elmaradt: ${label(i)}`, why: `Határidő: ${huDate(i.date!)}.`, kind: i.type === "bill" || i.type === "payment" ? "pay" : "other", urgency: "today", item_id: i.id, email_id: "" });
  for (const t of tests.slice(0, 3))
    actions.push({ title: `Gyakorlás: ${t.subject ?? t.title} (${kidName(t)})`, why: `${t.assessmentKind === "temazaro" ? "Témazáró" : "Számonkérés"} ${t.datePrecision === "week" ? "ezen a héten" : huRelative(t.date!, date)}${t.topics ? ` – ${t.topics.slice(0, 120)}` : ""}.`, kind: "prepare", urgency: t.date! <= addDaysISO(date, 2) ? "today" : "this_week", item_id: t.id, email_id: "" });
  for (const p of pay.slice(0, 3))
    actions.push({ title: `Fizetés: ${p.title}${p.amount ? ` (${formatHuf(p.amount, p.currency ?? "HUF")})` : ""}`, why: p.date ? `Határidő: ${huDate(p.date)}.` : "Nincs határidő megadva – érdemes egyben rendezni.", kind: "pay", urgency: p.date && p.date <= addDaysISO(date, 2) ? "today" : "this_week", item_id: p.id, email_id: "" });
  if (input.reviewCount) actions.push({ title: `${input.reviewCount} tétel átnézése`, why: "A levelekből kinyert, de bizonytalan tételek az Átnézendő oldalon várnak jóváhagyásra.", kind: "decide", urgency: "this_week", item_id: "", email_id: "" });
  for (const u of input.unsubscribe.slice(0, 2)) actions.push({ title: `Leiratkozás: ${u.name}`, why: `30 nap alatt ${u.total} levél, ebből ${u.unread} olvasatlan.`, kind: "unsubscribe", urgency: "later", item_id: "", email_id: "" });

  const week = family.kids
    .map((k) => {
      const mine = open.filter((i) => i.kidIds.includes(k.id) && i.date && i.date >= date && i.date <= addDaysISO(date, 7));
      if (!mine.length) return null;
      const t = mine.filter((i) => i.type === "assessment").length;
      const e = mine.filter((i) => i.type === "event").length;
      return `${k.name}: ${mine.length} tétel${t ? `, ebből ${t} számonkérés` : ""}${e ? `, ${e} esemény` : ""}`;
    })
    .filter(Boolean)
    .join(". ");

  const tips = [
    bring.length ? `Holnapra ${bring.length} bevinnivaló van – este 10 perc táska-ellenőrzés sokat spórol reggel.` : null,
    pay.length >= 3 ? "Több befizetés is nyitott: érdemes egyszerre, egy fix napon (pl. péntek este) rendezni őket." : null,
    tests.length >= 2 ? "Több számonkérés is jön: rövid, napi 20 perces gyakorlás hatékonyabb, mint egy hosszú előző esti." : null,
    "Vasárnap este 15 perc közös heti áttekintés: Iskola oldal heti nézete + Befizetések.",
  ].filter(Boolean) as string[];

  const byScore = (a: Item, b: Item) => (b.confidence ?? 0) - (a.confidence ?? 0);
  return {
    headline,
    focus: focus.slice(0, 5),
    suggested_actions: actions.slice(0, 8),
    reading_pick_ids: input.media.filter((m) => m.type === "reading" && m.status === "open").sort(byScore).slice(0, 4).map((m) => m.id),
    podcast_pick_ids: input.media.filter((m) => m.type === "podcast" && m.status === "open").sort(byScore).slice(0, 3).map((m) => m.id),
    week_ahead: week || "A következő 7 napra nincs gyerekhez rendelt tétel.",
    family_tip: tips[0],
  };
}
