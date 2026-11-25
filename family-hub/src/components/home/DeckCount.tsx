"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Shares the deck's live "cards left" number with the hero headline, so both always agree. */
const Ctx = createContext<{ remaining: number; setRemaining: (n: number) => void } | null>(null);

export function DeckCountProvider({ initial, children }: { initial: number; children: ReactNode }) {
  const [remaining, setRemaining] = useState(initial);
  return <Ctx.Provider value={{ remaining, setRemaining }}>{children}</Ctx.Provider>;
}

export function useDeckCount() {
  return useContext(Ctx);
}

export function DeckHeadline() {
  const ctx = useContext(Ctx);
  const n = ctx?.remaining ?? 0;
  if (!n) return <>Minden friss tételről döntöttél</>;
  return (
    <>
      <span className="bg-gradient-to-r from-amber-200 via-rose-200 to-violet-200 bg-clip-text text-transparent tabular-nums">{n}</span>{" "}
      új dolog vár a döntésedre
    </>
  );
}
