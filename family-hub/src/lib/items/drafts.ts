import type { ItemDraft } from "../ai/schemas";
import { diffDays, isHHMM, isISODate } from "../time";

export type ItemValues = {
  type: string;
  area: string;
  title: string;
  details: string | null;
  kidIds: string[];
  category: string | null;
  subject: string | null;
  assessmentKind: string | null;
  topics: string | null;
  date: string | null;
  time: string | null;
  endDate: string | null;
  endTime: string | null;
  datePrecision: string;
  status: string;
  priority: string;
  needsReview: boolean;
  confidence: number | null;
  estimateMinutes: number | null;
  amount: number | null;
  currency: string | null;
  payee: string | null;
  paymentInfo: { account?: string | null; reference?: string | null; invoiceNumber?: string | null; method?: string | null } | null;
  paidAt: Date | null;
  url: string | null;
  sourceQuote: string | null;
};

const clean = (s: string | null | undefined, max = 2000) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, max) : null;
};

const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const noneToNull = (v: unknown) => {
  const s = lower(v);
  return s && s !== "none" ? s : null;
};

/** Validates and normalises one AI draft into DB column values ("" / 0 / "none" sentinels become null). */
export function draftToValues(d: ItemDraft, knownKidIds: string[], minConfidence = 0.7): ItemValues {
  const type = ["task", "event", "reminder", "assessment", "payment", "bill"].includes(lower(d.type)) ? lower(d.type) : "task";
  const areaRaw = lower(d.area);
  const date = isISODate(d.date) ? d.date : null;
  const endDate = isISODate(d.end_date) && date && d.end_date >= date ? d.end_date : null;
  const time = date && isHHMM(d.time) ? d.time : null;
  const endTime = time && isHHMM(d.end_time) ? d.end_time : null;
  let precision = date ? lower(d.date_precision) || "exact" : "unknown";
  if (!["exact", "week", "month", "unknown"].includes(precision)) precision = "exact";
  if (precision === "unknown" && date) precision = "exact";
  const confidence = Number.isFinite(d.confidence) ? Math.max(0, Math.min(1, d.confidence)) : null;
  const kidIds = Array.from(new Set(d.kid_ids.filter((k) => knownKidIds.includes(k))));
  const payStatus = noneToNull(d.payment_status);
  const paid = payStatus === "paid" || payStatus === "autopay";
  const area = type === "bill" ? "finance" : ["school", "home", "finance", "personal"].includes(areaRaw) ? areaRaw : kidIds.length ? "school" : "home";
  const needsDate = ["event", "assessment"].includes(type);
  const needsReview = (confidence ?? 0) < minConfidence || (needsDate && (!date || precision !== "exact")) || (area === "school" && kidIds.length === 0);
  const amount = typeof d.amount === "number" && Number.isFinite(d.amount) && d.amount > 0 ? d.amount : null;
  const account = clean(d.payment_account, 200);
  const reference = clean(d.payment_reference, 200);
  const invoiceNumber = clean(d.invoice_number, 80);
  const priority = ["low", "normal", "high"].includes(lower(d.priority)) ? lower(d.priority) : "normal";
  return {
    type,
    area,
    title: (clean(d.title, 140) ?? "Teendő").replace(/\s+/g, " "),
    details: clean(d.details),
    kidIds,
    category: noneToNull(d.category),
    subject: clean(d.subject, 60),
    assessmentKind: type === "assessment" ? (noneToNull(d.assessment_kind) ?? "egyeb") : null,
    topics: clean(d.topics),
    date,
    time,
    endDate,
    endTime,
    datePrecision: precision,
    status: paid ? "done" : "open",
    priority,
    needsReview,
    confidence,
    estimateMinutes: typeof d.estimate_minutes === "number" && d.estimate_minutes > 0 ? Math.min(600, d.estimate_minutes) : null,
    amount,
    currency: amount != null ? (clean(d.currency, 8)?.toUpperCase() ?? "HUF").replace(/^FT$/, "HUF") : null,
    payee: clean(d.payee, 120),
    paymentInfo:
      account || reference || invoiceNumber || payStatus === "autopay"
        ? { account, reference, invoiceNumber, method: payStatus === "autopay" ? "csoportos beszedés" : null }
        : null,
    paidAt: paid ? new Date() : null,
    url: d.url && /^https?:\/\//.test(d.url) ? d.url.slice(0, 500) : null,
    sourceQuote: clean(d.source_quote, 400),
  };
}

function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export function titleSimilarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

export type DedupeCandidate = {
  id: string;
  type: string;
  title: string;
  kidIds: string[];
  date: string | null;
  amount: number | null;
  subject: string | null;
  assessmentKind: string | null;
};

/** Heuristic duplicate finder used when the AI did not link an existing item itself. */
export function findDuplicate(v: ItemValues, candidates: DedupeCandidate[]): DedupeCandidate | null {
  let best: { c: DedupeCandidate; score: number } | null = null;
  for (const c of candidates) {
    if (c.type !== v.type) continue;
    const kidsOverlap = !v.kidIds.length || !c.kidIds.length || v.kidIds.some((k) => c.kidIds.includes(k));
    if (!kidsOverlap) continue;
    if (v.date && c.date && Math.abs(diffDays(v.date, c.date)) > 10) continue;
    let score = titleSimilarity(v.title, c.title);
    if (v.type === "assessment" && v.subject && c.subject && v.subject.toLowerCase() === c.subject.toLowerCase() && v.assessmentKind === c.assessmentKind) {
      score += 0.5;
    }
    if ((v.type === "payment" || v.type === "bill") && v.amount != null && c.amount != null && Math.abs(v.amount - c.amount) < 1) score += 0.3;
    if (score >= 0.75 && (!best || score > best.score)) best = { c, score };
  }
  return best?.c ?? null;
}
