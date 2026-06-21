# StudySync Vietnam

A real-time collaborative learning platform for university students, built for
**COS30043 – Interface Design and Development**.

> Demonstrates advanced Vue 3 frontend engineering: **real-time collaboration**
> and **manually-implemented "AI-like" study features** — with **no external AI
> API** of any kind. Every smart feature is plain rule-based JavaScript.

---

## ✨ Features

| Area | What it does | Where the logic lives |
|------|--------------|-----------------------|
| **Collaborative editor** | Local editing state, **debounced auto-save**, **version-conflict detection**, optimistic UI, presence, typing indicators, version history | `stores/noteStore.js`, `services/realtimeService.js`, `services/noteService.js` |
| **Flashcard generator** | Detects definition patterns (`X is…`, `X refers to…`, `X is used for…`) and builds Q/A cards | `utils/flashcardGenerator.js` |
| **Quiz generator** | Multiple-choice questions with auto distractors + **manual Fisher-Yates shuffle** | `utils/quizGenerator.js` |
| **Keyword extractor** | Stopword removal (EN + VI), frequency counting, technical-term boosting | `utils/keywordExtractor.js`, `data/vietnameseStopwords.js` |
| **Difficulty analyzer** | Weighted score from sentence length, technical density, long-word ratio & length → Easy/Medium/Hard + explanation | `utils/difficultyAnalyzer.js` |
| **Study summary** | Extractive summary (top sentences by keyword density) | `utils/textAnalyzer.js` |
| **Study rooms** | Live presence + realtime activity feed | `stores/studyRoomStore.js`, `services/studyRoomService.js` |

## 🧱 Tech stack

Vue 3 · Vite · Vue Router · Pinia · Supabase (Auth + DB + Realtime) · Bootstrap 5.
Styling is in **separated CSS files** under `src/styles` (no Tailwind). Components
use only minimal scoped CSS.

## 🚀 Getting started

```bash
npm install
npm run dev
```

The app runs immediately in **DEMO MODE** using local sample data
(`src/data`) — no backend required. This is ideal for marking/demos.

### Connect a real Supabase backend + deploy to Vercel

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` then `supabase/seed.sql` in the Supabase SQL editor.
3. Copy `.env.example` → `.env` and fill in:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. Restart `npm run dev`. The same code paths now use the live database and
   realtime channels (presence, broadcast, postgres_changes).

> **Once both env vars are set the app uses ONLY the database — no sample/mock
> data is shown.** When they're absent it falls back to demo mode (sample data),
> so the project still runs offline for marking.

**Full step-by-step DB setup + Vercel deployment guide: [`DEPLOYMENT.md`](./DEPLOYMENT.md).**

## 📁 Project structure

```
src/
├── assets/          images & icons
├── components/      common · notes · study · ai · dashboard
├── views/           one file per route/page
├── router/          routes + auth guard
├── stores/          Pinia: auth, notes, subjects, studyRoom, ai
├── services/        Supabase client + auth/note/realtime/studyRoom services
├── utils/           the rule-based "AI" engines + helpers
├── styles/          separated CSS (variables, layout, per-feature files)
└── data/            sample subjects/notes + EN/VI stopwords
```

## 🧠 Why this satisfies the "advanced" requirements

- **Real-time goes beyond a library subscription.** The editor combines three
  realtime mechanisms (postgres_changes + presence + broadcast) with frontend
  concurrency handling: optimistic updates, a debounced save queue, and an
  **optimistic-concurrency version check** that rejects stale writes and prompts
  the user to resolve the conflict.
- **The "AI" features are genuinely manual.** No API calls — parsing, regex
  definition patterns, frequency analysis, weighted scoring and a hand-written
  shuffle. Each utility is small, commented and independently testable.

---

© StudySync Vietnam — COS30043.
