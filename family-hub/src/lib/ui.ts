import type { KidColor } from "./family/types";

/** Static class strings so Tailwind can see them. */
export const KID_STYLES: Record<KidColor, { dot: string; chip: string; band: string; soft: string; text: string; ring: string; bar: string; stroke: string }> = {
  sky: {
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-800",
    band: "bg-sky-500",
    soft: "bg-sky-50/70 dark:bg-sky-950/30",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-200 dark:ring-sky-800",
    bar: "bg-sky-400",
    stroke: "stroke-sky-500",
  },
  rose: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800",
    band: "bg-rose-500",
    soft: "bg-rose-50/70 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200 dark:ring-rose-800",
    bar: "bg-rose-400",
    stroke: "stroke-rose-500",
  },
  violet: {
    dot: "bg-violet-500",
    chip: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:ring-violet-800",
    band: "bg-violet-500",
    soft: "bg-violet-50/70 dark:bg-violet-950/30",
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-200 dark:ring-violet-800",
    bar: "bg-violet-400",
    stroke: "stroke-violet-500",
  },
  amber: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800",
    band: "bg-amber-500",
    soft: "bg-amber-50/70 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200 dark:ring-amber-800",
    bar: "bg-amber-400",
    stroke: "stroke-amber-500",
  },
  emerald: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800",
    band: "bg-emerald-500",
    soft: "bg-emerald-50/70 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200 dark:ring-emerald-800",
    bar: "bg-emerald-400",
    stroke: "stroke-emerald-500",
  },
  teal: {
    dot: "bg-teal-500",
    chip: "bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-800",
    band: "bg-teal-500",
    soft: "bg-teal-50/70 dark:bg-teal-950/30",
    text: "text-teal-700 dark:text-teal-300",
    ring: "ring-teal-200 dark:ring-teal-800",
    bar: "bg-teal-400",
    stroke: "stroke-teal-500",
  },
};

export const TYPE_META: Record<string, { label: string; chip: string }> = {
  task: { label: "Teendő", chip: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200" },
  event: { label: "Esemény", chip: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200" },
  reminder: { label: "Emlékeztető", chip: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200" },
  assessment: { label: "Számonkérés", chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200" },
  payment: { label: "Befizetés", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" },
  bill: { label: "Számla", chip: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200" },
  reading: { label: "Olvasnivaló", chip: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200" },
  podcast: { label: "Podcast", chip: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/60 dark:text-fuchsia-200" },
};

export const ASSESSMENT_KIND: Record<string, { label: string; chip: string; weight: number }> = {
  temazaro: { label: "Témazáró", chip: "bg-violet-600 text-white", weight: 3 },
  dolgozat: { label: "Dolgozat", chip: "bg-indigo-500 text-white", weight: 2 },
  beadando: { label: "Beadandó", chip: "bg-fuchsia-600 text-white", weight: 2 },
  felmeres: { label: "Felmérés", chip: "bg-sky-600 text-white", weight: 1 },
  teszt: { label: "Teszt", chip: "bg-cyan-600 text-white", weight: 1 },
  szobeli: { label: "Szóbeli", chip: "bg-teal-600 text-white", weight: 1 },
  egyeb: { label: "Számonkérés", chip: "bg-stone-600 text-white", weight: 1 },
};

export const CATEGORY_LABEL: Record<string, string> = {
  bring: "Bevinni",
  prepare: "Előkészíteni",
  practice: "Gyakorolni",
  sign: "Aláírni",
  buy: "Megvenni",
  reply: "Válaszolni",
  read: "Elolvasni",
  pay: "Fizetni",
  organize: "Szervezni",
  volunteer: "Önkéntes",
  menza: "Menza",
  class_fund: "Osztálypénz",
  trip: "Kirándulás",
  club: "Különóra",
  charity: "Adomány",
  photo: "Fotó",
  utility: "Rezsi",
  subscription: "Előfizetés",
  insurance: "Biztosítás",
  telecom: "Telefon/net",
  transport: "Közlekedés",
  shopping: "Vásárlás",
  other: "Egyéb",
};

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
