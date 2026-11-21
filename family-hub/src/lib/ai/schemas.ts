import * as z from "zod/v4";

/**
 * Structured-output schemas.
 *
 * Claude's structured outputs allow at most 16 union-typed parameters (nullable fields count)
 * and 24 optional parameters per request. So every field here is REQUIRED and NON-NULLABLE:
 * "unknown" is expressed as "" for strings, 0 for numbers and "none" for enums.
 * `normalizeDraft()` in items/drafts.ts turns those sentinels back into nulls.
 * No string/number constraints are used; dates and times are validated in code.
 */
export const ItemDraft = z.object({
  type: z.enum(["task", "event", "reminder", "assessment", "payment", "bill"]),
  area: z.enum(["school", "home", "finance", "personal"]),
  title: z.string().describe("Rövid magyar cím (max ~60 karakter). Teendőnél felszólító / főnévi formában."),
  details: z.string().describe("Lényeges részletek magyarul, 1-3 mondat; üres, ha nincs."),
  kid_ids: z.array(z.string()).describe("Érintett gyerekek azonosítói a családi konfigurációból."),
  category: z
    .enum([
      "none",
      "bring",
      "prepare",
      "practice",
      "sign",
      "buy",
      "reply",
      "read",
      "pay",
      "organize",
      "volunteer",
      "menza",
      "class_fund",
      "trip",
      "club",
      "charity",
      "photo",
      "utility",
      "subscription",
      "insurance",
      "telecom",
      "transport",
      "shopping",
      "other",
    ])
    .describe("Teendő/fizetés altípusa; 'none', ha nem értelmezhető."),
  subject: z.string().describe("Tantárgy (pl. Matek, Nyelvtan, Olvasás, Angol); üres, ha nincs."),
  assessment_kind: z.enum(["none", "dolgozat", "temazaro", "beadando", "felmeres", "teszt", "szobeli", "egyeb"]),
  topics: z.string().describe("Mit kell tudni / miből kell készülni; üres, ha nincs."),
  date: z.string().describe("YYYY-MM-DD (Europe/Budapest), határidő vagy kezdés napja; üres, ha nem ismert."),
  time: z.string().describe("HH:MM; üres, ha nincs időpont."),
  end_date: z.string().describe("YYYY-MM-DD; heti pontosságnál a lehetséges utolsó nap; különben üres."),
  end_time: z.string().describe("HH:MM vagy üres."),
  date_precision: z.enum(["exact", "week", "month", "unknown"]),
  amount: z.number().describe("Összeg; 0, ha nincs vagy nem ismert."),
  currency: z.string().describe("HUF / EUR; üres, ha nincs összeg."),
  payee: z.string().describe("Kedvezményezett / szolgáltató; üres, ha nincs."),
  payment_account: z.string().describe("Bankszámlaszám vagy fizetési link; üres, ha nincs."),
  payment_reference: z.string().describe("Közlemény; üres, ha nincs."),
  payment_status: z.enum(["none", "unpaid", "paid", "autopay"]),
  invoice_number: z.string().describe("Számla sorszáma; üres, ha nincs."),
  url: z.string().describe("Releváns link; üres, ha nincs."),
  priority: z.enum(["low", "normal", "high"]),
  estimate_minutes: z.number().describe("Becsült ráfordítás percben; 0, ha nem értelmezhető."),
  confidence: z.number().describe("0..1 – mennyire biztos a kinyerés (dátum, gyerek, tartalom)."),
  source_quote: z.string().describe("Rövid szó szerinti idézet a levélből, amely alátámasztja."),
  existing_item_id: z.string().describe("Ha egy meglévő tételt frissít, annak azonosítója; különben üres."),
});
export type ItemDraft = z.infer<typeof ItemDraft>;

export const Extraction = z.object({
  summary: z.string().describe("1-3 mondatos magyar összefoglaló a szülő számára."),
  category: z.enum(["school", "kreta", "szmk", "school_money", "bill", "receipt", "payment_confirmation", "club", "personal", "other"]),
  kid_ids: z.array(z.string()),
  original_author: z.string().describe("Továbbított levélnél az eredeti szerző neve; különben üres."),
  is_actionable: z.boolean(),
  items: z.array(ItemDraft),
  completed_item_ids: z.array(z.string()).describe("Meglévő tételek, amelyeket ez a levél teljesítettnek/fizetettnek igazol."),
});
export type Extraction = z.infer<typeof Extraction>;

export const Triage = z.object({
  emails: z.array(
    z.object({
      email_id: z.string(),
      kind: z.enum(["action", "reading", "podcast", "bill", "event", "info", "noise"]),
      summary: z.string().describe("Egy mondat magyarul."),
      items: z.array(ItemDraft).describe("Teendő / számla / esemény tételek (action, bill, event esetén)."),
    }),
  ),
  readings: z.array(
    z.object({
      email_id: z.string(),
      title: z.string(),
      url: z.string().describe("A cikk kanonikus URL-je; üres, ha nincs."),
      source: z.string(),
      why: z.string().describe("Miért érdemes elolvasni – kontextus magyarul."),
      minutes: z.number().describe("Becsült olvasási idő percben; 0, ha nem ismert."),
      score: z.number().describe("0..1 relevancia a felhasználó érdeklődéséhez."),
    }),
  ),
  podcasts: z.array(
    z.object({
      email_id: z.string(),
      show: z.string(),
      episode_title: z.string(),
      url: z.string().describe("Epizód linkje; üres, ha nincs."),
      why: z.string().describe("Miért érdemes meghallgatni – kontextus magyarul."),
      worthy: z.boolean(),
      spotify_query: z.string().describe("Keresőkifejezés a Spotify-hoz: műsor + epizód címe."),
      minutes: z.number().describe("Hossz percben; 0, ha nem ismert."),
      score: z.number(),
    }),
  ),
});
export type Triage = z.infer<typeof Triage>;

export const Digest = z.object({
  headline: z.string().describe("Egy mondatos összefoglaló a napról, magyarul."),
  focus: z.array(z.string()).describe("3-5 legfontosabb dolog ma / holnap."),
  suggested_actions: z.array(
    z.object({
      title: z.string(),
      why: z.string(),
      kind: z.enum(["reply", "pay", "schedule", "buy", "prepare", "read", "decide", "call", "unsubscribe", "other"]),
      urgency: z.enum(["today", "this_week", "later"]),
      item_id: z.string().describe("Kapcsolódó tétel azonosítója; üres, ha nincs."),
      email_id: z.string().describe("Kapcsolódó levél azonosítója; üres, ha nincs."),
    }),
  ),
  reading_pick_ids: z.array(z.string()),
  podcast_pick_ids: z.array(z.string()),
  week_ahead: z.string().describe("Rövid előretekintés a következő 7 napra, gyerekenként ha releváns."),
  family_tip: z.string().describe("Egy konkrét, személyre szabott produktivitási javaslat a családnak; üres, ha nincs."),
});
export type Digest = z.infer<typeof Digest>;

export const QuickAdd = z.object({
  items: z.array(ItemDraft),
});
export type QuickAdd = z.infer<typeof QuickAdd>;
