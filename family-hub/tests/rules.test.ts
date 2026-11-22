import { describe, expect, it } from "vitest";
import { ruleExtract, ruleQuickAdd, summarize } from "@/lib/rules/extract";
import { ruleDigest } from "@/lib/rules/digest";
import { classifyEmail } from "@/lib/sync/classify";
import type { Item } from "@/lib/db/schema";
import { email, family } from "./fixtures";

const teacher = { name: "Kovács Éva", email: "kovacs.eva@gmail.com" };
const groupB = [{ name: null, email: "harmadik-a@googlegroups.com" }];
const run = (p: Parameters<typeof email>[0]) => {
  const e = email(p);
  return ruleExtract(e, classifyEmail(e, family), family);
};

describe("rule-based extraction", () => {
  it("turns a weekly plan into tests, things to bring and events", () => {
    const r = run({
      from: teacher,
      to: groupB,
      subject: "Jövő hét",
      date: new Date("2026-11-21T08:00:00Z"),
      text: "Kedves Szülők!\n\nHétfő\nOlvasás felmérés\n\nKedd\nA füzet legyen a mappában.\n\nCsütörtök\nMatek dolgozat - csatolok gyakorlást\n\nCsütörtökön karácsonyi készülődés. 14.00-tól várjuk a szülőket.\nHosszabbítót is hozzanak.\n\nSzép hétvégét!",
    });
    const t = r.items.map((i) => `${i.type}|${i.category}|${i.date}|${i.time}|${i.title}`);
    expect(t).toContain("assessment|none|2026-11-23||Olvasás felmérés");
    expect(t).toContain("task|bring|2026-11-24||A füzet legyen a mappában");
    expect(t).toContain("assessment|none|2026-11-26||Matematika dolgozat");
    expect(t.some((x) => x.startsWith("event|none|2026-11-26|14:00|"))).toBe(true);
    expect(t).toContain("task|bring|2026-11-26||Hosszabbítót is hozzanak");
    expect(r.items.every((i) => i.kid_ids.includes("bence"))).toBe(true);
    // heuristic school items always go to review
    expect(r.items.every((i) => i.confidence < 0.7)).toBe(true);
  });

  it("joins hard-wrapped lines and ignores past results and negations", () => {
    const r = run({
      from: { name: "Nagy Péter", email: "nagy.peter@gmail.com" },
      to: [{ name: null, email: "masodik-b@googlegroups.com" }],
      subject: "angol",
      date: new Date("2026-11-17T19:00:00Z"),
      text:
        "A legutóbbi dolgozatot az osztály nagy részének sikerült jól megírnia, ami\nigazán dicséretes. A szünet előtt nem tervezek dolgozatot.\nA pontos napot még nem tudom, de az biztos, hogy a 2. fejezetből a jövő\nhéten írunk témazárót.\nLesznek benne bemutatkozós mondatok és a színek nevei.",
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ type: "assessment", assessment_kind: "temazaro", subject: "Angol", date_precision: "week", date: "2026-11-23", end_date: "2026-11-27" });
    expect(r.items[0].topics).toContain("bemutatkozós");
  });

  it("reads Kréta notifications", () => {
    const f = run({ from: { name: "KRÉTA", email: "no-reply@e-kreta.hu" }, subject: "Sikeres fogadóóra jelentkezés - 2026. 11. 17. 14:30:00 - Szabó Judit", text: "Címzett: Anya (Minta Lili)" });
    expect(f.items[0]).toMatchObject({ type: "event", date: "2026-11-17", time: "14:30", title: "Fogadóóra – Szabó Judit", kid_ids: ["lili"] });
    const m = run({ from: { name: "KRÉTA", email: "no-reply@e-kreta.hu" }, subject: "KRÉTA e-Ügyintézés: „Futóverseny” témában új üzenete érkezett", text: "Feladó: Tanár Úr\nCímzett: Anya (Minta Bence)" });
    expect(m.items[0]).toMatchObject({ type: "task", category: "read", title: "Kréta-üzenet elolvasása: Futóverseny", kid_ids: ["bence"] });
  });

  it("reads bills, receipts and payment confirmations", () => {
    const bill = run({ from: { name: "Példa Telekom", email: "noreply@telekom.hu" }, subject: "Számlaértesítő", labels: ["CATEGORY_UPDATES"], text: "Beérkezési határidő 2026.11.25. Számlázott összeg 5 939 Ft" });
    expect(bill.items[0]).toMatchObject({ type: "bill", amount: 5939, date: "2026-11-25", payment_status: "unpaid" });
    expect(bill.items[0].confidence).toBeGreaterThanOrEqual(0.7);
    const paid = run({ from: { name: "Telekom", email: "info@telekom.hu" }, subject: "Sikeres számlabefizetés", text: "Köszönjük." });
    expect(paid.paidDomain).toBe("telekom.hu");
    expect(paid.items).toHaveLength(0);
    const menza = run({ from: { name: "Önkormányzat", email: "multischool@ms.example.hu" }, subject: "Befizetés", text: "Minta Lili (2.B) számára\nBefizetési időszak: | 2026.december |\nMegrendelés összege: 7 137,00 Ft" });
    expect(menza.items[0]).toMatchObject({ type: "payment", category: "menza", amount: 7137, title: "Menza – december", kid_ids: ["lili"] });
  });

  it("collects reading and podcast picks from configured newsletters only", () => {
    const pod = run({ from: { name: "Lenny", email: "lenny@substack.com" }, subject: "Burnout in tech | a conversation", hasUnsubscribe: true, text: "Listen now. In this episode we talk about burnout.", links: [{ text: "Listen on Spotify", href: "https://open.spotify.com/episode/x" }] });
    expect(pod.podcast).toMatchObject({ show: "Lenny", url: "https://open.spotify.com/episode/x" });
    const read = run({ from: { name: "Writer", email: "writer@substack.com" }, subject: "How families plan their week", hasUnsubscribe: true, text: "A long essay about planning. ".repeat(80), links: [{ text: "Read the full post here", href: "https://writer.substack.com/p/how-families-plan" }] });
    expect(read.reading).toMatchObject({ title: "How families plan their week", url: "https://writer.substack.com/p/how-families-plan" });
    const other = run({ from: { name: "Shop", email: "news@shop.example" }, subject: "Akció", hasUnsubscribe: true, text: "50% kedvezmény" });
    expect(other.reading).toBeNull();
  });

  it("parses quick-add notes", () => {
    const d = ruleQuickAdd("Lili péntekre vigyen tornacuccot", family, { date: "2026-11-24", time: "09:00" });
    expect(d).toMatchObject({ type: "task", category: "bring", kid_ids: ["lili"], date: "2026-11-27" });
    const e = ruleQuickAdd("jövő kedden 17:00 fogorvos Bencével", family, { date: "2026-11-24", time: "09:00" });
    expect(e).toMatchObject({ type: "event", kid_ids: ["bence"], date: "2026-12-01", time: "17:00" });
    const p = ruleQuickAdd("Úszás befizetése 12 000 Ft december 5-ig", family, { date: "2026-11-24", time: "09:00" });
    expect(p).toMatchObject({ type: "payment", amount: 12000, date: "2026-12-05" });
  });

  it("summarises without greetings", () => {
    expect(summarize("Kedves Szülők!\n\nHolnap kirándulás lesz.\nÜdvözlettel: Éva")).toBe("Holnap kirándulás lesz.");
  });
});

describe("rule-based digest", () => {
  const item = (p: Partial<Item>): Item => ({ id: Math.random().toString(36).slice(2), type: "task", area: "school", title: "x", details: null, kidIds: [], category: null, subject: null, assessmentKind: null, topics: null, date: null, time: null, endDate: null, endTime: null, datePrecision: "exact", status: "open", priority: "normal", needsReview: false, confidence: 0.9, estimateMinutes: null, amount: null, currency: null, payee: null, paymentInfo: null, paidAt: null, url: null, source: "email", sourceEmailId: null, sourceContact: null, sourceQuote: null, meta: {}, calendarEventId: null, calendarPrepIds: [], calendarSyncedAt: null, calendarError: null, createdBy: null, createdAt: new Date(), updatedAt: new Date(), completedAt: null, ...p });
  it("builds headline, focus, actions and picks", () => {
    const d = ruleDigest({
      date: "2026-11-23",
      family,
      open: [
        item({ title: "Tornacucc", category: "bring", kidIds: ["lili"], date: "2026-11-24" }),
        item({ type: "assessment", assessmentKind: "temazaro", subject: "Angol", title: "Angol témazáró", kidIds: ["bence"], date: "2026-11-25" }),
        item({ type: "payment", title: "Osztálypénz", amount: 3000, currency: "HUF", date: "2026-11-26" }),
        item({ title: "Elmaradt aláírás", date: "2026-11-20" }),
      ],
      media: [item({ type: "reading", area: "media", title: "Cikk", confidence: 0.6 }), item({ type: "podcast", area: "media", title: "Adás", confidence: 0.6 })],
      agendaCount: 2,
      reviewCount: 3,
      unsubscribe: [{ name: "Spam Kft", total: 9, unread: 9 }],
    });
    expect(d.headline).toContain("1 számonkérés");
    expect(d.headline).toContain("3000 Ft");
    expect(d.focus.join(" ")).toContain("Lili: Tornacucc");
    const kinds = d.suggested_actions.map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(["prepare", "pay", "decide", "unsubscribe"]));
    expect(d.suggested_actions[0].title).toContain("Elmaradt");
    expect(d.reading_pick_ids).toHaveLength(1);
    expect(d.podcast_pick_ids).toHaveLength(1);
    expect(d.family_tip).toContain("bevinnivaló");
    expect(d.week_ahead).toContain("Bence");
  });
});
