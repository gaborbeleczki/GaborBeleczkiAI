<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1a3Ue7ds4CtXj_EAtbMK09rHEnXHxAyOg

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Elli's English Trail (`/english-trail/`)

`public/english-trail/index.html` is a standalone, gamified English practice page for primary-school
learners using the Super Minds Starter and Super Minds 1 books: a unit-by-unit lesson path with XP,
daily goals and streaks; word and sentence shuffles with printable worksheets; mini-games; and a
randomized Unit 2 mock test. It has no build step and no dependencies: Vite copies it as-is, so it is
served at `/english-trail/` (locally: `npm run dev`, then open http://localhost:3000/english-trail/).
It is unofficial practice material and is not affiliated with Cambridge University Press.

Live: https://elli-english-trail.vercel.app (Vercel project `elli-english-trail`, deployed as a
single static file). Progress for all children in a family is saved in Supabase under a family code
(`XXXXX-XXXXX`) that is created after the first finished lesson; entering the code on another device
(name chip → Családi kód) loads the same progress. Without a connection it keeps working from
localStorage and saves later. Database setup: `supabase/migrations/20261118_english_trail_family_progress.sql`
(private `english` schema, accessed only through the `english_*` RPC functions; the page uses the
project's publishable key).
