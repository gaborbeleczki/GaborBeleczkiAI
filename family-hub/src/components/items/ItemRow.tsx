import { AlertTriangle, CalendarCheck2, Mail, Paperclip } from "lucide-react";
import type { Item } from "@/lib/db/schema";
import type { Kid } from "@/lib/family/types";
import { gmailUrl } from "@/lib/google/gmail";
import { formatHuf, huDate, huRelative, todayISO } from "@/lib/time";
import { ASSESSMENT_KIND, CATEGORY_LABEL, cx } from "@/lib/ui";
import { AssessmentChip, KidChips, Pill, TypeChip } from "@/components/ui/primitives";
import { DoneCheckbox, ItemMenu, type ItemLite } from "./client";

export function toLite(i: Item): ItemLite {
  return {
    id: i.id,
    type: i.type,
    area: i.area,
    title: i.title,
    details: i.details,
    kidIds: i.kidIds,
    category: i.category,
    subject: i.subject,
    assessmentKind: i.assessmentKind,
    topics: i.topics,
    date: i.date,
    time: i.time,
    endDate: i.endDate,
    datePrecision: i.datePrecision,
    status: i.status,
    priority: i.priority,
    amount: i.amount,
    currency: i.currency,
    payee: i.payee,
    account: i.paymentInfo?.account ?? null,
    reference: i.paymentInfo?.reference ?? null,
  };
}

export function DateLabel({ item, today = todayISO() }: { item: Item; today?: string }) {
  if (!item.date) return <span className="text-muted">nincs dátum</span>;
  if (item.datePrecision === "week") {
    return (
      <span className="italic text-ink-2">
        {huDate(item.date)}–{item.endDate ? huDate(item.endDate) : ""} között
      </span>
    );
  }
  const overdue = item.date < today && item.status === "open" && item.type !== "event";
  return (
    <span className={cx(overdue ? "font-semibold text-red-700 dark:text-red-300" : "text-ink-2")}>
      {huRelative(item.date, today)}
      <span className="text-muted"> · {huDate(item.date)}</span>
      {item.time && <span className="text-muted"> {item.time}</span>}
    </span>
  );
}

export function ItemRow({
  item,
  kids,
  account,
  calendarEnabled,
  showKids = true,
  compact,
}: {
  item: Item;
  kids: Kid[];
  account: string | null;
  calendarEnabled: boolean;
  showKids?: boolean;
  compact?: boolean;
}) {
  const done = item.status === "done";
  return (
    <li
      id={`item-${item.id}`}
      className={cx("group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-2", done && "opacity-55")}
    >
      <div className="pt-0.5">
        <DoneCheckbox id={item.id} done={done} label={item.title} tone={item.type === "payment" || item.type === "bill" ? "money" : "default"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {item.type === "assessment" ? <AssessmentChip kind={item.assessmentKind} /> : !compact && <TypeChip type={item.type} />}
          <span className={cx("font-medium text-ink", done && "line-through")}>{item.title}</span>
          {item.priority === "high" && !done && <Pill tone="red">fontos</Pill>}
          {item.status === "waiting" && <Pill tone="sky">várakozik</Pill>}
          {item.needsReview && <Pill tone="amber">átnézendő</Pill>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <DateLabel item={item} />
          {showKids && <KidChips kids={kids} ids={item.kidIds} />}
          {item.subject && item.type !== "assessment" && <span className="text-muted">{item.subject}</span>}
          {item.type === "assessment" && item.subject && <span className="font-medium text-ink-2">{item.subject}</span>}
          {item.category && CATEGORY_LABEL[item.category] && item.type === "task" && <span className="text-muted">{CATEGORY_LABEL[item.category]}</span>}
          {item.amount != null && <span className="font-semibold text-ink">{formatHuf(item.amount, item.currency ?? "HUF")}</span>}
          {item.sourceContact && !compact && <span className="text-muted">{item.sourceContact}</span>}
          {item.sourceEmailId && (
            <a href={gmailUrl(item.sourceEmailId, account)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink" title="Eredeti levél">
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
          {item.calendarEventId && <CalendarCheck2 className="h-3.5 w-3.5 text-emerald-600" aria-label="A naptárban" />}
          {item.calendarError && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-label={item.calendarError} />}
          {item.meta?.history?.length ? <Paperclip className="h-3.5 w-3.5 text-muted" aria-label="több levélből frissítve" /> : null}
        </div>
        {!compact && (item.topics || item.details) && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{item.type === "assessment" && item.topics ? item.topics : item.details}</p>
        )}
      </div>
      <ItemMenu item={toLite(item)} kids={kids} calendarEnabled={calendarEnabled} />
    </li>
  );
}

export function weightOf(item: Item): number {
  return ASSESSMENT_KIND[item.assessmentKind ?? "egyeb"]?.weight ?? 1;
}
