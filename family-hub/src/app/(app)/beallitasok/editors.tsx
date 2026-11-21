"use client";

import { useState, useTransition } from "react";
import { CalendarSync, Loader2, Save, Unplug } from "lucide-react";
import { disconnect, resyncCalendarAll, saveAiNotes, saveFamilyJson } from "@/lib/actions";

export function FamilyJsonEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        rows={18}
        className="soft-scroll w-full rounded-2xl border border-line bg-surface-2 p-3 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-ink-2/40"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setMsg(await saveFamilyJson(value).then((r) => ({ ok: r.ok, text: r.message }))))}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Mentés
        </button>
        {msg && <span className={msg.ok ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-red-700 dark:text-red-300"}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function AiNotesEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={5}
        placeholder="Pl.: Kovács Éva továbbítja Nagy Péter angolos leveleit Bencének; Lili Pétertől közvetlenül kapja. Az SZMK-s pénzkérések mindig gyerekenként értendők."
        className="w-full rounded-2xl border border-line bg-surface-2 p-3 text-sm text-ink outline-none focus:border-ink-2/40"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await saveAiNotes(value);
            setSaved(true);
          })
        }
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line ring-inset hover:bg-surface-2"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saved ? "Mentve" : "Megjegyzések mentése"}
      </button>
    </div>
  );
}

export function DisconnectButton({ provider }: { provider: "google" | "spotify" }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Biztosan bontod a kapcsolatot?")) start(() => disconnect(provider));
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 ring-inset hover:bg-red-50 dark:text-red-300 dark:ring-red-900"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />} Leválasztás
    </button>
  );
}

export function ResyncCalendarButton() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await resyncCalendarAll();
          setDone(true);
        })
      }
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium ring-1 ring-line ring-inset hover:bg-surface-2"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSync className="h-4 w-4" />} {done ? "Naptár frissítve" : "Naptár újraépítése"}
    </button>
  );
}
