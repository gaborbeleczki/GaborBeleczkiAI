import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import {
  BookOpen,
  CalendarRange,
  CircleDollarSign,
  ExternalLink,
  Headphones,
  Lightbulb,
  Mail,
  MailX,
  MessageSquareReply,
  NotebookPen,
  Phone,
  Scale,
  ShoppingBag,
  Sparkles,
  Telescope,
} from "lucide-react";
import { Banner, Card, EmptyState, PageHeader, Pill, SectionTitle } from "@/components/ui/primitives";
import { SpotifyButton, StatusButton, SyncButton } from "@/components/items/client";
import { pageContext } from "@/lib/page-context";
import { getDb, schema } from "@/lib/db";
import { recentMedia } from "@/lib/queries";
import { getDigest, latestDigest, unsubscribeSuggestions } from "@/lib/sync/run";
import { gmailUrl } from "@/lib/google/gmail";
import { spotifySearchUrl, spotifyStatus } from "@/lib/spotify";
import { aiConfigured } from "@/lib/ai/client";
import { huDate, isISODate, todayISO } from "@/lib/time";
import { cx } from "@/lib/ui";
import type { Item } from "@/lib/db/schema";

export const metadata = { title: "Napi összefoglaló" };

const ACTION_ICON: Record<string, React.ReactNode> = {
  reply: <MessageSquareReply className="h-4 w-4" />,
  pay: <CircleDollarSign className="h-4 w-4" />,
  schedule: <CalendarRange className="h-4 w-4" />,
  buy: <ShoppingBag className="h-4 w-4" />,
  read: <BookOpen className="h-4 w-4" />,
  unsubscribe: <MailX className="h-4 w-4" />,
  prepare: <NotebookPen className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  decide: <Scale className="h-4 w-4" />,
};

const URGENCY = { today: { label: "ma", tone: "red" as const }, this_week: { label: "a héten", tone: "amber" as const }, later: { label: "később", tone: "stone" as const } };

export default async function DigestPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const ctx = await pageContext();
  const today = todayISO();
  const date = isISODate(sp.date) ? sp.date : today;
  const digest = (await getDigest(date)) ?? (date === today ? await latestDigest() : null);
  const db = await getDb();
  const media = await recentMedia(10);
  const pastDigests = await db.select({ date: schema.digests.date }).from(schema.digests).orderBy(desc(schema.digests.date)).limit(10);
  const spotify = await spotifyStatus();
  const unsub = await unsubscribeSuggestions();

  const pickOrder = (ids: string[] | undefined, type: string) => {
    const pool = media.filter((m) => m.type === type && m.status === "open");
    const picked = (ids ?? []).map((id) => pool.find((m) => m.id === id)).filter(Boolean) as Item[];
    const rest = pool.filter((m) => !picked.includes(m) && (m.confidence ?? 0) >= 0.5);
    return [...picked, ...rest].slice(0, 8);
  };
  const reading = pickOrder(digest?.reading_pick_ids, "reading");
  const podcasts = pickOrder(digest?.podcast_pick_ids, "podcast");
  const itemIds = (digest?.suggested_actions ?? []).map((a) => a.item_id).filter(Boolean) as string[];
  const linked = itemIds.length ? await db.select().from(schema.items).where(inArray(schema.items.id, itemIds)) : [];
  const anyDone = await db.select({ id: schema.items.id }).from(schema.items).where(eq(schema.items.status, "done")).limit(1);

  return (
    <div className="rise">
      <PageHeader
        eyebrow={`Napi összefoglaló · ${huDate(digest?.date ?? date, { long: true, weekday: true })}`}
        title={digest?.headline ?? "Még nincs mai összefoglaló"}
        subtitle={digest ? `Készült: ${new Date(digest.generatedAt).toLocaleTimeString("hu-HU", { timeZone: "Europe/Budapest", hour: "2-digit", minute: "2-digit" })}` : "Minden reggel automatikusan elkészül; most is legenerálhatod."}
        actions={aiConfigured() ? <SyncButton label="Újragenerálás" endpoint="/api/digest" /> : undefined}
      />
      {!aiConfigured() && <Banner tone="warn">Az összefoglalóhoz be kell állítani az ANTHROPIC_API_KEY környezeti változót.</Banner>}

      {digest ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-5">
              <SectionTitle icon={<Sparkles className="h-4 w-4 text-accent" />}>Fókusz</SectionTitle>
              <ul className="space-y-2">
                {digest.focus.map((f, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-snug">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                    {f}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <SectionTitle icon={<Lightbulb className="h-4 w-4" />}>Javasolt lépések</SectionTitle>
              {digest.suggested_actions.length ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {digest.suggested_actions.map((a, i) => {
                    const item = linked.find((l) => l.id === a.item_id);
                    return (
                      <li key={i} className={cx("flex flex-col gap-2 rounded-2xl bg-surface-2 p-4 ring-1 ring-line ring-inset", item?.status === "done" && "opacity-60")}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-2 font-medium text-ink">
                            <span className="text-accent">{ACTION_ICON[a.kind] ?? <Sparkles className="h-4 w-4" />}</span>
                            {a.title}
                          </span>
                          <Pill tone={URGENCY[a.urgency].tone}>{URGENCY[a.urgency].label}</Pill>
                        </div>
                        <p className="text-sm leading-snug text-muted">{a.why}</p>
                        <div className="mt-auto flex flex-wrap gap-3 text-xs">
                          {a.email_id && (
                            <a href={gmailUrl(a.email_id, ctx.account)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink-2 hover:text-ink">
                              <Mail className="h-3.5 w-3.5" /> Levél megnyitása
                            </a>
                          )}
                          {item && item.status !== "done" && (
                            <StatusButton id={item.id} status="done" className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                              Kész
                            </StatusButton>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Ma nincs külön javaslat.</p>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle icon={<BookOpen className="h-4 w-4" />}>Olvasnivaló</SectionTitle>
              {reading.length ? (
                <ul className="divide-y divide-line">
                  {reading.map((r) => (
                    <li key={r.id} className="flex gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted">
                          {r.sourceContact ?? r.meta?.readingSource ?? "hírlevél"}
                          {r.meta?.minutes ? ` · ${r.meta.minutes} perc` : ""}
                        </p>
                        <a href={r.url ?? (r.sourceEmailId ? gmailUrl(r.sourceEmailId, ctx.account) : "#")} target="_blank" rel="noreferrer" className="mt-0.5 block font-display text-lg font-semibold leading-snug hover:text-accent">
                          {r.title}
                        </a>
                        {r.meta?.why && <p className="mt-1 text-sm leading-snug text-ink-2">{String(r.meta.why)}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noreferrer" className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Megnyitás">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {r.status === "open" ? (
                          <StatusButton id={r.id} status="done" className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-2 ring-1 ring-line ring-inset hover:bg-surface-2">
                            Elolvastam
                          </StatusButton>
                        ) : (
                          <Pill tone="emerald">olvasva</Pill>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">A hírlevelekből még nem került ki olvasnivaló.</p>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <SectionTitle icon={<Telescope className="h-4 w-4" />}>Előre tekintve</SectionTitle>
              <p className="text-[15px] leading-relaxed text-ink-2">{digest.week_ahead}</p>
            </Card>

            {digest.family_tip && (
              <Card className="bg-gradient-to-br from-amber-50 to-transparent p-5 dark:from-amber-950/30">
                <SectionTitle icon={<Lightbulb className="h-4 w-4 text-amber-600" />}>Családi tipp</SectionTitle>
                <p className="text-[15px] leading-relaxed text-ink-2">{digest.family_tip}</p>
              </Card>
            )}

            <Card className="p-5">
              <SectionTitle icon={<Headphones className="h-4 w-4" />}>Podcastok</SectionTitle>
              {!spotify.connected && (
                <p className="mb-3 text-xs text-muted">
                  {spotify.configured ? (
                    <>
                      Kösd össze a Spotify-t a <Link href="/beallitasok" className="underline">Beállításokban</Link>, és egy kattintással a listádra kerülnek.
                    </>
                  ) : (
                    "Spotify-kapcsolat nélkül is megnyithatod az epizódot."
                  )}
                </p>
              )}
              {podcasts.length ? (
                <ul className="space-y-4">
                  {podcasts.map((p) => (
                    <li key={p.id} className="rounded-2xl bg-surface-2 p-3 ring-1 ring-line ring-inset">
                      <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700 dark:text-fuchsia-300">{p.meta?.show ?? p.sourceContact}</p>
                      <p className="mt-0.5 font-medium leading-snug">{p.title}</p>
                      {p.meta?.why && <p className="mt-1 text-sm leading-snug text-muted">{String(p.meta.why)}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {p.meta?.worthy && <Pill tone="violet">ajánlott</Pill>}
                        <SpotifyButton
                          id={p.id}
                          added={Boolean(p.meta?.spotifyAddedAt)}
                          enabled={spotify.connected}
                          fallbackUrl={spotifySearchUrl(String(p.meta?.spotifyQuery ?? p.title))}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nincs új podcast-ajánló.</p>
              )}
            </Card>

            {unsub.length > 0 && (
              <Card className="p-5">
                <SectionTitle icon={<MailX className="h-4 w-4" />}>Postafiók-higiénia</SectionTitle>
                <p className="mb-2 text-xs text-muted">Ezektől sok levél jön, de szinte sosem nyitod meg – érdemes lehet leiratkozni.</p>
                <ul className="space-y-1.5 text-sm">
                  {unsub.map((u) => (
                    <li key={u.email} className="flex justify-between gap-2">
                      <span className="truncate">{u.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {u.unread}/{u.total} olvasatlan
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {pastDigests.length > 1 && (
              <Card className="p-5">
                <SectionTitle>Korábbi napok</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {pastDigests.map((d) => (
                    <Link key={d.date} href={`/napi?date=${d.date}`} className={cx("rounded-full px-3 py-1 text-xs ring-1 ring-inset", d.date === (digest?.date ?? date) ? "bg-ink text-surface ring-ink" : "ring-line text-ink-2")}>
                      {huDate(d.date)}
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <EmptyState icon={<Sparkles className="h-7 w-7" />} title="Nincs összefoglaló erre a napra">
          {anyDone.length ? "Nyomd meg az Újragenerálás gombot." : "Az első szinkron után reggelente automatikusan elkészül."}
        </EmptyState>
      )}
    </div>
  );
}
