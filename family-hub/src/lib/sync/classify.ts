import { normalizeEmail } from "../auth/allowlist";
import type { ParsedEmail } from "../google/mime";
import type { Contact, FamilyConfig } from "../family/types";

export type MailCategory =
  | "school"
  | "kreta"
  | "szmk"
  | "school_money"
  | "finance"
  | "newsletter"
  | "promo"
  | "social"
  | "security"
  | "other"
  | "ignore";

export type Classification = {
  category: MailCategory;
  mode: "extract" | "triage" | "skip";
  kidIds: string[];
  contact: Contact | null;
  forwardedFrom: Contact | null;
  reason: string;
};

const SECURITY_RE =
  /(verification code|login code|security code|one[- ]time|ellenőrző kód|belépési kód|biztonsági kód|egyszer használatos|jelszó|password reset|reset your password|sign[- ]in attempt|új bejelentkezés)/i;
const FINANCE_RE =
  /(számla|szamla|számlá|díjbekérő|dijbekero|befizet|fizetési (határidő|felszólítás|értesítő)|invoice|receipt|nyugta|e-számla|számlaértesítő|payment due|előfizetés megújítás|csoportos beszedés)/i;

function matches(value: string, patterns: string[]): boolean {
  const v = value.toLowerCase();
  return patterns.some((p) => p && (v === p || v.endsWith(`@${p}`) || v.endsWith(`.${p}`) || v.includes(p)));
}

function groupMatches(addresses: string[], listId: string | null, group: string): boolean {
  const g = group.toLowerCase();
  if (addresses.includes(g)) return true;
  if (listId) {
    const asList = g.replace("@", ".");
    if (listId.toLowerCase().includes(asList)) return true;
  }
  return false;
}

/** Finds contacts whose address appears in a forwarded header block ("Feladó: … <x@y>" / "From: … <x@y>"). */
function forwardedContact(text: string, contacts: Contact[]): Contact | null {
  const re = /(?:^|\n)\s*(?:Feladó|From|Von|Küldő)\s*:\s*[^\n]*?<?([\w.+-]+@[\w.-]+\.\w+)>?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const addr = normalizeEmail(m[1]);
    const c = contacts.find((ct) => ct.emails.some((e) => normalizeEmail(e) === addr));
    if (c) return c;
  }
  return null;
}

function kidsMentioned(text: string, family: FamilyConfig): string[] {
  const out: string[] = [];
  for (const k of family.kids) {
    const names = [k.fullName, k.name].filter(Boolean) as string[];
    if (names.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))) out.push(k.id);
  }
  return out;
}

export function classifyEmail(email: ParsedEmail, family: FamilyConfig): Classification {
  const fromAddr = normalizeEmail(email.from.email || "");
  const recipients = [...email.to, ...email.cc].map((a) => a.email.toLowerCase());
  const all = [email.from.email.toLowerCase(), ...recipients];
  const subject = email.subject ?? "";
  const head = `${subject}\n${email.text.slice(0, 4000)}`;

  const base = { contact: null, forwardedFrom: null } as Pick<Classification, "contact" | "forwardedFrom">;

  if (matches(email.from.email, family.sources.ignore)) {
    return { ...base, category: "ignore", mode: "skip", kidIds: [], reason: "ignore-list" };
  }
  if (SECURITY_RE.test(subject)) {
    return { ...base, category: "security", mode: "skip", kidIds: [], reason: "security/OTP mail is never sent to the AI" };
  }

  const groupKids = family.kids
    .filter((k) => k.classGroupEmails.some((g) => groupMatches(all, email.listId, g)))
    .map((k) => k.id);
  const contact = family.contacts.find((c) => c.emails.some((e) => normalizeEmail(e) === fromAddr)) ?? null;
  const fwd = forwardedContact(email.text, family.contacts);
  const mentioned = kidsMentioned(head, family);

  const pickKids = (...lists: string[][]) => {
    for (const l of lists) if (l.length) return Array.from(new Set(l));
    return [];
  };

  if (matches(email.from.email, family.sources.kreta)) {
    return { ...base, contact, forwardedFrom: fwd, category: "kreta", mode: "extract", kidIds: pickKids(mentioned, groupKids), reason: "Kréta sender" };
  }
  if (family.sources.szmk.some((m) => m && head.toLowerCase().includes(m)) || (email.listId ?? "").toLowerCase().includes("szmk")) {
    return { ...base, contact, forwardedFrom: fwd, category: "szmk", mode: "extract", kidIds: pickKids(groupKids, mentioned), reason: "SZMK marker" };
  }
  if (matches(email.from.email, family.sources.menza) || contact?.role === "treasurer") {
    return { ...base, contact, forwardedFrom: fwd, category: "school_money", mode: "extract", kidIds: pickKids(mentioned, groupKids, contact?.kidIds ?? []), reason: "school payments sender" };
  }
  if (groupKids.length || (contact && ["class_teacher", "subject_teacher", "school_admin", "parents_group"].includes(contact.role)) || fwd) {
    return {
      ...base,
      contact,
      forwardedFrom: fwd,
      category: "school",
      mode: "extract",
      kidIds: pickKids(groupKids, contact?.kidIds ?? [], fwd?.kidIds ?? [], mentioned),
      reason: groupKids.length ? "class group" : "known school contact",
    };
  }
  if (contact?.role === "club") {
    return { ...base, contact, category: "school", mode: "extract", kidIds: pickKids(contact.kidIds, mentioned), reason: "club / activity contact" };
  }
  const financeSubject = FINANCE_RE.test(subject);
  if (financeSubject || (matches(email.from.email, family.sources.billers) && !email.labels.includes("CATEGORY_PROMOTIONS"))) {
    return { ...base, contact, category: "finance", mode: "extract", kidIds: mentioned, reason: "billing" };
  }
  if (matches(email.from.email, family.sources.newsletters)) {
    return { ...base, contact, category: "newsletter", mode: "triage", kidIds: [], reason: "known newsletter" };
  }
  if (email.labels.includes("CATEGORY_SOCIAL")) {
    return { ...base, contact, category: "social", mode: "skip", kidIds: [], reason: "social notification" };
  }
  if (email.labels.includes("CATEGORY_PROMOTIONS")) {
    return { ...base, contact, category: "promo", mode: "skip", kidIds: [], reason: "promotion" };
  }
  if (email.hasUnsubscribe) {
    return { ...base, contact, category: "newsletter", mode: "triage", kidIds: [], reason: "list mail" };
  }
  return { ...base, contact, category: "other", mode: "triage", kidIds: mentioned, reason: "personal / other" };
}
