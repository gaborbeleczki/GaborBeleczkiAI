"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarPlus, Check, Clock, Mail, PartyPopper, Quote, Star, Undo2, Wallet, X } from "lucide-react";
import { triageItem, undoTriage, type TriageSnapshot } from "@/lib/actions";
import type { TriageAction } from "@/lib/attention";
import type { KidColor } from "@/lib/family/types";
import { KID_STYLES, cx } from "@/lib/ui";

export type DeckKid = { id: string; name: string; color: KidColor };

export type SwipeCard = {
  id: string;
  type: string;
  typeLabel: string;
  typeChip: string;
  title: string;
  details: string | null;
  topics: string | null;
  kidIds: string[];
  subject: string | null;
  when: string | null;
  reason: string;
  urgent: boolean;
  amount: string | null;
  payee: string | null;
  quote: string | null;
  contact: string | null;
  mailUrl: string | null;
  needsReview: boolean;
  primary: { action: TriageAction; label: string };
};

type Dir = "right" | "left" | "up" | "down";
const THRESHOLD = 110;

function actionFor(card: SwipeCard, dir: Dir): { action: TriageAction; label: string } {
  if (dir === "right") return card.primary;
  if (dir === "left") return { action: "dismiss", label: "Elvetem" };
  if (dir === "up") return { action: "star", label: "Fontos" };
  return { action: "later", label: "Később" };
}

function PrimaryIcon({ action, className }: { action: TriageAction; className?: string }) {
  if (action === "paid") return <Wallet className={className} />;
  if (action === "calendar") return <CalendarPlus className={className} />;
  return <Check className={className} />;
}

const DIR_STYLE: Record<Dir, { glow: string; stamp: string; pos: string }> = {
  right: { glow: "shadow-[0_0_80px_-10px_rgba(16,185,129,0.85)]", stamp: "border-emerald-500 text-emerald-600", pos: "left-5 top-6 -rotate-12" },
  left: { glow: "shadow-[0_0_80px_-10px_rgba(244,63,94,0.85)]", stamp: "border-rose-500 text-rose-600", pos: "right-5 top-6 rotate-12" },
  up: { glow: "shadow-[0_0_80px_-10px_rgba(245,158,11,0.9)]", stamp: "border-amber-500 text-amber-600", pos: "bottom-24 left-1/2 -translate-x-1/2" },
  down: { glow: "shadow-[0_0_80px_-10px_rgba(56,189,248,0.85)]", stamp: "border-sky-500 text-sky-600", pos: "left-1/2 top-6 -translate-x-1/2" },
};

export function SwipeDeck({ cards, kids, total }: { cards: SwipeCard[]; kids: DeckKid[]; total: number }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [front, setFront] = useState<string | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exit, setExit] = useState<{ id: string; dir: Dir } | null>(null);
  const [toast, setToast] = useState<{ id: string; label: string; snapshot?: TriageSnapshot; message?: string } | null>(null);
  const [, start] = useTransition();
  const origin = useRef<{ x: number; y: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => {
    const list = cards.filter((c) => !gone.has(c.id));
    if (front) {
      const i = list.findIndex((c) => c.id === front);
      if (i > 0) list.unshift(...list.splice(i, 1));
    }
    return list;
  }, [cards, gone, front]);
  const top = visible[0];
  const [deckTotal] = useState(total);
  const done = Math.max(0, deckTotal - visible.length);

  const showToast = useCallback((t: NonNullable<typeof toast>) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  }, []);

  const commit = useCallback(
    (card: SwipeCard, dir: Dir) => {
      const { action, label } = actionFor(card, dir);
      setGone((g) => new Set(g).add(card.id));
      setFront((f) => (f === card.id ? null : f));
      setExit(null);
      setDrag({ x: 0, y: 0, active: false });
      showToast({ id: card.id, label: `${label}: ${card.title}` });
      start(async () => {
        const res = await triageItem(card.id, action);
        if (!res.ok) {
          setGone((g) => {
            const n = new Set(g);
            n.delete(card.id);
            return n;
          });
          showToast({ id: card.id, label: res.message ?? "Nem sikerült menteni." });
          return;
        }
        showToast({ id: card.id, label: `${label}: ${card.title}`, snapshot: res.snapshot, message: res.message });
      });
    },
    [showToast],
  );

  const fling = useCallback(
    (dir: Dir) => {
      if (!top || exit) return;
      const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return commit(top, dir);
      setExit({ id: top.id, dir });
      setTimeout(() => commit(top, dir), 280);
    },
    [top, exit, commit],
  );

  const undo = useCallback(() => {
    if (!toast?.snapshot) return;
    const { id, snapshot } = toast;
    setToast(null);
    setGone((g) => {
      const n = new Set(g);
      n.delete(id);
      return n;
    });
    setFront(id);
    start(async () => {
      await undoTriage(id, snapshot);
    });
  }, [toast]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Arrow keys work while the deck (or one of its buttons) has focus, so normal page scrolling is untouched.
  const onKeyDown = (e: import("react").KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const map: Record<string, Dir> = { ArrowRight: "right", ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down" };
    if (map[e.key] && top) {
      e.preventDefault();
      fling(map[e.key]);
    } else if (e.key.toLowerCase() === "z" && toast?.snapshot) {
      undo();
    }
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    origin.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    setDrag({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y, active: true });
  };
  const onUp = () => {
    if (!origin.current) return;
    origin.current = null;
    const { x, y } = drag;
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (ax > THRESHOLD && ax >= ay) return fling(x > 0 ? "right" : "left");
    if (ay > THRESHOLD && ay > ax) return fling(y < 0 ? "up" : "down");
    setDrag({ x: 0, y: 0, active: false });
  };

  const liveDir: Dir | null = (() => {
    if (exit) return exit.dir;
    const ax = Math.abs(drag.x);
    const ay = Math.abs(drag.y);
    if (Math.max(ax, ay) < 24) return null;
    if (ax >= ay) return drag.x > 0 ? "right" : "left";
    return drag.y < 0 ? "up" : "down";
  })();
  const progress = exit ? 1 : Math.min(1, Math.max(Math.abs(drag.x), Math.abs(drag.y)) / THRESHOLD);

  if (!top) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center">
        <PartyPopper className="h-10 w-10 text-amber-300" />
        <p className="font-display text-2xl font-semibold">Minden átnézve</p>
        <p className="max-w-xs text-sm text-white/60">A reggeli szkennelés összes új tételéről döntöttél. Holnap reggel jönnek a következők.</p>
        {toast?.snapshot && (
          <button onClick={undo} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
            <Undo2 className="h-4 w-4" /> Visszavonás
          </button>
        )}
      </div>
    );
  }

  const exitTransform = exit
    ? { right: "translate(140%, 10%) rotate(28deg)", left: "translate(-140%, 10%) rotate(-28deg)", up: "translate(0, -130%) scale(0.9)", down: "translate(0, 130%) scale(0.9)" }[exit.dir]
    : null;

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Reggeli szkennelés kártyái – nyilakkal is dönthetsz"
      className="flex flex-col items-center rounded-[32px] outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      <div className="mb-3 flex w-full max-w-[440px] items-center justify-between text-xs text-white/60">
        <span>
          <span className="font-semibold text-white">{done + 1}</span> / {total}
        </span>
        <div className="mx-3 h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-rose-400 to-violet-400 transition-all duration-500" style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
        </div>
        <span>{visible.length} hátra</span>
      </div>

      <div className="relative h-[400px] w-full max-w-[440px] [perspective:1200px] sm:h-[460px]">
        {visible
          .slice(0, 3)
          .reverse()
          .map((card) => {
            const depth = visible.indexOf(card);
            const isTop = depth === 0;
            const style = isTop
              ? {
                  transform: exitTransform ?? `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 16}deg)`,
                  transition: drag.active && !exit ? "none" : "transform 0.3s cubic-bezier(.2,.8,.2,1), opacity 0.3s",
                  opacity: exit ? 0 : 1,
                }
              : {
                  transform: `translateY(${depth * 16 + (progress * -8 * depth)}px) scale(${1 - depth * 0.05 + progress * 0.025 * depth})`,
                  transition: "transform 0.3s ease",
                  opacity: depth === 1 ? 0.85 : 0.55,
                };
            return (
              <div
                key={card.id}
                className={cx(
                  "absolute inset-0 select-none touch-none",
                  isTop ? "z-30 cursor-grab active:cursor-grabbing" : depth === 1 ? "z-20" : "z-10",
                )}
                style={style}
                onPointerDown={isTop ? onDown : undefined}
                onPointerMove={isTop ? onMove : undefined}
                onPointerUp={isTop ? onUp : undefined}
                onPointerCancel={isTop ? onUp : undefined}
                aria-hidden={!isTop}
              >
                <CardFace card={card} kids={kids} glow={isTop && liveDir ? DIR_STYLE[liveDir].glow : ""} />
                {isTop && liveDir && (
                  <span
                    className={cx(
                      "pointer-events-none absolute rounded-xl border-4 bg-white/90 px-3 py-1 font-display text-2xl font-bold uppercase tracking-wider",
                      DIR_STYLE[liveDir].stamp,
                      DIR_STYLE[liveDir].pos,
                    )}
                    style={{ opacity: progress }}
                  >
                    {actionFor(card, liveDir).label}
                  </span>
                )}
              </div>
            );
          })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
        <DeckButton label="Elvetem" hint="←" onClick={() => fling("left")} className="h-14 w-14 bg-white/10 text-rose-300 hover:bg-rose-500 hover:text-white">
          <X className="h-6 w-6" />
        </DeckButton>
        <DeckButton label="Később (holnap újra)" hint="↓" onClick={() => fling("down")} className="h-11 w-11 bg-white/10 text-sky-300 hover:bg-sky-500 hover:text-white">
          <Clock className="h-5 w-5" />
        </DeckButton>
        <DeckButton label="Fontos" hint="↑" onClick={() => fling("up")} className="h-11 w-11 bg-white/10 text-amber-300 hover:bg-amber-500 hover:text-white">
          <Star className="h-5 w-5" />
        </DeckButton>
        <DeckButton label={top.primary.label} hint="→" onClick={() => fling("right")} className="h-14 w-14 bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-400">
          <PrimaryIcon action={top.primary.action} className="h-6 w-6" />
        </DeckButton>
      </div>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/45">
        <span className="inline-flex items-center gap-1"><ArrowRight className="h-3 w-3" /> {top.primary.label}</span>
        <span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> elvetem</span>
        <span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /> fontos</span>
        <span className="inline-flex items-center gap-1"><ArrowDown className="h-3 w-3" /> később</span>
        <span className="hidden sm:inline">· kattints a paklira, és a nyilakkal is mehet (Z = vissza)</span>
      </p>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        {toast && (
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-stone-900/95 py-2 pl-4 pr-2 text-sm text-white shadow-2xl ring-1 ring-white/10">
            <span className="min-w-0 truncate">{toast.message ?? toast.label}</span>
            {toast.snapshot && (
              <button onClick={undo} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-medium hover:bg-white/25">
                <Undo2 className="h-3.5 w-3.5" /> Vissza
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DeckButton({ children, label, hint, onClick, className }: { children: ReactNode; label: string; hint: string; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (${hint})`}
      aria-label={label}
      className={cx("grid place-items-center rounded-full ring-1 ring-white/15 backdrop-blur transition-all duration-200 hover:scale-110 active:scale-95", className)}
    >
      {children}
    </button>
  );
}

/** Cards are always light, so drop the dark-mode variants of shared chip styles. */
const light = (cls: string) => cls.split(" ").filter((c) => !c.startsWith("dark:")).join(" ");

function CardFace({ card, kids, glow }: { card: SwipeCard; kids: DeckKid[]; glow: string }) {
  const cardKids = card.kidIds.map((id) => kids.find((k) => k.id === id)).filter(Boolean) as DeckKid[];
  const band = cardKids[0] ? KID_STYLES[cardKids[0].color].band : "bg-gradient-to-r from-amber-400 to-rose-400";
  return (
    <article
      className={cx(
        "relative flex h-full flex-col overflow-hidden rounded-[28px] bg-gradient-to-b from-white to-stone-100 p-6 text-stone-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-black/5 transition-shadow dark:from-stone-50 dark:to-stone-200",
        glow,
      )}
    >
      <span className={cx("absolute inset-x-0 top-0 h-1.5", band)} />
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx("rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", light(card.typeChip))}>{card.typeLabel}</span>
        {cardKids.map((k) => (
          <span key={k.id} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", light(KID_STYLES[k.color].chip))}>
            {k.name}
          </span>
        ))}
        {card.needsReview && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">átnézendő</span>}
        {card.reason && (
          <span className={cx("ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", card.urgent ? "bg-rose-600 text-white" : "bg-stone-200 text-stone-700")}>
            {card.reason}
          </span>
        )}
      </div>

      <h3 className="mt-4 font-display text-[26px] font-semibold leading-[1.1] tracking-tight text-balance">{card.title}</h3>
      {card.when && <p className="mt-2 text-sm font-medium text-stone-600">{card.when}</p>}
      {(card.amount || card.payee) && (
        <p className="mt-2 flex items-baseline gap-2">
          {card.amount && <span className="font-display text-3xl font-semibold tabular-nums">{card.amount}</span>}
          {card.payee && <span className="truncate text-sm text-stone-500">{card.payee}</span>}
        </p>
      )}
      {(card.topics || card.details) && <p className="mt-3 line-clamp-3 text-sm leading-snug text-stone-600">{card.topics ?? card.details}</p>}

      <div className="mt-auto pt-4">
        {card.quote && (
          <figure className="rounded-2xl bg-stone-900/[0.04] p-4 ring-1 ring-stone-900/5">
            <Quote className="mb-1 h-4 w-4 text-stone-400" />
            <blockquote className="line-clamp-4 font-display text-[15px] italic leading-snug text-stone-700">„{card.quote}”</blockquote>
            <figcaption className="mt-2 flex items-center justify-between gap-2 text-xs text-stone-500">
              <span className="truncate">— {card.contact ?? "levél"}</span>
              {card.mailUrl && (
                <a href={card.mailUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-medium text-stone-700 hover:text-stone-950">
                  <Mail className="h-3.5 w-3.5" /> levél
                </a>
              )}
            </figcaption>
          </figure>
        )}
      </div>
    </article>
  );
}
