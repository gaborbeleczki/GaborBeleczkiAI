"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  Headphones,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  addPodcastToSpotify,
  approveItem,
  pushToCalendar,
  quickAdd,
  removeItem,
  saveItemForm,
  setStatus,
  snoozeToTomorrow,
  toggleDone,
} from "@/lib/actions";
import type { Kid } from "@/lib/family/types";
import { KID_STYLES, cx } from "@/lib/ui";

export type ItemLite = {
  id: string;
  type: string;
  area: string;
  title: string;
  details: string | null;
  kidIds: string[];
  category: string | null;
  subject: string | null;
  assessmentKind: string | null;
  topics: string | null;
  date: string | null;
  time: string | null;
  endDate: string | null;
  datePrecision: string;
  status: string;
  priority: string;
  amount: number | null;
  currency: string | null;
  payee: string | null;
  account: string | null;
  reference: string | null;
};

export function DoneCheckbox({ id, done, label, tone = "default" }: { id: string; done: boolean; label: string; tone?: "default" | "money" }) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(done);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={label}
      disabled={pending}
      onClick={() => {
        setOptimistic(!optimistic);
        start(() => toggleDone(id, !optimistic));
      }}
      className={cx(
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-all",
        optimistic
          ? tone === "money"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-ink-2 bg-ink-2 text-surface"
          : "border-line bg-surface hover:border-ink-2/60",
        pending && "opacity-60",
      )}
    >
      {optimistic && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  );
}

export function PaidToggle({ id, paid }: { id: string; paid: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState(paid);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setState(!state);
        start(() => toggleDone(id, !state));
      }}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        state
          ? "bg-emerald-500 text-white hover:bg-emerald-600"
          : "bg-surface text-ink-2 ring-1 ring-line ring-inset hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40",
      )}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      {state ? "Befizetve" : "Befizettem"}
    </button>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex max-w-full items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2 ring-1 ring-line ring-inset hover:text-ink"
      title={`${label} másolása`}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      <span className="truncate">{value}</span>
    </button>
  );
}

function MenuButton({ onClick, icon, children, danger }: { onClick: () => void; icon: ReactNode; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-2",
        danger ? "text-red-700 dark:text-red-300" : "text-ink-2",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function ItemMenu({ item, kids, calendarEnabled }: { item: ItemLite; kids: Kid[]; calendarEnabled: boolean }) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDetailsElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const run = (fn: () => Promise<unknown>) => {
    ref.current?.removeAttribute("open");
    start(async () => {
      await fn();
    });
  };
  return (
    <>
      <details ref={ref} className="relative">
        <summary
          className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink [&::-webkit-details-marker]:hidden"
          aria-label="Műveletek"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-line bg-surface p-1 shadow-lg">
          <MenuButton
            icon={<Pencil className="h-4 w-4" />}
            onClick={() => {
              ref.current?.removeAttribute("open");
              editor.current?.showModal();
            }}
          >
            Szerkesztés
          </MenuButton>
          {calendarEnabled && item.date && (
            <MenuButton icon={<CalendarPlus className="h-4 w-4" />} onClick={() => run(() => pushToCalendar(item.id))}>
              Naptárba tétel
            </MenuButton>
          )}
          <MenuButton icon={<Clock className="h-4 w-4" />} onClick={() => run(() => snoozeToTomorrow(item.id))}>
            Holnapra
          </MenuButton>
          <MenuButton icon={<Bell className="h-4 w-4" />} onClick={() => run(() => setStatus(item.id, item.status === "waiting" ? "open" : "waiting"))}>
            {item.status === "waiting" ? "Újra nyitott" : "Várakozik másra"}
          </MenuButton>
          <MenuButton icon={<X className="h-4 w-4" />} onClick={() => run(() => setStatus(item.id, "dismissed"))}>
            Nem releváns
          </MenuButton>
          <MenuButton icon={<Trash2 className="h-4 w-4" />} danger onClick={() => run(() => removeItem(item.id))}>
            Törlés
          </MenuButton>
        </div>
      </details>
      <ItemEditorDialog ref={editor} item={item} kids={kids} />
    </>
  );
}

const TYPE_OPTIONS = [
  ["task", "Teendő"],
  ["event", "Esemény"],
  ["reminder", "Emlékeztető"],
  ["assessment", "Számonkérés"],
  ["payment", "Befizetés (iskola)"],
  ["bill", "Számla"],
] as const;

const field = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-ink-2/40";

export function ItemEditorDialog({
  ref,
  item,
  kids,
  defaults,
}: {
  ref: React.Ref<HTMLDialogElement>;
  item?: ItemLite;
  kids: Kid[];
  defaults?: Partial<ItemLite>;
}) {
  const init = { ...defaults, ...item };
  const [type, setType] = useState(init.type ?? "task");
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  return (
    <dialog
      ref={(el) => {
        dialogRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.RefObject<HTMLDialogElement | null>).current = el;
      }}
      className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-3xl border border-line bg-surface p-0 text-ink shadow-2xl"
    >
      <form
        action={(fd) =>
          start(async () => {
            await saveItemForm(fd);
            dialogRef.current?.close();
          })
        }
        className="flex max-h-[85vh] flex-col"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-xl font-semibold">{item ? "Tétel szerkesztése" : "Új tétel"}</h3>
          <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full p-1.5 text-muted hover:bg-surface-2" aria-label="Bezárás">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="soft-scroll grid gap-3 overflow-y-auto px-5 py-4">
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="area" value={init.area ?? ""} />
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map(([v, l]) => (
              <label key={v} className={cx("cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", type === v ? "bg-ink text-surface ring-ink" : "ring-line text-ink-2")}>
                <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
          <input name="title" defaultValue={init.title ?? ""} required placeholder="Megnevezés" className={cx(field, "text-base font-medium")} />
          {kids.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {kids.map((k) => (
                <label key={k.id} className={cx("flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset has-[:checked]:ring-2", KID_STYLES[k.color].chip)}>
                  <input type="checkbox" name="kidIds" value={k.id} defaultChecked={init.kidIds?.includes(k.id)} className="accent-current" />
                  {k.name}
                </label>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="text-xs text-muted">
              Dátum
              <input type="date" name="date" defaultValue={init.date ?? ""} className={field} />
            </label>
            <label className="text-xs text-muted">
              Időpont
              <input type="time" name="time" defaultValue={init.time ?? ""} className={field} />
            </label>
            <label className="col-span-2 text-xs text-muted sm:col-span-1">
              Pontosság
              <select name="datePrecision" defaultValue={init.datePrecision ?? "exact"} className={field}>
                <option value="exact">Pontos nap</option>
                <option value="week">Csak a hét ismert</option>
                <option value="month">Csak a hónap</option>
              </select>
            </label>
          </div>
          {type === "assessment" && (
            <div className="grid grid-cols-2 gap-2">
              <input name="subject" defaultValue={init.subject ?? ""} placeholder="Tantárgy" className={field} />
              <select name="assessmentKind" defaultValue={init.assessmentKind ?? "dolgozat"} className={field}>
                <option value="dolgozat">Dolgozat</option>
                <option value="temazaro">Témazáró</option>
                <option value="beadando">Beadandó</option>
                <option value="felmeres">Felmérés</option>
                <option value="teszt">Teszt</option>
                <option value="szobeli">Szóbeli</option>
              </select>
              <input name="topics" defaultValue={init.topics ?? ""} placeholder="Miből kell készülni?" className={cx(field, "col-span-2")} />
            </div>
          )}
          {(type === "payment" || type === "bill") && (
            <div className="grid grid-cols-2 gap-2">
              <input name="amount" inputMode="decimal" defaultValue={init.amount ?? ""} placeholder="Összeg" className={field} />
              <select name="currency" defaultValue={init.currency ?? "HUF"} className={field}>
                <option value="HUF">Ft</option>
                <option value="EUR">EUR</option>
              </select>
              <input name="payee" defaultValue={init.payee ?? ""} placeholder="Kedvezményezett / szolgáltató" className={cx(field, "col-span-2")} />
              <input name="account" defaultValue={init.account ?? ""} placeholder="Számlaszám / link" className={field} />
              <input name="reference" defaultValue={init.reference ?? ""} placeholder="Közlemény" className={field} />
            </div>
          )}
          {type === "task" && (
            <select name="category" defaultValue={init.category ?? ""} className={field}>
              <option value="">Típus (nem kötelező)</option>
              <option value="bring">Bevinni az iskolába</option>
              <option value="prepare">Előkészíteni</option>
              <option value="practice">Gyakorolni</option>
              <option value="sign">Aláírni</option>
              <option value="buy">Megvenni</option>
              <option value="reply">Válaszolni</option>
              <option value="organize">Szervezni</option>
            </select>
          )}
          <textarea name="details" defaultValue={init.details ?? ""} rows={3} placeholder="Részletek" className={field} />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" name="priority" value="high" defaultChecked={init.priority === "high"} /> Fontos
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2">
            Mégse
          </button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface hover:opacity-90">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Mentés
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function NewItemButton({ kids, defaults, label = "Új tétel" }: { kids: Kid[]; defaults?: Partial<ItemLite>; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface shadow-sm hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        {label}
      </button>
      <ItemEditorDialog ref={ref} kids={kids} defaults={defaults} />
    </>
  );
}

export function QuickAdd({ placeholder = "Pl. „Lili péntekre vigyen tornacuccot” vagy „jövő kedden 17:00 fogorvos Bencével”" }: { placeholder?: string }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = text;
        start(async () => {
          const r = await quickAdd(t);
          if (r.ok) {
            setText("");
            setMsg(r.message ?? `${r.count} tétel hozzáadva.`);
          } else setMsg(r.message ?? "Nem sikerült.");
          setTimeout(() => setMsg(null), 4000);
        });
      }}
      className="card flex flex-col gap-2 p-3"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-accent" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-muted"
          aria-label="Gyors rögzítés"
        />
        <button type="submit" disabled={pending || !text.trim()} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Rögzít
        </button>
      </div>
      {msg && <p className="px-6 text-xs text-muted">{msg}</p>}
    </form>
  );
}

export function SyncButton({ label = "Szinkron", endpoint = "/api/sync", compact }: { label?: string; endpoint?: string; compact?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [info, setInfo] = useState<string>("");
  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        try {
          const res = await fetch(endpoint, { method: "POST" });
          const json = await res.json();
          if (!res.ok || json.ok === false) throw new Error(json.error ?? "Hiba");
          if (json.locked) setInfo("Már fut egy szinkron");
          else if (json.created != null) setInfo(`${json.created} új, ${json.updated} frissítve`);
          else setInfo("Kész");
          setState(json.errors?.length ? "error" : "done");
          router.refresh();
        } catch (e) {
          setInfo((e as Error).message);
          setState("error");
        }
        setTimeout(() => setState("idle"), 5000);
      }}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium ring-1 ring-inset transition-colors",
        state === "error" ? "bg-red-50 text-red-800 ring-red-200" : "bg-surface text-ink-2 ring-line hover:bg-surface-2",
      )}
      title={info}
    >
      <RefreshCw className={cx("h-4 w-4", state === "busy" && "animate-spin")} />
      {!compact && (state === "idle" ? label : state === "busy" ? "Dolgozom…" : info || label)}
    </button>
  );
}

export function ReviewButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => approveItem(id))}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        <Check className="h-3.5 w-3.5" /> Rendben
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setStatus(id, "dismissed"))}
        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-line ring-inset hover:bg-surface-2"
      >
        <X className="h-3.5 w-3.5" /> Elvetem
      </button>
    </div>
  );
}

export function SpotifyButton({ id, added, fallbackUrl, enabled }: { id: string; added: boolean; fallbackUrl: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(added);
  if (!enabled) {
    return (
      <a href={fallbackUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#1DB954] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
        <Headphones className="h-3.5 w-3.5" /> Megnyitás Spotify-ban
      </a>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || done}
        onClick={() =>
          start(async () => {
            const r = await addPodcastToSpotify(id);
            setMsg(r.message);
            if (r.ok) setDone(true);
          })
        }
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white",
          done ? "bg-emerald-600" : "bg-[#1DB954] hover:opacity-90",
        )}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />}
        {done ? "A listán" : "Spotify listához"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}

export function StatusButton({ id, status, children, className }: { id: string; status: "open" | "waiting" | "done" | "dismissed"; children: ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => setStatus(id, status))} className={className}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}
