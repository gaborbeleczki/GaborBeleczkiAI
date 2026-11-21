"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { retryEmail } from "@/lib/actions";

export function RetryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => retryEmail(id))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
      <RotateCcw className="h-3.5 w-3.5" /> újra
    </button>
  );
}
