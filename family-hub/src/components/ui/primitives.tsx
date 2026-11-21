import type { ReactNode } from "react";
import type { Kid } from "@/lib/family/types";
import { ASSESSMENT_KIND, KID_STYLES, TYPE_META, cx } from "@/lib/ui";

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={cx("card", className)}>{children}</As>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, icon, action, className }: { children: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-3 flex flex-wrap items-center justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-ink-2">
        {icon && <span className="text-muted">{icon}</span>}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-medium text-ink-2">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint, tone = "default", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "accent" | "violet" | "emerald" | "amber"; icon?: ReactNode }) {
  const tones = {
    default: "",
    accent: "bg-accent-soft/60",
    violet: "bg-violet-50/80 dark:bg-violet-950/30",
    emerald: "bg-emerald-50/80 dark:bg-emerald-950/30",
    amber: "bg-amber-50/80 dark:bg-amber-950/30",
  } as const;
  return (
    <div className={cx("card flex flex-col gap-1 p-4", tones[tone])}>
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="font-display text-2xl font-semibold text-ink">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function KidDot({ kid, className }: { kid: Kid; className?: string }) {
  return <span className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", KID_STYLES[kid.color].dot, className)} />;
}

export function KidChip({ kid, size = "sm" }: { kid: Kid; size?: "sm" | "md" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        KID_STYLES[kid.color].chip,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <KidDot kid={kid} className="h-1.5 w-1.5" />
      {kid.emoji ? `${kid.emoji} ` : ""}
      {kid.name}
    </span>
  );
}

export function KidChips({ kids, ids }: { kids: Kid[]; ids: string[] }) {
  const list = ids.map((id) => kids.find((k) => k.id === id)).filter(Boolean) as Kid[];
  if (!list.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.map((k) => (
        <KidChip key={k.id} kid={k} />
      ))}
    </span>
  );
}

export function TypeChip({ type }: { type: string }) {
  const m = TYPE_META[type] ?? TYPE_META.task;
  return <span className={cx("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", m.chip)}>{m.label}</span>;
}

export function AssessmentChip({ kind }: { kind: string | null }) {
  const m = ASSESSMENT_KIND[kind ?? "egyeb"] ?? ASSESSMENT_KIND.egyeb;
  return <span className={cx("rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", m.chip)}>{m.label}</span>;
}

export function Pill({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "red" | "amber" | "emerald" | "sky" | "violet" }) {
  const t = {
    stone: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
    red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
    violet: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  }[tone];
  return <span className={cx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", t)}>{children}</span>;
}

export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const t = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  }[tone];
  return <div className={cx("mb-6 rounded-2xl border px-4 py-3 text-sm", t)}>{children}</div>;
}
