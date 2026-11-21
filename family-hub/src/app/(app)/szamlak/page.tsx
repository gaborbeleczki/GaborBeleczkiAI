import Link from "next/link";
import { AlertCircle, CheckCircle2, PiggyBank, Receipt, Wallet } from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle, StatTile } from "@/components/ui/primitives";
import { MoneyRow } from "@/components/items/MoneyRow";
import { NewItemButton } from "@/components/items/client";
import { pageContext } from "@/lib/page-context";
import { listItems } from "@/lib/items/repo";
import { addDaysISO, formatHuf, huMonth, todayISO } from "@/lib/time";
import { CATEGORY_LABEL, cx } from "@/lib/ui";
import type { Item } from "@/lib/db/schema";

export const metadata = { title: "Számlák" };

const sum = (list: Item[]) => list.filter((i) => (i.currency ?? "HUF") === "HUF").reduce((s, i) => s + (i.amount ?? 0), 0);

const BAR_COLORS = ["bg-amber-400", "bg-sky-400", "bg-emerald-400", "bg-rose-400", "bg-violet-400", "bg-teal-400", "bg-stone-400"];

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const sp = await searchParams;
  const ctx = await pageContext();
  const { kids } = ctx;
  const today = todayISO();
  const types = sp.scope === "all" ? ["bill", "payment"] : ["bill"];
  const items = await listItems({ types, statuses: ["open", "waiting", "done"], from: addDaysISO(today, -120), includeUndated: true });
  const open = items.filter((i) => i.status !== "done").sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const overdue = open.filter((i) => i.date && i.date < today);
  const week = open.filter((i) => i.date && i.date >= today && i.date <= addDaysISO(today, 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  const paidThisMonth = items.filter((i) => i.status === "done" && i.paidAt && todayISO(i.paidAt) >= monthStart);
  const paidRecent = items.filter((i) => i.status === "done").sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0)).slice(0, 25);

  // spend by category / vendor over the last ~90 days
  const recent = items.filter((i) => (i.date ?? todayISO(i.createdAt)) >= addDaysISO(today, -90));
  const groups = new Map<string, number>();
  for (const i of recent) {
    const key = (i.category && CATEGORY_LABEL[i.category]) || i.payee || "Egyéb";
    groups.set(key, (groups.get(key) ?? 0) + ((i.currency ?? "HUF") === "HUF" ? (i.amount ?? 0) : 0));
  }
  const top = Array.from(groups.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = Math.max(1, ...top.map(([, v]) => v));

  return (
    <div className="rise">
      <PageHeader
        eyebrow="Pénzügyek"
        title="Számlák és díjak"
        subtitle="A postafiókba érkező számlák, díjbekérők és előfizetések – és hogy ki vannak-e fizetve."
        actions={
          <>
            <div className="flex rounded-full bg-surface p-1 ring-1 ring-line ring-inset">
              <Link href="/szamlak" className={cx("rounded-full px-3 py-1 text-sm", sp.scope !== "all" ? "bg-ink text-surface" : "text-ink-2")}>
                Csak számlák
              </Link>
              <Link href="/szamlak?scope=all" className={cx("rounded-full px-3 py-1 text-sm", sp.scope === "all" ? "bg-ink text-surface" : "text-ink-2")}>
                + iskolai befizetések
              </Link>
            </div>
            <NewItemButton kids={kids} defaults={{ type: "bill", area: "finance" }} label="Új számla" />
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Fizetendő" value={formatHuf(sum(open))} hint={`${open.length} tétel`} icon={<Wallet className="h-4 w-4" />} tone="amber" />
        <StatTile label="Lejárt" value={overdue.length} hint={overdue.length ? formatHuf(sum(overdue)) : "minden rendben"} icon={<AlertCircle className="h-4 w-4" />} tone={overdue.length ? "accent" : "default"} />
        <StatTile label="7 napon belül" value={formatHuf(sum(week))} hint={`${week.length} határidő`} />
        <StatTile label={`${huMonth(Number(today.slice(5, 7)))} – fizetve`} value={formatHuf(sum(paidThisMonth))} hint={`${paidThisMonth.length} tétel`} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-2">
            <div className="px-3 pt-3">
              <SectionTitle icon={<Receipt className="h-4 w-4" />}>Fizetendő</SectionTitle>
            </div>
            {open.length ? (
              <ul>
                {open.map((i) => (
                  <MoneyRow key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} />
                ))}
              </ul>
            ) : (
              <div className="p-3">
                <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="Nincs kifizetetlen számla" />
              </div>
            )}
          </Card>
          <Card className="p-2">
            <div className="px-3 pt-3">
              <SectionTitle icon={<CheckCircle2 className="h-4 w-4" />}>Kifizetve (legutóbbiak)</SectionTitle>
            </div>
            {paidRecent.length ? (
              <ul>
                {paidRecent.map((i) => (
                  <MoneyRow key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} />
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-muted">Még nincs kifizetett tétel.</p>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>Elmúlt 90 nap</SectionTitle>
            {top.length ? (
              <ul className="space-y-3">
                {top.map(([k, v], idx) => (
                  <li key={k}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="truncate text-ink-2">{k}</span>
                      <span className="font-semibold tabular-nums">{formatHuf(v)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-line-2">
                      <div className={cx("h-2 rounded-full", BAR_COLORS[idx % BAR_COLORS.length])} style={{ width: `${(v / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nincs adat.</p>
            )}
          </Card>
          <Card className="p-5 text-sm text-ink-2">
            <SectionTitle>Hogyan működik?</SectionTitle>
            <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-muted">
              <li>A számla- és díjbekérő leveleket (MVM, Telekom, BKK, biztosító, előfizetések…) az AI felismeri, kiolvassa az összeget és a határidőt.</li>
              <li>A kártyás nyugták és a „Sikeres fizetés” értesítők automatikusan „fizetve” státuszt kapnak, és lezárják a hozzájuk tartozó nyitott számlát.</li>
              <li>Határidő előtt 2 nappal egy 15 perces fizetési idősáv kerül a naptárba.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
