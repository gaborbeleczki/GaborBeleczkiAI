import Link from "next/link";
import { CheckCircle2, PiggyBank, Receipt, Users } from "lucide-react";
import { Card, EmptyState, KidChip, PageHeader, SectionTitle, StatTile } from "@/components/ui/primitives";
import { MoneyRow } from "@/components/items/MoneyRow";
import { NewItemButton } from "@/components/items/client";
import { pageContext } from "@/lib/page-context";
import { listItems } from "@/lib/items/repo";
import { addDaysISO, formatHuf, todayISO } from "@/lib/time";
import { KID_STYLES, cx } from "@/lib/ui";
import type { Item } from "@/lib/db/schema";

export const metadata = { title: "Befizetések" };

const sum = (list: Item[]) => list.filter((i) => (i.currency ?? "HUF") === "HUF").reduce((s, i) => s + (i.amount ?? 0), 0);

/** School-year start (Sept 1) for the "paid this school year" total. */
function schoolYearStart(today: string) {
  const y = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= 9 ? `${y}-09-01` : `${y - 1}-09-01`;
}

export default async function SchoolMoneyPage() {
  const ctx = await pageContext();
  const { kids } = ctx;
  const today = todayISO();
  const payments = await listItems({ types: ["payment"], statuses: ["open", "waiting", "done"], from: addDaysISO(schoolYearStart(today), -30), includeUndated: true });
  const open = payments.filter((p) => p.status !== "done");
  const paid = payments.filter((p) => p.status === "done");
  const dueWeek = open.filter((p) => p.date && p.date <= addDaysISO(today, 7));
  const shared = open.filter((p) => !p.kidIds.length);
  const maxKid = Math.max(1, ...kids.map((k) => sum(payments.filter((p) => p.kidIds.includes(k.id)))));

  return (
    <div className="rise">
      <PageHeader
        eyebrow="Iskolai pénzgyűjtés"
        title="Befizetések"
        subtitle="Osztálypénz, kirándulás, menza, különórák – gyerekenként, egy kattintással „befizetve” jelöléssel."
        actions={
          <>
            <Link href="/szamlak" className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-ink-2 ring-1 ring-line ring-inset hover:bg-surface">
              <Receipt className="h-4 w-4" /> Számlák
            </Link>
            <NewItemButton kids={kids} defaults={{ type: "payment", area: "school" }} label="Új befizetés" />
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Nyitott" value={formatHuf(sum(open))} hint={`${open.length} tétel`} icon={<PiggyBank className="h-4 w-4" />} tone="emerald" />
        <StatTile label="7 napon belül" value={formatHuf(sum(dueWeek))} hint={`${dueWeek.length} határidő`} tone="amber" />
        <StatTile label="Idén befizetve" value={formatHuf(sum(paid))} hint="szeptember 1. óta" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatTile label="Gyerekenként" value={kids.length} hint="lásd lent" icon={<Users className="h-4 w-4" />} />
      </div>

      {kids.length > 0 && (
        <Card className="mb-8 p-5">
          <SectionTitle>Tanév összesítő</SectionTitle>
          <div className="space-y-3">
            {kids.map((k) => {
              const mine = payments.filter((p) => p.kidIds.includes(k.id));
              const total = sum(mine);
              const done = sum(mine.filter((p) => p.status === "done"));
              return (
                <div key={k.id} className="grid grid-cols-[90px_1fr_auto] items-center gap-3">
                  <KidChip kid={k} size="md" />
                  <div className="relative h-3 overflow-hidden rounded-full bg-line-2" style={{ width: `${Math.max(8, (total / maxKid) * 100)}%` }}>
                    <div className={cx("absolute inset-y-0 left-0 rounded-full", KID_STYLES[k.color].band)} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm tabular-nums text-ink-2">
                    <span className="font-semibold text-ink">{formatHuf(done)}</span> / {formatHuf(total)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {payments.length === 0 ? (
        <EmptyState icon={<PiggyBank className="h-7 w-7" />} title="Nincs pénzkérés">
          Amikor a tanító, az osztálypénztáros vagy az SZMK pénzt kér, itt jelenik meg gyerekenként.
        </EmptyState>
      ) : (
        <div className={cx("grid gap-6", kids.length > 1 && "xl:grid-cols-2")}>
          {kids.map((k) => {
            const mineOpen = open.filter((p) => p.kidIds.includes(k.id));
            const minePaid = paid.filter((p) => p.kidIds.includes(k.id));
            return (
              <Card key={k.id} className="overflow-hidden">
                <div className={cx("flex items-center justify-between px-5 py-4", KID_STYLES[k.color].soft)}>
                  <KidChip kid={k} size="md" />
                  <span className="text-sm text-ink-2">
                    nyitott: <span className="font-display text-lg font-semibold text-ink">{formatHuf(sum(mineOpen))}</span>
                  </span>
                </div>
                <div className="p-2">
                  {mineOpen.length ? (
                    <ul>
                      {mineOpen.map((p) => (
                        <MoneyRow key={p.id} item={p} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} showKids={false} />
                      ))}
                    </ul>
                  ) : (
                    <p className="p-4 text-sm text-muted">Nincs nyitott befizetés. ✨</p>
                  )}
                  {minePaid.length > 0 && (
                    <details className="mt-1 border-t border-line px-2 pt-2">
                      <summary className="cursor-pointer py-1 text-xs font-semibold uppercase tracking-wider text-muted">Befizetve ({minePaid.length})</summary>
                      <ul>
                        {minePaid.map((p) => (
                          <MoneyRow key={p.id} item={p} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} showKids={false} />
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {shared.length > 0 && (
        <Card className="mt-6 p-2">
          <div className="px-3 pt-3">
            <SectionTitle>Közös / gyerekhez nem rendelt</SectionTitle>
          </div>
          <ul>
            {shared.map((p) => (
              <MoneyRow key={p.id} item={p} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
