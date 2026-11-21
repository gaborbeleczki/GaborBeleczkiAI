import { EMPTY_FAMILY, type Contact, type FamilyConfig, type Kid, type KidColor } from "./types";

const COLORS: KidColor[] = ["sky", "rose", "violet", "amber", "emerald", "teal"];

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function strArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Accepts loosely-shaped JSON (from the settings form or FAMILY_CONFIG_JSON) and returns a valid config. */
export function normalizeFamily(input: unknown): FamilyConfig {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const kidsRaw = Array.isArray(raw.kids) ? raw.kids : [];
  const kids: Kid[] = kidsRaw.map((k, i) => {
    const o = (k ?? {}) as Record<string, unknown>;
    const name = String(o.name ?? `Gyerek ${i + 1}`).trim();
    const color = COLORS.includes(o.color as KidColor) ? (o.color as KidColor) : COLORS[i % COLORS.length];
    return {
      id: String(o.id ?? "").trim() || slug(name) || `kid-${i + 1}`,
      name,
      fullName: o.fullName ? String(o.fullName) : undefined,
      className: o.className ? String(o.className) : undefined,
      school: o.school ? String(o.school) : undefined,
      color,
      emoji: o.emoji ? String(o.emoji) : undefined,
      classGroupEmails: strArr(o.classGroupEmails).map((e) => e.toLowerCase()),
    };
  });
  const kidIds = new Set(kids.map((k) => k.id));
  const contactsRaw = Array.isArray(raw.contacts) ? raw.contacts : [];
  const contacts: Contact[] = contactsRaw.map((c, i) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const name = String(o.name ?? `Kapcsolat ${i + 1}`).trim();
    return {
      id: String(o.id ?? "").trim() || slug(name) || `contact-${i + 1}`,
      name,
      emails: strArr(o.emails).map((e) => e.toLowerCase()),
      role: (o.role as Contact["role"]) ?? "other",
      subject: o.subject ? String(o.subject) : undefined,
      kidIds: strArr(o.kidIds).filter((id) => kidIds.has(id)),
      note: o.note ? String(o.note) : undefined,
    };
  });
  const src = (raw.sources ?? {}) as Record<string, unknown>;
  const parentsRaw = Array.isArray(raw.parents) ? raw.parents : [];
  return {
    familyName: String(raw.familyName ?? EMPTY_FAMILY.familyName),
    parents: parentsRaw
      .map((p) => {
        const o = (p ?? {}) as Record<string, unknown>;
        return { name: String(o.name ?? "").trim(), email: String(o.email ?? "").trim().toLowerCase() };
      })
      .filter((p) => p.name || p.email),
    kids,
    contacts,
    sources: {
      kreta: strArr(src.kreta ?? EMPTY_FAMILY.sources.kreta).map((s) => s.toLowerCase()),
      szmk: strArr(src.szmk ?? EMPTY_FAMILY.sources.szmk).map((s) => s.toLowerCase()),
      menza: strArr(src.menza).map((s) => s.toLowerCase()),
      billers: strArr(src.billers).map((s) => s.toLowerCase()),
      newsletters: strArr(src.newsletters ?? EMPTY_FAMILY.sources.newsletters).map((s) => s.toLowerCase()),
      ignore: strArr(src.ignore).map((s) => s.toLowerCase()),
    },
    aiNotes: String(raw.aiNotes ?? ""),
  };
}
