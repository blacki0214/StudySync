# StudySync — Database setup & Vercel deployment

This guide takes the app from "demo mode" to a **live Supabase backend deployed on
Vercel**. Once the two environment variables are set, the app uses **only the
database** — no sample/mock data is shown anywhere.

> How the switch works: `src/services/supabaseClient.js` sets
> `isSupabaseConfigured = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)`.
> Every service and the `contentStore` check this flag:
> **both vars present → Supabase only. Missing → local sample data (demo mode).**

---

## 1. Set up the database (Supabase)

1. Open your project at [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
   This creates all tables, Row Level Security policies and the realtime publication.
   *(It drops and recreates the StudySync tables, so it's safe to re-run.)*
3. New query again → paste [`supabase/seed.sql`](./supabase/seed.sql) → **Run**.
   This loads the demo content (subjects, notes, decks, rooms, community posts,
   achievements, activity) so the app isn't empty on first load.
   *(Skip this step if you want to start with a completely empty database.)*

### Get your API credentials
Supabase → **Project Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **Project API keys → `anon` / `public`** → `VITE_SUPABASE_ANON_KEY`

The `anon` key is meant to be public in a frontend; Row Level Security is what
protects the data (reads are public, writes require a logged-in user).

### Enable email sign-up
Supabase → **Authentication → Providers → Email**: make sure it's enabled. For a
quick demo, turn **off** "Confirm email" (Authentication → Providers → Email →
*Confirm email*) so new accounts can log in immediately without an inbox step.

---

## 2. Run it locally against the live DB (optional but recommended)

```bash
cp .env.example .env      # then edit .env
```

```dotenv
VITE_SUPABASE_URL=https://YOUR-ref.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-anon-key
```

```bash
npm install
npm run dev
```

Open the browser console — if you DON'T see the `[StudySync] Running in DEMO MODE`
message, you're connected to Supabase. Register an account, then confirm notes you
create appear in **Supabase → Table editor → notes**.

> Your login is remembered across refreshes automatically: the Supabase client is
> created with `persistSession: true`, which stores the session in the browser's
> localStorage (this is the "stay logged in via local storage" behaviour).

---

## 3. Deploy to Vercel

You already have the GitHub repo and a Vercel account, so:

1. **Push your latest commit** to GitHub (see below).
2. Vercel dashboard → **Add New… → Project** → import the GitHub repo.
3. Vercel auto-detects **Vite**. Settings are already provided by
   [`vercel.json`](./vercel.json):
   - Build command: `npm run build`
   - Output directory: `dist`
   - **SPA rewrite** so deep links / refresh on `/notes/123` don't 404.
4. **Environment Variables** (Settings → Environment Variables) — add BOTH, for the
   *Production* (and *Preview*) environments:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | your project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon/public key |

   > These are baked in at **build time** (Vite inlines `VITE_*`). If you add or
   > change them later, you must **redeploy** for them to take effect.
5. Click **Deploy**.

### Point Supabase at your Vercel URL
After the first deploy, copy your `https://your-app.vercel.app` URL into:
Supabase → **Authentication → URL Configuration** → set **Site URL** (and add it to
**Redirect URLs**). This makes auth links resolve to your deployed site.

---

## 4. Verify the live deployment

- Visit the Vercel URL → register → log in.
- Hard-refresh on a deep route (e.g. `/subjects`) — it should load, not 404
  (confirms the SPA rewrite).
- Create a note → check it appears in the Supabase `notes` table.
- DevTools console should **not** show the DEMO MODE banner.

---

## What is and isn't backed by the database

**Fully DB-backed:** profiles, subjects, notes + version history, flashcard decks &
cards, study rooms, community posts, trending topics, achievements, the Hub activity
feed, and the per-user analytics behind the charts (`study_stats`).
Leaderboard & top contributors are **derived** from `profiles.reputation`.

**Intentionally not faked in live mode:** the in-call video tiles, room chat, shared
files, and the editor's collaborator/comment side-panels are visual mockups of
realtime presence with no table behind them. With the DB connected they render
**empty** (rather than showing fake people). Note **version history** in the editor
*is* real. These are the natural next features to build out with Supabase Realtime.

> A note on analytics: in live mode the charts read the first `study_stats` row
> (the seeded demo profile) for every viewer — a deliberate simplification, since
> there's no event pipeline computing real per-user focus time yet.
