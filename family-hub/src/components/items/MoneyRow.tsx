import { Mail } from "lucide-react";
import type { Item } from "@/lib/db/schema";
import type { Kid } from "@/lib/family/types";
import { gmailUrl } from "@/lib/google/gmail";
import { formatHuf, huDate, huRelative, todayISO } from "@/lib/time";
import { CATEGORY_LABEL, cx } from "@/lib/ui";
import { KidChips, Pill } from "@/components/ui/primitives";
import { CopyButton, ItemMenu, PaidToggle } from "./client";
import { toLite } from "./ItemRow";

export function moneyStatus(i: Item, today = todayISO()): { label: string; tone: "red" | "amber" | "emerald" | "stone" | "sky" } {
  if (i.status === "done") return i.paymentInfo?.method === "csoportos beszedés" ? { label: "Csoportos beszedés", tone: "sky" } : { label: "Fizetve", tone: "emerald" };
  if (!i.date) return { label: "Nyitott", tone: "stone" };
  if (i.date < today) return { label: "Lejárt", tone: "red" };
  if (i.date <= todayISO(new Date(Date.now() + 3 * 86_400_000))) return { label: "Hamarosan", tone: "amber" };
  return { label: "Fizetendő", tone: "stone" };
}

export function MoneyRow({ item, kids, account, calendarEnabled, showKids = true }: { item: Item; kids: Kid[]; account: string | null; calendarEnabled: boolean; showKids?: boolean }) {
  const today = todayISO();
  const st = moneyStatus(item, today);
  const paid = item.status === "done";
  return (
    <li className={cx("flex flex-col gap-2 rounded-2xl p-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center", paid && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("font-medium", paid && "line-through decoration-emerald-500/60")}>{item.title}</span>
          <Pill tone={st.tone}>{st.label}</Pill>
          {item.category && CATEGORY_LABEL[item.category] && <span className="text-xs text-muted">{CATEGORY_LABEL[item.category]}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {item.payee && <span className="text-ink-2">{item.payee}</span>}
          {item.date && (
            <span>
              határidő: {huDate(item.date)} ({huRelative(item.date, today)})
            </span>
          )}
          {paid && item.paidAt && <span>fizetve: {huDate(todayISO(item.paidAt))}</span>}
          {showKids && <KidChips kids={kids} ids={item.kidIds} />}
          {item.sourceEmailId && (
            <a href={gmailUrl(item.sourceEmailId, account)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              <Mail className="h-3.5 w-3.5" /> levél
            </a>
          )}
        </div>
        {!paid && (item.paymentInfo?.account || item.paymentInfo?.reference || item.paymentInfo?.invoiceNumber) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.paymentInfo?.account && <CopyButton value={item.paymentInfo.account} label="Számlaszám" />}
            {item.paymentInfo?.reference && <CopyButton value={item.paymentInfo.reference} label="Közlemény" />}
            {item.paymentInfo?.invoiceNumber && <CopyButton value={item.paymentInfo.invoiceNumber} label="Számlaszám (sorszám)" />}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <span className="font-display text-lg font-semibold tabular-nums">{formatHuf(item.amount, item.currency ?? "HUF")}</span>
        <PaidToggle id={item.id} paid={paid} />
        <ItemMenu item={toLite(item)} kids={kids} calendarEnabled={calendarEnabled} />
      </div>
    </li>
  );
}
