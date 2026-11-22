# Családi Hub – private family organiser

A Hungarian-language family dashboard that reads the family mailbox, understands what teachers,
Kréta, the SZMK, clubs and billers ask for, and turns it into todos, calendar time-blocks,
payment trackers and a daily briefing. Built with Next.js 16, Postgres (Drizzle) and the Claude API.

> **Privacy:** this folder contains code only. Children's names, teacher addresses and every other
> family detail live in the database / environment variables, never in the repository.

## What it does

| View | Path | What you get |
| --- | --- | --- |
| **Ma** (Today) | `/` | Greeting + AI headline, today's agenda (Google Calendar + due items), **next school day's backpack per kid**, overdue items, 7-day outlook, upcoming tests, money due, quick-add box |
| **Napi összefoglaló** | `/napi` | Daily AI briefing: focus points, suggested actions (reply / pay / buy / prepare / call / unsubscribe), week-ahead, family tip, **reading list with context**, **podcast picks with "add to Spotify"**, inbox-hygiene (newsletters you never open) |
| **Iskola** | `/iskola` | Week grid (kids × Mon–Fri) with tests 📝, events 📅, things to bring 🎒, payments 💸; "sometime this week" lane for fuzzy dates; latest teacher messages with AI summaries; attachments/materials library |
| **Számonkérések** | `/szamonkeresek` | Dolgozat / témazáró / beadandó / felmérés timeline per kid, countdown rings, "what to study", study blocks already placed in the calendar |
| **Teendők** | `/teendok` | School · Home · Reminders · Waiting-on lanes side by side, or one timeline; kid filter; natural-language quick add |
| **Naptár** | `/naptar` | Week view merging Google Calendar with Family Hub items (✨ = created by the app) |
| **Befizetések** | `/befizetesek` | School money requests per kid (osztálypénz, menza, trips, clubs) with one-click **"Befizettem"**, copyable account number / közlemény, school-year totals |
| **Számlák** | `/szamlak` | Bills & invoices: unpaid / overdue / paid this month, 90-day spend by category; card receipts and "Sikeres fizetés" mails auto-close the matching bill; optional merged view with school payments |
| **Átnézendő** | `/atnezendo` | Everything the AI was unsure about (week-only dates, unknown kid, low confidence) with the quoted source sentence – approve, edit or dismiss; log of processed mail |
| **Beállítások** | `/beallitasok` | Google + Spotify connections, calendar choice, study windows, family configuration (kids, class groups, teachers, sources) and free-text notes for the AI |

### How mail becomes items

```
Gmail ──► rule pre-classifier ──► Claude (structured output) ──► items (dedupe/merge) ──► Google Calendar time-blocks
            │ class groups → kid           │ school / Kréta / SZMK / money / bills: one call per mail
            │ teachers, forwards            │ newsletters & personal mail: batched triage → todos, reading, podcasts
            │ Kréta, SZMK, menza, billers   └ daily digest: one call per morning
            └ OTP / login-code mails are never sent to the AI
```

* **Kid attribution**: mail to a class Google Group belongs to that kid; forwarded mail ("Feladó: …") is
  attributed to the forwarding teacher's class (e.g. a subject teacher writes one class directly,
  while another class teacher forwards the same teacher's instructions); Kréta notifications name the child.
* **Dates**: "jövő héten", "csütörtökön", "december 2–7." are resolved against the email's send date.
  If only the week is known the item is kept as *week precision* and goes to **Átnézendő**.
* **Dedupe**: the AI sees open items and links follow-ups (e.g. Kréta later announces the exact day of a
  témazáró) to the existing item; a similarity check catches the rest. Payment confirmations close bills.
* **Timeboxing** (only confident, exact-date items): study blocks before tests (témazáró 3, dolgozat 2,
  felmérés 1) in the configured afternoon window, a 19:30 "pack the bag" reminder the evening before,
  a 15-minute payment slot two days before a deadline, all placed into free time across the calendars
  you select. Events carry the source mail link and are updated/removed when the item changes.

## Security model ("locked" deployment)

* Every page and API route requires a signed session (`proxy.ts`); only Google accounts in
  `ALLOWED_EMAILS` can sign in (Gmail dot/`+tag` variants are normalised).
* Optional **family password** (`APP_PASSWORD`, ≥ 12 chars) for the testing phase or as a fallback: constant-time check,
  8 failed attempts per IP per 15 minutes lock the form.
* Gmail access is **read-only**; the calendar scope is used only to write Family Hub events.
* OAuth refresh tokens are AES-256-GCM encrypted at rest; sessions are HS256 JWTs (keys derived from `APP_SECRET`).
* Cron endpoints require `Authorization: Bearer $CRON_SECRET` and return counts only.
* `noindex` headers + `robots.txt` disallow, `X-Frame-Options: DENY`, HSTS.
* All tables have Row Level Security enabled with no policies, so a hosted Postgres REST API (e.g. Supabase) exposes nothing.
* Recommended extra layer: **Vercel → Project → Settings → Deployment Protection → Vercel Authentication** (at least for preview deployments).

## Deploy to Vercel

1. **Database** – any Postgres. Supabase: *Project → Connect → Transaction pooler* URI (port 6543). Neon / Vercel Postgres work too. Migrations run automatically on first request.
   *Sharing an existing database with another app:* give Family Hub its own schema and login role, then set
   `DATABASE_SCHEMA=family_hub` and use that role in `DATABASE_URL` (Supabase pooler user `family_hub.<project-ref>`):
   ```sql
   create role family_hub login password '…' noinherit connection limit 20;
   create schema family_hub;
   revoke all on schema family_hub from public;
   grant usage, create on schema family_hub to family_hub;
   grant create on database postgres to family_hub;   -- the migrator issues CREATE SCHEMA IF NOT EXISTS
   alter role family_hub set search_path = family_hub;
   ```
   The schema is not exposed through Supabase's REST API and the API roles get no grants on it.
2. **Google OAuth client** – [Google Cloud Console](https://console.cloud.google.com/):
   * enable **Gmail API** and **Google Calendar API**;
   * *OAuth consent screen*: External, add your account(s) as test users, scopes `gmail.readonly`, `calendar.events`, `calendar.readonly`;
     then **Publish app → In production** (unverified is fine for personal use – otherwise Google expires refresh tokens after 7 days);
   * *Credentials → OAuth client ID → Web application*, redirect URI `https://<your-domain>/api/auth/google/callback`.
3. **Claude API key** – [console.anthropic.com](https://console.anthropic.com/).
4. **Vercel project** – import the repo, **Root Directory = `family-hub`**, framework Next.js. Environment variables (see `.env.example`):

   | Variable | Value |
   | --- | --- |
   | `APP_SECRET` | `openssl rand -base64 48` |
   | `ALLOWED_EMAILS` | your Google account(s), comma-separated |
   | `MAILBOX_OWNER_EMAIL` | the account whose Gmail/Calendar is synced |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 2 |
   | `ANTHROPIC_API_KEY` | from step 3 (`ANTHROPIC_MODEL` optional, default `claude-opus-5-5`) |
   | `DATABASE_URL` | from step 1 (or connect a Vercel Supabase/Neon store – its `POSTGRES_URL` is picked up automatically) |
   | `APP_PASSWORD` | optional family password; Google sign-in is hidden until `GOOGLE_CLIENT_ID` is set |
   | `CRON_SECRET` | `openssl rand -hex 32` |
   | `APP_URL` | `https://<your-domain>` |
   | `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | optional, redirect URI `https://<your-domain>/api/spotify/callback` |
   | `FAMILY_CONFIG_JSON` | optional initial family config (or paste it later in Beállítások) |

5. **First run** – sign in → *Beállítások → Gmail és Naptár összekapcsolása* → paste/edit the family JSON →
   *Levelek szinkronja*. The first sync reads the last 30 days (40 mails per run; press it again or let the schedule continue).

### Schedules

* `vercel.json` runs `/api/cron/sync` and `/api/cron/digest` once a day (the Hobby plan allows daily crons only; on Pro you can make sync every 15–30 minutes).
* Opening the app triggers a background sync when the data is older than 30 minutes.
* Optional: `.github/workflows/family-hub-sync.yml` (repo root) calls the sync endpoint every 30 minutes during the day once you add the
  repository secrets `FAMILY_HUB_URL` and `FAMILY_HUB_CRON_SECRET`.

### Running cost (Claude API)

Roughly one call per school/finance email, one per ~10 other emails and one digest per day. With Claude Opus 5.5 and a typical
family inbox expect on the order of **$1/day** (more on the first 30-day backfill). Set `ANTHROPIC_MODEL=claude-sonnet-5-5`
to roughly halve it if quality holds for your mail.

## Local development

```bash
npm install
cp .env.example .env.local   # set DEV_LOGIN=1 and ALLOWED_EMAILS=you@example.com
npm run seed                 # fictional demo family into .data/pglite
npm run dev                  # http://localhost:3000 → "Fejlesztői belépés"
npm test                     # vitest: classifier, MIME, dates, slots, crypto, dedupe, schema limits, PGlite repo
```

Without `DATABASE_URL` the app uses an embedded PGlite database in `.data/` (development only).
`npm run seed -- path/to/private.json` loads your own sample data (keep it in the git-ignored `.local/`).
