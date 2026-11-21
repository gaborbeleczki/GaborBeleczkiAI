"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  GraduationCap,
  Inbox,
  ListChecks,
  Menu,
  Newspaper,
  NotebookPen,
  PiggyBank,
  Receipt,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";
import { cx } from "@/lib/ui";

export const NAV = [
  { href: "/", label: "Ma", icon: Sun },
  { href: "/napi", label: "Napi összefoglaló", icon: Newspaper },
  { href: "/iskola", label: "Iskola", icon: GraduationCap },
  { href: "/szamonkeresek", label: "Számonkérések", icon: NotebookPen },
  { href: "/teendok", label: "Teendők", icon: ListChecks },
  { href: "/naptar", label: "Naptár", icon: CalendarDays },
  { href: "/befizetesek", label: "Befizetések", icon: PiggyBank },
  { href: "/szamlak", label: "Számlák", icon: Receipt },
  { href: "/atnezendo", label: "Átnézendő", icon: Inbox, badgeKey: "review" as const },
  { href: "/beallitasok", label: "Beállítások", icon: Settings },
];

const MOBILE = ["/", "/iskola", "/teendok", "/befizetesek"];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Sidebar({ reviewCount, kids, user }: { reviewCount: number; kids: { id: string; name: string; dot: string }[]; user: { name: string; email: string } }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/70 px-4 py-6 backdrop-blur lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-lg text-white shadow-sm">🏡</span>
        <span className="font-display text-xl font-semibold leading-none text-ink">
          Családi <span className="italic text-accent">Hub</span>
        </span>
      </Link>
      <nav className="soft-scroll -mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
        {NAV.map((n) => {
          const active = isActive(path, n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors",
                active ? "bg-ink text-surface shadow-sm" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{n.label}</span>
              {n.badgeKey === "review" && reviewCount > 0 && (
                <span className={cx("rounded-full px-1.5 text-[11px] font-bold", active ? "bg-surface text-ink" : "bg-accent text-white")}>{reviewCount}</span>
              )}
            </Link>
          );
        })}
      </nav>
      {kids.length > 0 && (
        <div className="mt-4 rounded-2xl bg-surface-2 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Gyerekek</p>
          <div className="flex flex-col gap-1.5">
            {kids.map((k) => (
              <Link key={k.id} href={`/iskola?kid=${k.id}`} className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
                <span className={cx("h-2.5 w-2.5 rounded-full", k.dot)} />
                {k.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center gap-2 px-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{user.name.slice(0, 1)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-[11px] text-muted">{user.email}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink" title="Kijelentkezés">
            Ki
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav({ reviewCount }: { reviewCount: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white">🏡</span>
          <span className="font-display text-lg font-semibold">
            Családi <span className="italic text-accent">Hub</span>
          </span>
        </Link>
        <button onClick={() => setOpen(true)} className="relative rounded-full p-2 text-ink-2 hover:bg-surface" aria-label="Menü">
          <Menu className="h-5 w-5" />
          {reviewCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-72 bg-surface p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex justify-end">
              <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-surface-2" aria-label="Bezárás">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]", isActive(path, n.href) ? "bg-ink text-surface" : "text-ink-2")}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{n.label}</span>
                    {n.badgeKey === "review" && reviewCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{reviewCount}</span>}
                  </Link>
                );
              })}
            </nav>
            <form action="/api/auth/logout" method="post" className="mt-6 border-t border-line pt-4">
              <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-surface-2">Kijelentkezés</button>
            </form>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => {
          const Icon = n.icon;
          const active = isActive(path, n.href);
          return (
            <Link key={n.href} href={n.href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-accent" : "text-muted")}>
              <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
