import type { Digest } from "./ai/schemas";

export type WeekAheadGroup = { key: string; lines: string[] };

/** What the pages render. Digests can be written by the app or by the scheduled Claude run,
 *  so every field is coerced to a safe shape on read – a slightly off-format digest must
 *  never crash a page. */
export type StoredDigest = Digest & {
  generatedAt: string;
  date: string;
  author?: string;
  /** Per-child outlook when the digest provides it (e.g. { vencel: [...], zoja: [...] }). */
  week_ahead_groups?: WeekAheadGroup[];
};

const KINDS = ["reply", "pay", "schedule", "buy", "prepare", "read", "decide", "call", "unsubscribe", "other"] as const;
const URGENCIES = ["today", "this_week", "later"] as const;

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join("; ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${k}: ${str(x)}`)
      .join("; ");
  }
  return "";
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  const s = str(v);
  return s ? [s] : [];
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function normalizeDigest(raw: unknown, fallbackDate = ""): StoredDigest {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  let weekAhead = "";
  let groups: WeekAheadGroup[] = [];
  const wa = d.week_ahead;
  if (wa && typeof wa === "object" && !Array.isArray(wa)) {
    groups = Object.entries(wa as Record<string, unknown>)
      .map(([key, v]) => ({ key, lines: strList(v) }))
      .filter((g) => g.lines.length > 0);
    weekAhead = groups.map((g) => `${g.key}: ${g.lines.join("; ")}`).join("\n");
  } else {
    weekAhead = Array.isArray(wa) ? strList(wa).join("\n") : str(wa);
  }

  const actions = Array.isArray(d.suggested_actions) ? d.suggested_actions : [];
  return {
    date: str(d.date) || fallbackDate,
    generatedAt: str(d.generatedAt) || new Date(0).toISOString(),
    author: d.author ? str(d.author) : undefined,
    headline: str(d.headline),
    focus: strList(d.focus),
    suggested_actions: actions
      .filter((a) => a && typeof a === "object")
      .map((a) => {
        const x = a as Record<string, unknown>;
        return {
          title: str(x.title),
          why: str(x.why),
          kind: pick(x.kind, KINDS, "other"),
          urgency: pick(x.urgency, URGENCIES, "this_week"),
          item_id: str(x.item_id),
          email_id: str(x.email_id),
        };
      })
      .filter((a) => a.title),
    reading_pick_ids: strList(d.reading_pick_ids),
    podcast_pick_ids: strList(d.podcast_pick_ids),
    week_ahead: weekAhead,
    week_ahead_groups: groups,
    family_tip: str(d.family_tip),
  };
}
