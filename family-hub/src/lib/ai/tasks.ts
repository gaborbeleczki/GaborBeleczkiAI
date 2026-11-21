import "server-only";
import { callStructured } from "./client";
import {
  DIGEST_SYSTEM,
  EXTRACTION_SYSTEM,
  QUICKADD_SYSTEM,
  TRIAGE_SYSTEM,
  familyContext,
  renderEmail,
} from "./prompts";
import { Digest, Extraction, QuickAdd, Triage } from "./schemas";
import type { FamilyConfig } from "../family/types";
import type { ParsedEmail } from "../google/mime";
import type { Classification } from "../sync/classify";
import { huWeekday, todayISO, toLocal } from "../time";

export type ExistingItemBrief = {
  id: string;
  type: string;
  title: string;
  kidIds: string[];
  date: string | null;
  status: string;
  amount: number | null;
  payee: string | null;
};

function briefList(items: ExistingItemBrief[]): string {
  if (!items.length) return "(none)";
  return items
    .map(
      (i) =>
        `- id=${i.id} type=${i.type} kids=[${i.kidIds.join(",")}] date=${i.date ?? "?"} status=${i.status}${
          i.amount != null ? ` amount=${i.amount}` : ""
        }${i.payee ? ` payee="${i.payee}"` : ""} title="${i.title}"`,
    )
    .join("\n");
}

export async function extractEmail(
  email: ParsedEmail,
  cls: Classification,
  family: FamilyConfig,
  existing: ExistingItemBrief[],
) {
  const hints = [
    `Pre-classifier: category=${cls.category} (${cls.reason})`,
    cls.kidIds.length ? `Likely kids: ${cls.kidIds.join(", ")}` : null,
    cls.contact ? `Sender is known contact: ${cls.contact.name} (${cls.contact.role}${cls.contact.subject ? `, ${cls.contact.subject}` : ""})` : null,
    cls.forwardedFrom ? `Forwarded content originally from: ${cls.forwardedFrom.name} (${cls.forwardedFrom.subject ?? cls.forwardedFrom.role})` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return callStructured({
    schema: Extraction,
    system: EXTRACTION_SYSTEM,
    context: familyContext(family),
    user: `Today is ${todayISO()} (${huWeekday(todayISO())}).

${hints}

Open items that already exist (for deduplication):
${briefList(existing)}

${renderEmail(email)}`,
    effort: "medium",
  });
}

export type TriageInput = { email: ParsedEmail; excerptChars: number };

export async function triageEmails(batch: TriageInput[], family: FamilyConfig) {
  const rendered = batch
    .map(({ email, excerptChars }) => {
      const links = email.links
        .slice(0, 12)
        .map((l) => `  - ${l.text} → ${l.href}`)
        .join("\n");
      return `${renderEmail(email, excerptChars)}${links ? `\nLinks:\n${links}` : ""}`;
    })
    .join("\n\n");
  return callStructured({
    schema: Triage,
    system: TRIAGE_SYSTEM,
    context: familyContext(family),
    user: `Today is ${todayISO()}. Triage these ${batch.length} emails (one entry per email_id, same ids as given):\n\n${rendered}`,
    effort: "medium",
  });
}

export async function writeDigest(input: string, family: FamilyConfig) {
  return callStructured({
    schema: Digest,
    system: DIGEST_SYSTEM,
    context: familyContext(family),
    user: input,
    effort: "medium",
  });
}

export async function parseQuickAdd(text: string, family: FamilyConfig) {
  const now = toLocal();
  return callStructured({
    schema: QuickAdd,
    system: QUICKADD_SYSTEM,
    context: familyContext(family),
    user: `Current date/time: ${now.date} ${now.time} (${huWeekday(now.date)}).\nNote: ${text}`,
    effort: "low",
    maxTokens: 4000,
  });
}
