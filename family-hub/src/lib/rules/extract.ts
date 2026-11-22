import type { ItemDraft } from "../ai/schemas";
import type { FamilyConfig } from "../family/types";
import type { ParsedEmail } from "../google/mime";
import type { Classification } from "../sync/classify";
import { toLocal } from "../time";
import { findAmount, findDate, findTime, mentionsNextWeek, weekdayIn, type DateHit } from "./hu-dates";

/**
 * Rule-based extraction (no LLM). Deliberately conservative: heuristic school items get
 * confidence < 0.7 so they land in "Átnézendő" and are only put on the calendar once approved;
 * highly structured mails (Kréta, invoices with amount + due date) get higher confidence.
 */

export type RuleResult = {
  summary: string;
  kidIds: string[];
  items: ItemDraft[];
  /** sender domain whose open bill this mail confirms as paid */
  paidDomain: string | null;
  reading: { title: string; url: string; source: string; why: string; minutes: number } | null;
  podcast: { show: string; episode: string; url: string; why: string; query: string; minutes: number } | null;
};

export function draft(p: Partial<ItemDraft> & Pick<ItemDraft, "type" | "title">): ItemDraft {
  return {
    area: "school",
    details: "",
    kid_ids: [],
    category: "none",
    subject: "",
    assessment_kind: "none",
    topics: "",
    date: "",
    time: "",
    end_date: "",
    end_time: "",
    date_precision: "unknown",
    amount: 0,
    currency: "",
    payee: "",
    payment_account: "",
    payment_reference: "",
    payment_status: "none",
    invoice_number: "",
    url: "",
    priority: "normal",
    estimate_minutes: 0,
    confidence: 0.6,
    source_quote: "",
    existing_item_id: "",
    ...p,
  };
}

function withDate(d: DateHit | null): Partial<ItemDraft> {
  if (!d) return {};
  return { date: d.date, end_date: d.endDate ?? "", time: d.time ?? "", date_precision: d.precision };
}

const GREETING = /^(kedves|tisztelt|sziasztok|szia|hell[óo]|dear|hi\b|j[óo] napot)/i;
const SIGN_OFF = /^(üdv|üdvözlettel|köszönettel|köszönöm|szép (hétvégét|napot|estét)|best|thanks|puszi)/i;

function cleanLines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith(">")) continue;
    if (/^--\s*$/.test(line)) break;
    if (/^(-{5,}|_{5,}).*(forwarded|továbbított|eredeti)/i.test(line)) continue;
    if (/^(feladó|from|date|dátum|subject|tárgy|to|címzett|cc|sent|elküldve)\s*:/i.test(line)) continue;
    out.push(line);
  }
  return out;
}

const HEADER = /^(h[ée]tf[őo]|kedd|szerda|cs[üu]t[öo]rt[öo]k|p[ée]ntek)\s*:?\s*$/i;

/** Re-joins lines that plain-text mailers hard-wrap at ~72 characters. */
function unwrap(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev && line && !HEADER.test(line) && !HEADER.test(prev) && prev.length >= 55 && !/[.!?:]$/.test(prev)) {
      out[out.length - 1] = `${prev} ${line}`;
    } else out.push(line);
  }
  return out;
}

function sentences(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function trimTitle(s: string, max = 90): string {
  const t = s
    .replace(/^(kérem|kérlek(?:\s+titeket)?|kérjük|szeretném kérni|valamint|illetve|és)\s*,?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.!]+$/, "")
    .trim();
  const c = t.charAt(0).toUpperCase() + t.slice(1);
  return c.length > max ? `${c.slice(0, max - 1).trimEnd()}…` : c;
}

export function summarize(text: string, max = 260): string {
  const parts: string[] = [];
  for (const line of cleanLines(text)) {
    if (!line || GREETING.test(line) || SIGN_OFF.test(line)) continue;
    parts.push(line);
    if (parts.join(" ").length > max) break;
  }
  const s = parts.join(" ").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

const SUBJECTS: [RegExp, string][] = [
  [/matek|matematik/i, "Matematika"],
  [/nyelvtan/i, "Nyelvtan"],
  [/sz[öo]veg[ée]rt[ée]s/i, "Szövegértés"],
  [/fogalmaz[áa]s/i, "Fogalmazás"],
  [/olvas[áa]s|olvasm[áa]ny|olvas[óo]k[öo]nyv/i, "Olvasás"],
  [/angol|english|\bunit\b|\btest\b/i, "Angol"],
  [/k[öo]rnyezet/i, "Környezetismeret"],
  [/n[ée]met/i, "Német"],
  [/[ée]nek|zene/i, "Ének-zene"],
  [/rajz/i, "Rajz"],
  [/informatik|digit[áa]lis/i, "Informatika"],
  [/t[öo]rt[ée]nelem/i, "Történelem"],
  [/term[ée]szet/i, "Természettudomány"],
];

function subjectsOf(text: string): string[] {
  return SUBJECTS.filter(([re]) => re.test(text)).map(([, s]) => s);
}

/** Assessment kind, ignoring negated mentions ("nem tervezek dolgozatot"). */
function assessmentKind(s: string): ItemDraft["assessment_kind"] | null {
  for (const [re, kind] of ASSESSMENT) {
    const g = new RegExp(re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = g.exec(s))) {
      if (!/\bnem\b[^,.;]{0,25}$/i.test(s.slice(0, m.index))) return kind;
    }
  }
  if (/\b\d{1,2}\s*sz[óo]\b/i.test(s)) return "teszt";
  return null;
}

const EVENT_LABELS: [RegExp, string][] = [
  [/szül[őo]i [ée]rtekezlet/i, "Szülői értekezlet"],
  [/fogad[óo][óo]r/i, "Fogadóóra"],
  [/mikul[áa]s/i, "Mikulás"],
  [/\S*kar[áa]csony\S*/i, ""],
  [/\S*farsang\S*/i, ""],
  [/\S*kir[áa]ndul[áa]s\S*/i, ""],
  [/\S*fot[óo]z[áa]s\S*/i, ""],
  [/ny[ií]lt nap/i, "Nyílt nap"],
  [/sportnap/i, "Sportnap"],
];

function eventTitle(s: string): string {
  for (const [re, label] of EVENT_LABELS) {
    const m = s.match(re);
    if (m) return label || m[0].replace(/[.,;:!?]+$/, "").replace(/-?(?:[ée]n|ra|re|on|en|ön|ja|je|a|e)$/i, (x) => (x.length > 2 ? "" : x)).replace(/^./, (c) => c.toUpperCase());
  }
  const m = s.match(/((?:\S+\s+){0,2}\S*(k[ée]sz[üu]l[őo]d[ée]s|verseny|bemutat[óo]|el[őo]ad[áa]s|[üu]nneps[ée]g|ki[áa]ll[ií]t[áa]s|koncert|v[áa]s[áa]r(?:on|ra|t|ba)?\b|gy[űu]jt[ée]s)\S*)/i);
  if (m) return trimTitle(m[1].replace(/^(cs[üu]t[öo]rt[öo]k[öo]n|h[ée]tf[őo]n|kedden|szerd[áa]n|p[ée]nteken|ma|holnap)\s+/i, ""), 60);
  return trimTitle(s, 80);
}

function subjectOf(text: string): string {
  for (const [re, s] of SUBJECTS) if (re.test(text)) return s;
  return "";
}

const ASSESSMENT: [RegExp, ItemDraft["assessment_kind"]][] = [
  [/t[ée]maz[áa]r[óo]/i, "temazaro"],
  [/(r[öo]p|sz[óo])?dolgozat/i, "dolgozat"],
  [/beadand[óo]|projektmunk/i, "beadando"],
  [/felm[ée]r[ée]s|felm[ée]r[őo]/i, "felmeres"],
  [/\bteszt\b|\btest\b|\bquiz\b/i, "teszt"],
  [/sz[óo]beli|feleltet/i, "szobeli"],
];
const KIND_LABEL: Record<string, string> = {
  temazaro: "témazáró",
  dolgozat: "dolgozat",
  beadando: "beadandó",
  felmeres: "felmérés",
  teszt: "teszt",
  szobeli: "szóbeli",
};
const PAST = /(siker[üu]lt|meg[ií]rt|meg[ií]rta|eredm[ée]ny|kijav[ií]t|lett\b|j[óo]l siker|[öo]t[öo]s|dics[ée]retes|visszakapj|megn[ée]zhet[őo]k|mapp[áa]ba|kioszt|visszaad)/i;
const BUY = /(v[áa]s[áa]rol|vegy(en|etek|[ée]k)\b|be kell szerezni|be ?csomagol|k[ée]sz[ií]ts(en|etek|[ée]k))/i;
const BRING = /(hozz(on|anak|[áa]k|[áa]tok|[áa]d|a be)|hozz[áa]k be|legyen (bent|a mapp[áa]|n[áa]luk|n[áa]la|a t[áa]sk[áa])|vigy(e|en|enek)\b|bevi(nni|gy[ée]k|gye)|behoz|beküld|felszerel[ée]s(ük|e)? legyen)/i;
const EVENT = /(szül[őo]i [ée]rtekezlet|fogad[óo][óo]r|k[ée]sz[üu]l[őo]d[ée]s|kir[áa]ndul[áa]s|[üu]nneps[ée]g|[üu]nnep[ée]ly|bemutat[óo]|el[őo]ad[áa]s|kar[áa]csony|mikul[áa]s|fot[óo]z[áa]s|verseny|farsang|ki[áa]ll[ií]t[áa]s|sz[ií]nh[áa]z|koncert|ny[ií]lt nap|sportnap|kulturális|\bv[áa]s[áa]r(?:on|ra|t|ba)?\b|gy[űu]jt[ée]s|szavalóverseny)/i;
const PAYMENT_WORD = /(fizet|utal|befizet|hozz[áa]j[áa]rul|oszt[áa]lyp[ée]nz|d[ií]j|k[öo]lts[ée]g|t[ée]r[ií]t[ée]s|p[ée]nz)/i;
const REQUEST = /(k[ée]rem|k[ée]rlek|k[ée]rj[üu]k|t[öo]lts[ée]tek|k[üu]ldj[ée]tek|jelezz[ée]tek|jelentkez|[ií]rj[áa]tok|v[áa]laszolj|al[áa][ií]r)/i;
const TOPIC_FOLLOW = /(benne|t[ée]mak[öo]r|anyag|tanul|gyakorol|fejezet|\bunit\b|mib[őo]l|k[ée]rd[ée]s)/i;

function schoolItems(email: ParsedEmail, cls: Classification, ref: string): ItemDraft[] {
  const items: ItemDraft[] = [];
  const headText = `${email.subject}\n${email.text.slice(0, 600)}`;
  const nextWeekCtx = mentionsNextWeek(headText);
  const contactSubject = cls.forwardedFrom?.subject || cls.contact?.subject || "";
  const kidIds = cls.kidIds;
  const lines = unwrap(cleanLines(email.text));

  let headerDate: DateHit | null = null; // "Hétfő" / "Csütörtök:" lines in weekly plans
  let paraDate: DateHit | null = null;
  let lastAssessment: ItemDraft | null = null;
  let lastEvent: ItemDraft | null = null;

  for (const line of lines) {
    if (!line) {
      paraDate = null;
      lastEvent = null;
      lastAssessment = null;
      continue;
    }
    if (HEADER.test(line)) {
      headerDate = findDate(line, ref, nextWeekCtx);
      paraDate = null;
      lastAssessment = null;
      lastEvent = null;
      continue;
    }
    for (const s of sentences(line)) {
      if (GREETING.test(s) || SIGN_OFF.test(s)) continue;
      const own = findDate(s, ref, nextWeekCtx);
      if (own) paraDate = own;
      const when = own ?? paraDate ?? headerDate;

      // Assessments
      const kind = assessmentKind(s);
      if (kind && !PAST.test(s)) {
        const aDate = own ?? headerDate; // paragraph dates are too unreliable for tests
        const subjects = subjectsOf(s);
        const list = subjects.length ? subjects : [subjectOf(email.subject) || contactSubject];
        const label = KIND_LABEL[kind] ?? "számonkérés";
        for (const subject of list) {
          lastAssessment = draft({
            type: "assessment",
            title: `${subject ? `${subject} ` : ""}${label}`.replace(/^./, (c) => c.toUpperCase()),
            assessment_kind: kind,
            subject,
            details: s.slice(0, 300),
            kid_ids: kidIds,
            ...withDate(aDate),
            priority: kind === "temazaro" ? "high" : "normal",
            confidence: aDate?.precision === "exact" ? 0.65 : 0.5,
            source_quote: s.slice(0, 300),
          });
          items.push(lastAssessment);
        }
        continue;
      }
      if (lastAssessment && lastAssessment.date_precision !== "exact" && weekdayIn(s)) {
        lastAssessment.details = `${lastAssessment.details} Várható nap: ${s}`.slice(0, 400);
        continue;
      }
      if (lastAssessment && TOPIC_FOLLOW.test(s) && !EVENT.test(s) && !BRING.test(s)) {
        lastAssessment.topics = `${lastAssessment.topics ? `${lastAssessment.topics} ` : ""}${s}`.slice(0, 400);
        continue;
      }

      // Money requests
      const amount = findAmount(s);
      if (amount && PAYMENT_WORD.test(s)) {
        items.push(
          draft({
            type: "payment",
            title: trimTitle(s, 80),
            kid_ids: kidIds,
            category: /oszt[áa]lyp[ée]nz/i.test(s) ? "class_fund" : /kir[áa]ndul/i.test(s) ? "trip" : /fot[óo]/i.test(s) ? "photo" : "other",
            amount,
            currency: "HUF",
            payee: cls.contact?.name ?? email.from.name ?? "",
            payment_status: "unpaid",
            ...withDate(own),
            confidence: 0.6,
            source_quote: s.slice(0, 300),
          }),
        );
        continue;
      }

      // Things to bring
      if (BRING.test(s)) {
        items.push(
          draft({
            type: "task",
            category: "bring",
            title: trimTitle(s),
            kid_ids: kidIds,
            ...withDate(when),
            confidence: when ? 0.62 : 0.5,
            source_quote: s.slice(0, 300),
          }),
        );
        continue;
      }

      // Events
      if (EVENT.test(s) && when) {
        lastEvent = draft({
          type: "event",
          title: eventTitle(s),
          kid_ids: kidIds,
          ...withDate(when),
          confidence: when.precision === "exact" ? 0.62 : 0.5,
          source_quote: s.slice(0, 300),
        });
        items.push(lastEvent);
        continue;
      }
      // a time mentioned right after an event ("14.00-tól várjuk a szülőket")
      if (lastEvent && !lastEvent.time) {
        const t = findTime(s);
        if (t) {
          lastEvent.time = t;
          lastEvent.details = s.slice(0, 300);
          continue;
        }
      }

      // Things to buy / prepare for a dated occasion
      if (BUY.test(s) && when) {
        items.push(
          draft({
            type: "task",
            category: "buy",
            title: trimTitle(s),
            kid_ids: kidIds,
            ...withDate(when),
            confidence: 0.55,
            source_quote: s.slice(0, 300),
          }),
        );
        continue;
      }

      // Explicit requests with a deadline ("december 3-ig ... kérem")
      if (REQUEST.test(s) && own && /-?ig\b|határid/i.test(s) && !/\bne\s/i.test(s)) {
        items.push(
          draft({
            type: "task",
            category: "reply",
            title: trimTitle(s),
            kid_ids: kidIds,
            ...withDate(own),
            confidence: 0.55,
            source_quote: s.slice(0, 300),
          }),
        );
      }
    }
  }
  return items.slice(0, 12);
}

function kretaItems(email: ParsedEmail, cls: Classification, ref: string): ItemDraft[] {
  const subj = email.subject;
  const msg = subj.match(/[„"“](.+?)[”"“]/);
  if (/új üzenete érkezett/i.test(subj)) {
    const sender = email.text.match(/Feladó:\s*(.+)/)?.[1]?.trim() ?? "";
    return [
      draft({
        type: "task",
        category: "read",
        title: `Kréta-üzenet elolvasása: ${msg?.[1] ?? subj}`.slice(0, 120),
        details: sender ? `Feladó: ${sender}` : "",
        kid_ids: cls.kidIds,
        date: ref,
        date_precision: "exact",
        confidence: 0.8,
      }),
    ];
  }
  if (/fogad[óo]\s*[óo]r/i.test(subj)) {
    const d = findDate(subj, ref);
    const teacher = subj.split(" - ").pop()?.trim() ?? "";
    if (d) {
      return [
        draft({
          type: "event",
          title: `Fogadóóra${teacher && !/\d/.test(teacher) ? ` – ${teacher}` : ""}`,
          kid_ids: cls.kidIds,
          ...withDate(d),
          end_time: "",
          confidence: 0.9,
          details: subj,
        }),
      ];
    }
  }
  if (/bejelentkez/i.test(subj)) return [];
  return schoolItems(email, cls, ref);
}

function menzaItems(email: ParsedEmail, cls: Classification): ItemDraft[] {
  const amount = findAmount(email.text.match(/Megrendelés összege[^\n]*/i)?.[0] ?? "") ?? findAmount(email.text);
  const period = email.text.match(/Befizetési időszak:\s*\|?\s*([0-9]{4}\.?\s*[a-záéíóöőúüű]+)/i)?.[1]?.replace(/\s+/g, " ") ?? "";
  if (!amount) return schoolItems(email, cls, toLocal(email.date).date);
  return [
    draft({
      type: "payment",
      category: "menza",
      title: `Menza${period ? ` – ${period.replace(/^\d{4}\.?\s*/, "")}` : ""}`,
      kid_ids: cls.kidIds,
      amount,
      currency: "HUF",
      payee: email.from.name ?? "Menza",
      payment_status: "unpaid",
      details: "Bankkártyás fizetéssel véglegesedik – jelöld befizetettnek, ha megtörtént.",
      confidence: 0.75,
    }),
  ];
}

const PAID_RE = /(sikeres (sz[áa]mla)?(be)?fizet[ée]s|fizet[ée]s sikeres|befizet[ée]s[ée]t (megkaptuk|r[öo]gz[ií]tett)|payment (successful|received)|k[öo]sz[öo]nj[üu]k a befizet[ée]s)/i;
const RECEIPT_RE = /(nyugta|receipt|e-sz[áa]ml[áa]r[óo]l|wolt sz[áa]mla|sz[áa]mla pdf mell[ée]kelve|k[áa]rty[áa]s fizet[ée]s)/i;
const DUE_RE = /(fizet[ée]si hat[áa]rid[őo]|be[ée]rkez[ée]si hat[áa]rid[őo]|hat[áa]rid[őo]|esed[ée]kess[ée]g|esed[ée]kes|due date)[^0-9a-z]{0,20}([^\n]{0,40})/i;
const AMOUNT_CTX = /(sz[áa]ml[áa]zott [öo]sszeg|fizetend[őo]|v[ée]g[öo]sszeg|brutt[óo]|[öo]sszesen|[öo]sszeg|amount|total)[^\n]{0,40}/i;

function financeItems(email: ParsedEmail, cls: Classification, ref: string): { items: ItemDraft[]; paidDomain: string | null } {
  const domain = email.from.email.split("@")[1]?.split(".").slice(-2).join(".") ?? null;
  const text = `${email.subject}\n${email.text}`;
  if (PAID_RE.test(text)) return { items: [], paidDomain: domain };

  const amount = findAmount(text.match(AMOUNT_CTX)?.[0] ?? "") ?? findAmount(text);
  const dueMatch = text.match(DUE_RE);
  const due = dueMatch ? findDate(dueMatch[0], ref) : null;
  const invoice = text.match(/(sz[áa]mlasz[áa]m|sz[áa]mla sorsz[áa]ma|sorsz[áa]m|invoice (no|number)|sz[áa]mla)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{4,})/i)?.[3] ?? "";
  const autopay = /csoportos besz[ée]d[ée]s|automatikus (terhel|levon)/i.test(text);
  const receipt = RECEIPT_RE.test(text);
  if (!amount && !due && !/sz[áa]ml|d[ií]jbek[ée]r/i.test(email.subject)) {
    return { items: schoolItems(email, cls, ref).filter((i) => i.type === "payment"), paidDomain: null };
  }
  const status = autopay ? "autopay" : receipt ? "paid" : "unpaid";
  return {
    items: [
      draft({
        type: "bill",
        area: "finance",
        title: (email.from.name && !email.subject.toLowerCase().includes(email.from.name.toLowerCase())
          ? `${email.from.name} – ${email.subject}`
          : email.subject
        ).replace(/\s+/g, " ").slice(0, 110),
        amount: amount ?? 0,
        currency: amount ? "HUF" : "",
        payee: email.from.name ?? domain ?? "",
        invoice_number: invoice,
        payment_status: status,
        ...withDate(due && due.precision === "exact" ? due : null),
        kid_ids: cls.kidIds,
        confidence: amount && (due || status !== "unpaid") ? 0.85 : 0.6,
      }),
    ],
    paidDomain: null,
  };
}

const PODCAST_RE = /(podcast|\bepisode\b|epiz[óo]d|listen now|hallgasd|\bep\.\s*\d)/i;

function mediaFromNewsletter(email: ParsedEmail, family: FamilyConfig): Pick<RuleResult, "reading" | "podcast"> {
  const fromKnown = family.sources.newsletters.some((p) => p && email.from.email.toLowerCase().includes(p));
  if (!fromKnown) return { reading: null, podcast: null };
  const show = email.from.name ?? email.from.email;
  const bestLink =
    email.links.find((l) => /substack\.com\/p\/|\/p\/[a-z0-9-]+/i.test(l.href)) ??
    email.links.find((l) => /(spotify|apple\.co|podcasts\.apple|youtube|youtu\.be)/i.test(l.href)) ??
    email.links.find((l) => l.text.length > 15) ??
    email.links[0];
  const why = summarize(email.text, 200) || email.snippet;
  const words = email.text.split(/\s+/).length;
  const minutes = Math.max(2, Math.round(words / 220));
  if (PODCAST_RE.test(`${email.subject}\n${email.text.slice(0, 2000)}`)) {
    return {
      reading: null,
      podcast: { show, episode: email.subject, url: bestLink?.href ?? "", why, query: `${show} ${email.subject}`.slice(0, 120), minutes: 0 },
    };
  }
  return { podcast: null, reading: { title: email.subject, url: bestLink?.href ?? "", source: show, why, minutes } };
}

export function ruleExtract(email: ParsedEmail, cls: Classification, family: FamilyConfig): RuleResult {
  const ref = toLocal(email.date).date;
  const base: RuleResult = { summary: summarize(email.text) || email.snippet, kidIds: cls.kidIds, items: [], paidDomain: null, reading: null, podcast: null };
  switch (cls.category) {
    case "kreta":
      return { ...base, items: kretaItems(email, cls, ref) };
    case "school_money":
      return { ...base, items: menzaItems(email, cls) };
    case "school":
    case "szmk":
      return { ...base, items: schoolItems(email, cls, ref) };
    case "finance": {
      const f = financeItems(email, cls, ref);
      return { ...base, items: f.items, paidDomain: f.paidDomain };
    }
    case "newsletter":
      return { ...base, ...mediaFromNewsletter(email, family) };
    default:
      return base;
  }
}

/** Natural-language quick add without an LLM: date, time, kid names, amount, type keywords. */
export function ruleQuickAdd(text: string, family: FamilyConfig, now = toLocal()): ItemDraft {
  const d = findDate(text, now.date);
  const kids = family.kids.filter((k) => new RegExp(`(^|[^a-záéíóöőúüű])${k.name.slice(0, Math.max(3, k.name.length - 1))}`, "i").test(text)).map((k) => k.id);
  const amount = findAmount(text);
  const kind = ASSESSMENT.find(([re]) => re.test(text));
  const type: ItemDraft["type"] = kind ? "assessment" : amount ? "payment" : /eml[ée]keztess|ne felejts/i.test(text) ? "reminder" : d?.time ? "event" : "task";
  return draft({
    type,
    area: kids.length ? "school" : "home",
    title: trimTitle(text, 120),
    kid_ids: kids,
    category: BRING.test(text) || /vigyen|vigye|hozzon/i.test(text) ? "bring" : "none",
    assessment_kind: kind?.[1] ?? "none",
    subject: kind ? subjectOf(text) : "",
    amount: amount ?? 0,
    currency: amount ? "HUF" : "",
    ...withDate(d),
    confidence: 0.95,
  });
}
