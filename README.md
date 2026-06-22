# StudySync Vietnam

A real-time collaborative learning platform for university students, built for
**COS30043 – Interface Design and Development**.

> Demonstrates advanced Vue 3 frontend engineering: **real-time collaborative
> editing** (Yjs CRDT + live presence) and a suite of **manually-implemented
> "AI-like" study tools** — with **no external AI API** of any kind. Every smart
> feature is plain, rule-based JavaScript you can read and test.

<p align="center">
  <img src="src/assets/images/logo_2.png" alt="StudySync logo" width="96" />
</p>

---

## ✨ Features

### 📝 Collaborative notes
| Capability | What it does | Where the logic lives |
|------------|--------------|-----------------------|
| **Real-time editor** | Tiptap/ProseMirror rich text with **Yjs CRDT** sync, live cursors & presence, typing indicators | `components/notes/NoteEditor.vue`, `services/yjsProvider.js` |
| **Inline comments** | Anchored comment marks with real-time sync | `components/notes/CommentMark.js`, `services/commentService.js` |
| **Version history** | Timeline of every revision + **Google-Docs-style inline word diff** (added/removed words shown in place) | `components/notes/VersionHistory.vue`, `utils/wordDiff.js` |
| **Sharing** | Per-link view/edit permissions via `/share/:id` | `components/notes/ShareDialog.vue` |
| **Auto-save** | Debounced save queue, optimistic UI, **optimistic-concurrency version check** that rejects stale writes | `stores/noteStore.js`, `services/noteService.js` |

### 🧠 Rule-based study tools (no AI API)
| Tool | How it works | Where |
|------|--------------|-------|
| **Flashcard generator** | Detects definition patterns (`X is…`, `X refers to…`) → Q/A cards | `utils/flashcardGenerator.js` |
| **Quiz generator** | Multiple-choice with auto distractors + **manual Fisher-Yates shuffle** | `utils/quizGenerator.js` |
| **Keyword extractor** | Stopword removal (EN + VI), frequency counting, technical-term boosting | `utils/keywordExtractor.js`, `data/vietnameseStopwords.js` |
| **Difficulty analyzer** | Weighted score from sentence length, technical density & long-word ratio → Easy/Medium/Hard + explanation | `utils/difficultyAnalyzer.js` |
| **Study summary** | Extractive summary (top sentences by keyword density) | `utils/textAnalyzer.js` |
| **Ask your sources** | Keyword retrieval over uploaded **PDF** documents (parsed with pdf.js) | `components/documents/AskSourcesPanel.vue`, `services/documentService.js` |

### 👩‍🏫 Classes & collaboration
- **Classes** with teacher/student roles, **join-by-code**, announcements.
- **Assignments**, an **assignment runner**, **submissions panel** and a **gradebook**.
- **Study rooms** — live presence + a realtime activity feed.
- **Community** feed for sharing and discussion.

### 🎛️ App experience
- **Hub** command-center home (stats, recent notes, leaderboard, continue studying).
- **Command palette** (quick navigation), **app launcher**, dark mode.
- **Bilingual UI** — English & Vietnamese via `vue-i18n`.
- Subjects & per-subject **workspaces**.

## 🧱 Tech stack

Vue 3 · Vite · Vue Router · Pinia · Supabase (Auth + Postgres + Realtime + Storage)
· Tiptap / ProseMirror · Yjs (CRDT) · pdf.js · vue-i18n · Bootstrap 5.

Styling lives in **separated CSS files** under `src/styles` (design tokens in
`variables.css`, then per-feature files) — no Tailwind, only minimal scoped CSS in components.

## 🚀 Getting started

```bash
npm install
npm run dev
```

Scripts:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |

The app runs immediately in **DEMO MODE** using local sample data (`src/data`) —
no backend required. This is ideal for marking and demos.

### Connect a real Supabase backend

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`,
   then apply the `supabase/migration_*.sql` files (workspaces, classes, note
   sharing, Yjs, comments, …).
3. Copy `.env.example` → `.env` and fill in:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. Restart `npm run dev`. The same code paths now use the live database and
   realtime channels (presence, broadcast, `postgres_changes`).

> **Once both env vars are set the app uses ONLY the database — no sample/mock
> data is shown.** When they're absent it falls back to demo mode, so the project
> still runs offline for marking.

**Full DB setup + Vercel deployment guide: [`DEPLOYMENT.md`](./DEPLOYMENT.md).**

## 📁 Project structure

```
src/
├── assets/          images & icons (app logo, favicon source)
├── components/      common · notes · study · ai · classes · documents · dashboard · charts · hub
├── views/           one file per route/page
├── router/          routes (lazy-loaded) + auth & role guard
├── stores/          Pinia: auth, notes, subjects, classes, documents, studyRoom, ui, ai, …
├── services/        Supabase client + auth/note/realtime/class/document/comment services + Yjs provider
├── utils/           the rule-based "AI" engines + diff/html helpers
├── styles/          separated CSS (variables, layout, per-feature files)
├── i18n/            EN/VI message catalogs
└── data/            sample subjects/notes + EN/VI stopwords
supabase/            schema.sql, seed.sql, migration_*.sql
```

## 🧠 Why this satisfies the "advanced" requirements

- **Real-time goes well beyond a single library subscription.** Notes sync via a
  **Yjs CRDT** for conflict-free concurrent editing, layered with Supabase
  presence, broadcast and `postgres_changes`. The save path adds optimistic
  updates, a debounced queue and an **optimistic-concurrency version check** that
  rejects stale writes and prompts the user to resolve the conflict.
- **The "AI" features are genuinely manual.** No API calls — regex definition
  patterns, frequency analysis, weighted scoring, extractive summarisation and a
  hand-written shuffle. Each utility is small, commented and independently testable.
- **Real product surface area.** Auth, roles, classes/assignments/gradebook,
  document upload + retrieval, sharing, comments, version history, i18n and a
  themeable design system.

---

© StudySync Vietnam — COS30043.
</content>
