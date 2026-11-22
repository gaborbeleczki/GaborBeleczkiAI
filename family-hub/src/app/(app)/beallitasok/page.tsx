import { desc } from "drizzle-orm";
import { Bot, CalendarDays, Database, Headphones, Lock, Mail, ShieldCheck, Users } from "lucide-react";
import { Banner, Card, KidChip, PageHeader, Pill, SectionTitle } from "@/components/ui/primitives";
import { SyncButton } from "@/components/items/client";
import { AiNotesEditor, DisconnectButton, FamilyJsonEditor, ResyncCalendarButton } from "./editors";
import { pageContext } from "@/lib/page-context";
import { savePreferencesForm } from "@/lib/actions";
import { aiConfigured } from "@/lib/ai/client";
import { listCalendars, type CalendarListEntry } from "@/lib/google/calendar";
import { dbMode, getDb, schema } from "@/lib/db";
import { env, googleLoginConfigured } from "@/lib/env";
import { spotifyStatus } from "@/lib/spotify";
import { lastSyncInfo } from "@/lib/sync/run";
import { parseAllowlist } from "@/lib/auth/allowlist";

export const metadata = { title: "Beállítások" };

const ERRORS: Record<string, string> = {
  wrong_mailbox: "Ezzel a fiókkal nem lehet a postafiókot összekötni – a MAILBOX_OWNER_EMAIL fiókjával jelentkezz be.",
  missing_scopes: "A Google-engedélyezésnél minden jogosultságot (Gmail olvasás, Naptár) be kell pipálni.",
  spotify_not_configured: "A Spotify-hoz SPOTIFY_CLIENT_ID és SPOTIFY_CLIENT_SECRET szükséges.",
  spotify_state: "A Spotify-bejelentkezés lejárt, próbáld újra.",
  spotify_failed: "Nem sikerült a Spotify-összekapcsolás.",
};

const ROLE_LABEL: Record<string, string> = {
  class_teacher: "osztályfőnök / tanító",
  subject_teacher: "szaktanár",
  school_admin: "iskola",
  parents_group: "szülői csoport",
  treasurer: "pénztáros",
  club: "különóra / klub",
  family: "család",
  other: "egyéb",
};

const field = "rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-ink-2/40";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string; welcome?: string }> }) {
  const sp = await searchParams;
  const ctx = await pageContext();
  const { family, prefs, google } = ctx;
  const [spotify, sync] = await Promise.all([spotifyStatus(), lastSyncInfo()]);
  let calendars: CalendarListEntry[] = [];
  if (google.hasCalendar) calendars = await listCalendars().catch(() => []);
  const db = await getDb();
  const runs = await db.select().from(schema.syncRuns).orderBy(desc(schema.syncRuns.id)).limit(8);
  const familyJson = JSON.stringify({ ...family, aiNotes: undefined }, null, 2);

  return (
    <div className="rise">
      <PageHeader eyebrow="Beállítások" title="Kapcsolatok, család, naptár" />

      {sp.welcome && (
        <Banner tone="info">
          Üdv! Első lépésként kösd össze a Gmailt és a Naptárt (lent), majd töltsd ki a Család részt a gyerekekkel és a tanárok címeivel.
        </Banner>
      )}
      {sp.connected === "google" && <Banner tone="ok">A Gmail és a Google Naptár összekapcsolva. Az első szinkron az elmúlt {prefs.initialSyncDays} nap leveleit dolgozza fel.</Banner>}
      {sp.connected === "spotify" && <Banner tone="ok">Spotify összekapcsolva.</Banner>}
      {sp.error && <Banner tone="error">{ERRORS[sp.error] ?? "Hiba történt."}</Banner>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={<Mail className="h-4 w-4" />}>Gmail + Google Naptár</SectionTitle>
          {google.connected ? (
            <div className="space-y-3">
              <p className="text-sm">
                Összekapcsolva: <span className="font-semibold">{google.account}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Pill tone={google.hasGmail ? "emerald" : "red"}>Gmail olvasás</Pill>
                <Pill tone={google.hasCalendar ? "emerald" : "red"}>Naptár írás</Pill>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/api/auth/google/start?mode=connect" className="rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-line ring-inset hover:bg-surface-2">
                  Újra-engedélyezés
                </a>
                <DisconnectButton provider="google" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Csak olvasási jogot kérünk a Gmailhez; a naptárba a Family Hub saját, megjelölt eseményeket ír. {env.mailboxOwner && <>Fiók: <b>{env.mailboxOwner}</b></>}
              </p>
              {googleLoginConfigured() ? (
                <a href="/api/auth/google/start?mode=connect" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface">
                  Gmail és Naptár összekapcsolása
                </a>
              ) : (
                <Pill tone="amber">Előbb állítsd be a GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET változókat</Pill>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle icon={<Headphones className="h-4 w-4" />}>Spotify</SectionTitle>
          {!spotify.configured ? (
            <p className="text-sm text-muted">Nincs beállítva (SPOTIFY_CLIENT_ID / SECRET). A podcastok „Megnyitás Spotify-ban” linkkel így is elérhetők.</p>
          ) : spotify.connected ? (
            <div className="space-y-3">
              <p className="text-sm">
                Összekapcsolva: <span className="font-semibold">{spotify.account}</span>
              </p>
              <form action={savePreferencesForm} className="flex flex-wrap items-center gap-2">
                <input name="spotifyPlaylistId" defaultValue={prefs.spotifyPlaylistId} placeholder="Lejátszási lista link (üresen: létrehozzuk)" className={`${field} min-w-0 flex-1`} />
                <button className="rounded-full px-3 py-2 text-xs font-semibold ring-1 ring-line ring-inset hover:bg-surface-2">Mentés</button>
              </form>
              <DisconnectButton provider="spotify" />
            </div>
          ) : (
            <a href="/api/spotify/start" className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-4 py-2 text-sm font-semibold text-white">
              Spotify összekapcsolása
            </a>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle icon={<Bot className="h-4 w-4" />}>AI és adatbázis</SectionTitle>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>Claude API</span>
              {aiConfigured() ? <Pill tone="emerald">{env.anthropicModel}</Pill> : <Pill tone="sky">kikapcsolva – szabályalapú feldolgozás</Pill>}
            </li>
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="h-4 w-4 text-muted" /> Adatbázis
              </span>
              <Pill tone={dbMode() === "postgres" ? "emerald" : dbMode() === "ephemeral" ? "red" : "amber"}>
                {dbMode() === "postgres" ? "Postgres" : dbMode() === "ephemeral" ? "ideiglenes (teszt)" : "helyi PGlite (fejlesztés)"}
              </Pill>
            </li>
            <li className="flex items-center justify-between">
              <span>Időzített futás (cron)</span>
              <Pill tone={env.cronSecret ? "emerald" : "amber"}>{env.cronSecret ? "beállítva" : "CRON_SECRET hiányzik"}</Pill>
            </li>
          </ul>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={<ShieldCheck className="h-4 w-4" />}>Hozzáférés</SectionTitle>
          <p className="mb-2 text-sm text-muted">Csak ezek a Google-fiókok léphetnek be (ALLOWED_EMAILS):</p>
          <ul className="mb-3 flex flex-wrap gap-2">
            {parseAllowlist(process.env.ALLOWED_EMAILS).map((e) => (
              <li key={e}>
                <Pill tone="stone">
                  <Lock className="h-3 w-3" /> {e}
                </Pill>
              </li>
            ))}
          </ul>
          <p className="mb-2 text-sm text-muted">
            Belépési módok: {googleLoginConfigured() ? "Google-fiók" : "Google-belépés még nincs beállítva"}
            {env.appPassword ? " · családi jelszó (APP_PASSWORD)" : ""}
          </p>
          <p className="text-xs text-muted">
            Minden oldal és API bejelentkezéshez kötött, a tokenek titkosítva tárolódnak, a keresőmotorok ki vannak zárva. Javasolt: Vercel Deployment Protection is.
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <SectionTitle icon={<CalendarDays className="h-4 w-4" />} action={google.connected ? <div className="flex gap-2">{google.hasGmail && <SyncButton label="Levelek szinkronja" />}{google.hasCalendar && <ResyncCalendarButton />}</div> : undefined}>
          Szinkron és naptár
        </SectionTitle>
        {sync && (
          <p className="mb-4 text-sm text-muted">
            Utolsó levél-szinkron: {new Date(sync.at).toLocaleString("hu-HU", { timeZone: "Europe/Budapest" })} — {sync.stats.fresh} új levél, {sync.stats.extracted} iskolai/pénzügyi,{" "}
            {sync.stats.triaged} egyéb feldolgozva, {sync.stats.created} új tétel, {sync.stats.calendar} naptárbejegyzés.
            {sync.stats.remaining > 0 && <> Még {sync.stats.remaining} levél vár a következő körre.</>}
            {sync.stats.errors.length > 0 && <span className="text-red-700 dark:text-red-300"> {sync.stats.errors.length} hiba.</span>}
          </p>
        )}
        <form action={savePreferencesForm} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="readCalendarIdsPresent" value="1" />
          <input type="hidden" name="autoCalendarPresent" value="1" />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Ebbe a naptárba írjon</span>
            <select name="calendarId" defaultValue={prefs.calendarId} className={field}>
              <option value="primary">Elsődleges naptár</option>
              {calendars
                .filter((c) => c.accessRole === "owner" || c.accessRole === "writer")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                  </option>
                ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Szabad idő számításához figyelt naptárak</span>
            <div className="flex flex-wrap gap-2">
              {(calendars.length ? calendars : [{ id: "primary", summary: "Elsődleges" } as CalendarListEntry]).map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-line ring-inset">
                  <input type="checkbox" name="readCalendarIds" value={c.id} defaultChecked={prefs.readCalendarIds.includes(c.id) || (c.primary && prefs.readCalendarIds.includes("primary"))} />
                  {c.summary}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="autoCalendar" defaultChecked={prefs.autoCalendar} />
            Biztos tételek automatikusan a naptárba (időblokkokkal)
          </label>
          <label className="flex items-center gap-2 text-sm">
            Gyakorlóblokk hossza
            <input name="studyBlockMinutes" type="number" min={10} max={120} defaultValue={prefs.studyBlockMinutes} className={`${field} w-20`} /> perc
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Tanulási idősáv hétköznap</span>
            <input type="time" name="studyWindowWeekdayFrom" defaultValue={prefs.studyWindowWeekday[0]} className={field} />–
            <input type="time" name="studyWindowWeekdayTo" defaultValue={prefs.studyWindowWeekday[1]} className={field} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>hétvégén</span>
            <input type="time" name="studyWindowWeekendFrom" defaultValue={prefs.studyWindowWeekend[0]} className={field} />–
            <input type="time" name="studyWindowWeekendTo" defaultValue={prefs.studyWindowWeekend[1]} className={field} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            Esti bepakolás emlékeztető
            <input type="time" name="eveningPrepTime" defaultValue={prefs.eveningPrepTime} className={field} />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface">Naptár-beállítások mentése</button>
          </div>
        </form>
        {runs.length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted">Futásnapló</summary>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted">
              {runs.map((r) => (
                <li key={r.id}>
                  {r.startedAt.toLocaleString("hu-HU", { timeZone: "Europe/Budapest" })} · {r.kind}/{r.trigger} · {r.status}
                  {r.error ? ` · ${r.error.slice(0, 120)}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Card className="mt-6 p-5" as="section">
        <div id="csalad" />
        <SectionTitle icon={<Users className="h-4 w-4" />}>Család</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Gyerekek</p>
              <div className="flex flex-wrap gap-2">
                {family.kids.length ? (
                  family.kids.map((k) => (
                    <div key={k.id} className="rounded-2xl bg-surface-2 p-3 ring-1 ring-line ring-inset">
                      <KidChip kid={k} size="md" />
                      <p className="mt-1 text-xs text-muted">
                        {k.className ?? "—"} {k.school ? `· ${k.school}` : ""}
                      </p>
                      {k.classGroupEmails.length > 0 && <p className="mt-0.5 text-[11px] text-muted">{k.classGroupEmails.join(", ")}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">Még nincs gyerek megadva – szerkeszd a JSON-t jobbra.</p>
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Tanárok és feladók</p>
              <ul className="divide-y divide-line rounded-2xl bg-surface-2 px-3 ring-1 ring-line ring-inset">
                {family.contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium">{c.name}</span> <span className="text-xs text-muted">{ROLE_LABEL[c.role] ?? c.role}{c.subject ? ` · ${c.subject}` : ""}</span>
                    </span>
                    <span className="flex gap-1">
                      {c.kidIds.map((id) => {
                        const k = family.kids.find((x) => x.id === id);
                        return k ? <KidChip key={id} kid={k} /> : null;
                      })}
                    </span>
                  </li>
                ))}
                {!family.contacts.length && <li className="py-3 text-sm text-muted">Nincs megadva.</li>}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Megjegyzések az AI-nak</p>
              <AiNotesEditor initial={family.aiNotes} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Konfiguráció (JSON)</p>
            <FamilyJsonEditor initial={familyJson} />
            <p className="mt-2 text-xs text-muted">
              kids: id, name, fullName, className, color (sky/rose/violet/amber/emerald/teal), classGroupEmails · contacts: name, emails, role, subject, kidIds · sources: kreta, szmk, menza, billers,
              newsletters, ignore
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
