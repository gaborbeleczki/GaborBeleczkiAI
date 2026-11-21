import Link from "next/link";
import { Bell, Columns3, GraduationCap, Home, Hourglass, List, ListChecks } from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { ItemRow } from "@/components/items/ItemRow";
import { NewItemButton, QuickAdd } from "@/components/items/client";
import { pageContext } from "@/lib/page-context";
import { listItems } from "@/lib/items/repo";
import { addDaysISO, huDate, huRelative, todayISO } from "@/lib/time";
import { KID_STYLES, cx } from "@/lib/ui";
import type { Item } from "@/lib/db/schema";

export const metadata = { title: "Teendők" };

type Lane = { key: string; title: string; icon: React.ReactNode; tone: string; filter: (i: Item) => boolean };

const LANES: Lane[] = [
  {
    key: "school",
    title: "Iskola",
    icon: <GraduationCap className="h-4 w-4" />,
    tone: "from-violet-100/70 dark:from-violet-950/40",
    filter: (i) => i.status !== "waiting" && i.type !== "reminder" && (i.area === "school" || (i.kidIds.length > 0 && i.area !== "home")),
  },
  {
    key: "home",
    title: "Otthon & személyes",
    icon: <Home className="h-4 w-4" />,
    tone: "from-amber-100/70 dark:from-amber-950/40",
    filter: (i) => i.status !== "waiting" && i.type !== "reminder" && i.area !== "school" && !(i.kidIds.length > 0 && i.area !== "home"),
  },
  {
    key: "reminders",
    title: "Emlékeztetők",
    icon: <Bell className="h-4 w-4" />,
    tone: "from-rose-100/70 dark:from-rose-950/40",
    filter: (i) => i.status !== "waiting" && i.type === "reminder",
  },
  {
    key: "waiting",
    title: "Várakozik másra",
    icon: <Hourglass className="h-4 w-4" />,
    tone: "from-sky-100/70 dark:from-sky-950/40",
    filter: (i) => i.status === "waiting",
  },
];

function sortItems(a: Item, b: Item) {
  if (!a.date && !b.date) return b.createdAt.getTime() - a.createdAt.getTime();
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");
}

export default async function TodosPage({ searchParams }: { searchParams: Promise<{ view?: string; kid?: string; done?: string; item?: string }> }) {
  const sp = await searchParams;
  const ctx = await pageContext();
  const { kids } = ctx;
  const today = todayISO();
  const statuses = sp.done === "1" ? ["open", "waiting", "done"] : ["open", "waiting"];
  const all = (
    await listItems({ statuses, types: ["task", "event", "reminder"], from: addDaysISO(today, sp.done === "1" ? -30 : -60), to: addDaysISO(today, 120), includeUndated: true })
  )
    .filter((i) => !sp.kid || i.kidIds.includes(sp.kid))
    .sort(sortItems);
  const board = sp.view !== "list";

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ view: sp.view, kid: sp.kid, done: sp.done, ...patch }).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/teendok?${s}` : "/teendok";
  };

  const byDate = new Map<string, Item[]>();
  for (const i of all) {
    const key = !i.date ? "Dátum nélkül" : i.date < today ? "Lejárt" : i.date;
    byDate.set(key, [...(byDate.get(key) ?? []), i]);
  }

  return (
    <div className="rise">
      <PageHeader
        eyebrow="Teendők"
        title="Minden, ami rád vár"
        subtitle="Iskolai és otthoni teendők, emlékeztetők – egymás mellett vagy egy listában."
        actions={<NewItemButton kids={kids} />}
      />
      <div className="mb-5">
        <QuickAdd />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-surface p-1 ring-1 ring-line ring-inset">
          <Link href={link({ view: undefined })} className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", board ? "bg-ink text-surface" : "text-ink-2")}>
            <Columns3 className="h-4 w-4" /> Párhuzamos
          </Link>
          <Link href={link({ view: "list" })} className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", !board ? "bg-ink text-surface" : "text-ink-2")}>
            <List className="h-4 w-4" /> Idővonal
          </Link>
        </div>
        <span className="mx-1 h-5 w-px bg-line" />
        <Link href={link({ kid: undefined })} className={cx("rounded-full px-3 py-1 text-sm ring-1 ring-inset", !sp.kid ? "bg-ink text-surface ring-ink" : "ring-line text-ink-2")}>
          Mindenki
        </Link>
        {kids.map((k) => (
          <Link key={k.id} href={link({ kid: k.id })} className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-inset", sp.kid === k.id ? "bg-ink text-surface ring-ink" : "ring-line text-ink-2")}>
            <span className={cx("h-2 w-2 rounded-full", KID_STYLES[k.color].dot)} />
            {k.name}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <Link href={link({ done: sp.done === "1" ? undefined : "1" })} className="rounded-full px-3 py-1 text-sm text-ink-2 ring-1 ring-line ring-inset">
          {sp.done === "1" ? "Kész elrejtése" : "Kész mutatása"}
        </Link>
      </div>

      {all.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-7 w-7" />} title="Üres a lista">
          Rögzíts valamit fent, vagy várd meg a következő levél-szinkront.
        </EmptyState>
      ) : board ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {LANES.map((lane) => {
            const list = all.filter(lane.filter);
            return (
              <Card key={lane.key} className="flex max-h-[75vh] flex-col overflow-hidden">
                <div className={cx("border-b border-line bg-gradient-to-b to-transparent px-4 pb-3 pt-4", lane.tone)}>
                  <SectionTitle icon={lane.icon} className="mb-0" action={<span className="text-xs font-semibold text-muted">{list.length}</span>}>
                    {lane.title}
                  </SectionTitle>
                </div>
                <ul className="soft-scroll flex-1 overflow-y-auto p-1.5">
                  {list.length ? (
                    list.map((i) => <ItemRow key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} compact />)
                  ) : (
                    <li className="p-4 text-center text-sm text-muted">Nincs itt semmi.</li>
                  )}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byDate.entries())
            .sort(([a], [b]) => (a === "Lejárt" ? -1 : b === "Lejárt" ? 1 : a === "Dátum nélkül" ? 1 : b === "Dátum nélkül" ? -1 : a.localeCompare(b)))
            .map(([key, list]) => (
              <Card key={key} className="p-4">
                <SectionTitle>
                  {/^\d{4}/.test(key) ? (
                    <>
                      <span className="inline-block first-letter:uppercase">{huRelative(key, today)}</span>
                      <span className="font-normal normal-case tracking-normal text-muted">· {huDate(key, { weekday: true })}</span>
                    </>
                  ) : (
                    key
                  )}
                </SectionTitle>
                <ul className="-mx-2">
                  {list.map((i) => (
                    <ItemRow key={i.id} item={i} kids={kids} account={ctx.account} calendarEnabled={ctx.calendarEnabled} />
                  ))}
                </ul>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
