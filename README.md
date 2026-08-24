# StudySync Vietnam

A real-time collaborative study platform for university students, built for
**COS30043 – Interface Design and Development**.

<p align="center">
  <img src="src/assets/images/logo_2.png" alt="StudySync logo" width="96" />
</p>

> Vue 3 SPA on a real Postgres backend: **CRDT collaborative editing** (Yjs +
> Tiptap), **live presence & WebRTC voice**, a **three-tier school platform**
> (admin / teacher / student), task boards, a schedule, a community feed — and a
> **three-layer AI stack** that degrades from a hosted LLM → an in-browser
> fine-tuned model → a hand-written rule-based engine, so a study tool always
> returns something.

The whole app runs in **two modes from the same code paths**:

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| **Demo** | no env vars set | Every service reads/writes `localStorage` seeded from `src/data/*`. `npm install && npm run dev` is enough to explore everything — no backend, no account. |
| **Live** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Real Postgres with Row Level Security, Supabase Auth, Realtime channels and Storage. **No sample data is shown at all.** |

---

## ✨ Features

### 📝 Collaborative notes
| Capability | What it does | Where |
|---|---|---|
| **Real-time editor** | Tiptap/ProseMirror rich text synced with a **Yjs CRDT** — conflict-free concurrent editing, live cursors, presence, typing indicators | [NoteEditor.vue](src/components/notes/NoteEditor.vue), [yjsProvider.js](src/services/yjsProvider.js) |
| **Rich blocks** | Tables, task lists, resizable images, file attachments, syntax-highlighted code blocks (lowlight), text align / colour / font size | [src/components/notes/](src/components/notes/) |
| **Data import** | Drop a `.csv`/`.tsv` or `.xlsx` file into a note → parsed in-browser (SheetJS lazy-loaded) and inserted as a real editable table | [dataImport.js](src/utils/dataImport.js), [DataGrid.js](src/components/notes/DataGrid.js) |
| **Inline comments** | Anchored comment marks that sync in real time | [CommentMark.js](src/components/notes/CommentMark.js), [commentService.js](src/services/commentService.js) |
| **Version history** | Timeline of every revision plus a Google-Docs-style **inline word diff** | [VersionHistory.vue](src/components/notes/VersionHistory.vue), [wordDiff.js](src/utils/wordDiff.js) |
| **Sharing** | Public `/share/:id` links with view/edit permission, named collaborators, and a **Shared with me** inbox | [ShareDialog.vue](src/components/notes/ShareDialog.vue) |
| **Export** | Whole note → PDF (print) or **Word `.docx`**; generated sets → Markdown / CSV / Anki TSV | [exporters.js](src/utils/exporters.js) |
| **Auto-save** | Debounced save queue, optimistic UI, and an **optimistic-concurrency version check** that rejects stale writes | [noteStore.js](src/stores/noteStore.js), [noteService.js](src/services/noteService.js) |

### 🧠 Study tools — a three-layer AI stack
Every generative feature goes through one facade, [aiService.js](src/services/aiService.js),
which walks down the layers until one succeeds:

```
component / store
      │
      ▼
 aiService  ──1──►  /api/ai  ──►  OpenAI-compatible provider   (server-side key)
      │
      ├────2──►  ml-ai/questionGen.js   fine-tuned T5-small, in-browser (WASM)
      │
      └────3──►  manual-ai/             rule-based, zero network
```

1. **Hosted LLM** — [api/ai.js](api/ai.js) is a Vercel serverless function that
   proxies an OpenAI-compatible chat-completions endpoint. The API key lives
   **only on the server**, never in the bundle. Structured tasks use JSON mode so
   the frontend receives the exact same shapes as the offline layers.
   Tasks: `flashcards · quiz · summary · keywords · ask · chat · rewrite`.
2. **Local ML** — [ml-ai/questionGen.js](src/ml-ai/questionGen.js) runs a
   fine-tuned **T5-small** question generator entirely in the browser via
   `@xenova/transformers` (int8 ONNX, self-hosted from `public/models/`, loaded
   dynamically so it stays out of the main bundle). Trained in
   [notebooks/question-gen.ipynb](notebooks/question-gen.ipynb).
3. **Rule-based** — [src/manual-ai/](src/manual-ai/), a self-contained module
   with no network at all:

   | Tool | How it works |
   |---|---|
   | **Flashcards** | Regex definition patterns (`X is…`, `X refers to…`) → Q/A cards |
   | **Quiz** | Multiple choice with auto-generated distractors + a hand-written Fisher-Yates shuffle |
   | **Keywords** | Stopword removal (EN + VI), frequency counting, technical-term boosting |
   | **Difficulty** | Weighted score from sentence length, technical density and long-word ratio → Easy/Medium/Hard + an explanation |
   | **Summary** | Extractive — top sentences by keyword density ([textAnalyzer.js](src/utils/textAnalyzer.js)) |
   | **Ask your sources** | Keyword retrieval over uploaded **PDFs** parsed with pdf.js |

   `chat` and `rewrite` have no offline equivalent and are hidden unless the
   proxy is configured (`isAiConfigured`).

Generated sets are **cached per user** keyed by content hash
([studySetCacheService.js](src/services/studySetCacheService.js)), so revisiting
a note doesn't burn credits — only the explicit *Regenerate* button does.

### 🎴 Flashcards & spaced repetition
Study mode with a **Leitner box scheduler** (boxes 0–5, intervals 0/1/2/4/7/15
days), per-user review log, due-today KPIs and a 7-day chart — all derived, never
pre-aggregated ([studyStatsStore.js](src/stores/studyStatsStore.js)). Decks can be
saved, shared and exported.

### ✅ Tasks, schedule & notifications
- **Tasks** — ClickUp-style **customizable statuses** and status templates, with
  Board / List / Table views, priorities, task types, due dates and CSV/Excel import
  ([src/components/tasks/](src/components/tasks/), [taskStatusTemplates.js](src/utils/taskStatusTemplates.js)).
- **Schedule** — a calendar that merges dated tasks with class assignment
  deadlines into one normalized event stream ([scheduleStore.js](src/stores/scheduleStore.js)).
- **Notifications** — the bell centre is *derived* from deadlines + the activity
  feed (no extra table), with read-state persisted locally ([notificationStore.js](src/stores/notificationStore.js)).
- **Focus tracking** — real minutes measured on the study surfaces, powering the
  Hub's weekly chart ([focusStore.js](src/stores/focusStore.js)).

### 🏫 School, classes & teaching
A three-tier platform — **admin → teacher → student** — with role-gated routes
(`/school`, `/teach`, `/hub`) and a class-as-workspace model:

- **School dashboard** — roster of teachers/students, class directory ([schoolStore.js](src/stores/schoolStore.js)).
- **Classes** — join-by-code, announcements, and per-class tabs for
  **assignments, submissions, gradebook, quizzes, slides, documents, notes,
  subjects, discussions, attendance and analytics** ([src/components/classes/](src/components/classes/)).
- **Assignment runner** for students; **teacher-authored quizzes** whose scores
  feed the gradebook.
- **Slide presenter** — uploaded PDFs render fullscreen page-by-page via pdf.js.

### 👥 Study rooms & community
- **Study rooms** — live presence, an activity feed, text channels, invites, and
  **real peer-to-peer voice** over a WebRTC mesh signalled through the room's
  Supabase Realtime channel ([useVoiceChat.js](src/composables/useVoiceChat.js)).
- **Community** — Reddit-style feed with up/down votes, threaded replies, save
  and share ([CommunityView.vue](src/views/CommunityView.vue), [CommentNode.vue](src/components/community/CommentNode.vue)).

### 🎛️ App experience
- **Hub** command-center home — stats, recent notes, tasks, upcoming schedule,
  flashcards due, activity feed, and a get-started checklist.
- **Command palette** (⌘K), app launcher, help centre, product tour.
- **Dedicated mobile app shell** — phones get a bottom tab bar, top header and a
  "More" sheet rather than a shrunken sidebar ([uiStore.js](src/stores/uiStore.js), [mobile.css](src/styles/mobile.css)).
- **Bilingual UI** — English & Vietnamese via `vue-i18n`.
- **Dark mode** via `data-theme` token overrides; subjects and per-subject
  workspaces; pagination and search highlighting throughout.

## 🧱 Tech stack

Vue 3 · Vite · Vue Router · Pinia · Supabase (Auth + Postgres + Realtime + Storage)
· Tiptap / ProseMirror · Yjs (CRDT) · WebRTC · pdf.js · SheetJS · `@xenova/transformers`
· vue-i18n · Bootstrap 5 · Vercel serverless functions.

Styling is **separated CSS files** under [src/styles/](src/styles/) — design
tokens in `variables.css`, then one file per feature, all imported by `main.css`.
No Tailwind; components carry only minimal scoped CSS.

## 🚀 Getting started

```bash
npm install
npm run dev
```

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server (demo mode unless `.env` is filled in) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `vercel dev` | Needed to exercise `api/ai.js` locally — plain `vite` does not run it |

The app boots straight into **demo mode** with local sample data, so it runs
offline for marking. In `npm run dev` you can also sign in with the built-in
role accounts (`student@test.local` / `teacher@test.local` / `admin@test.local`,
password `test1234`) to explore all three tiers — these are ignored in a
production build ([testAccounts.js](src/data/testAccounts.js)).

### Connect a real backend

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor run [`supabase/schema.sql`](supabase/schema.sql), then
   [`supabase/seed.sql`](supabase/seed.sql), then the `supabase/migration_*.sql`
   files (workspaces, classes, sharing, Yjs, comments, tasks, schools, slides,
   quizzes, community, …).
3. Copy `.env.example` → `.env`:
   ```dotenv
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. Restart the dev server. The same code paths now use the live database and
   realtime channels (presence, broadcast, `postgres_changes`).

### Enable the hosted AI (optional)

Set these in Vercel → Settings → Environment Variables (**never** with a `VITE_`
prefix, or the key ships to the browser):

```dotenv
AI_API_KEY=...                          # server-only
# AI_BASE_URL=https://api.shopaikey.com/v1
# AI_MODEL=gpt-4o-mini
VITE_AI_ENABLED=true                    # public flag that turns the UI on
```

Optionally set `SUPABASE_URL` + `SUPABASE_ANON_KEY` server-side too, and the
proxy will verify the caller's access token so only logged-in users spend credit.
With `VITE_AI_ENABLED` off, the app quietly uses layers 2 and 3.

**Full DB setup + deployment guide: [`DEPLOYMENT.md`](DEPLOYMENT.md).**

## 📁 Project structure

```
api/ai.js            Vercel serverless AI proxy (server-side key)
src/
├── assets/          images & icons
├── components/      ai · charts · classes · common · community · dashboard
│                    documents · hub · notes · study · subjects · tasks
├── views/           one file per route
├── router/          lazy-loaded routes + auth & role guard
├── stores/          Pinia: auth, notes, tasks, schedule, classes, school,
│                    studyRoom, notifications, focus, studyStats, ui, …
├── services/        Supabase client + one service per feature (each with a
│                    demo-localStorage / live-Supabase branch) + Yjs provider
├── manual-ai/       rule-based engine (fallback layer 3)
├── ml-ai/           in-browser T5 question generator (fallback layer 2)
├── composables/     useVoiceChat (WebRTC), useFocusTracker
├── utils/           diff, export, import, text analysis, validation helpers
├── styles/          separated CSS (tokens + one file per feature)
├── i18n/            EN/VI message catalogs
└── data/            sample content, test accounts, EN/VI stopwords
supabase/            schema.sql · seed.sql · migration_*.sql
notebooks/           T5 question-generation training notebook + metrics
docs/                project report, demo scripts, screenshots
public/models/       self-hosted quantized T5 model (~80 MB)
```

## 🧩 Engineering notes

- **One code path, two backends.** Every service branches on
  `isSupabaseConfigured`, so demo mode isn't a mock layer bolted on the side —
  it's the same functions writing to `localStorage`. Nothing in the UI knows
  which mode it's in.
- **Real-time is more than a subscription.** Notes sync through a Yjs CRDT for
  conflict-free concurrent edits, layered with Supabase presence, broadcast and
  `postgres_changes`; the save path adds optimistic updates, a debounced queue
  and a version check that rejects stale writes and asks the user to resolve.
- **Graceful AI degradation.** A hosted model, an offline model and a rule-based
  engine all return identical shapes, so any layer can fail without the UI
  branching — and the offline engine is small, commented and readable.
- **Per-account isolation.** Every data-bearing Pinia store is reset on
  login/logout and queries are scoped by author, so one account never sees
  another's cached data.
- **Real product surface area.** Auth and roles, schools/classes/assignments/
  gradebook, document upload and retrieval, sharing, comments, version history,
  i18n, a themeable design system and a native-feeling mobile shell.

---

© StudySync Vietnam — COS30043 Interface Design and Development.
