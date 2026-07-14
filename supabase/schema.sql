-- ============================================================================
-- StudySync Vietnam — Supabase schema
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- to create the backend the app talks to. Then run `seed.sql` to populate demo
-- content so the app isn't empty on first load.
--
-- DESIGN NOTE — profiles are NOT hard-linked to auth.users.
--   profiles.id is its own UUID so we can seed demo authors (notes/posts/rooms
--   reference them) WITHOUT creating real auth accounts. When a real user signs
--   up, authService upserts a profile row whose id == the auth user id, so the
--   two stay aligned for logged-in users. `profiles.auth_id` keeps the explicit
--   link for anyone who wants to add stricter policies later.
-- ============================================================================

-- Reset (safe to re-run). Order matters because of foreign keys.
drop table if exists public.note_comments    cascade;
drop table if exists public.quiz_attempts    cascade;
drop table if exists public.submissions      cascade;
drop table if exists public.assignments      cascade;
drop table if exists public.class_announcements cascade;
drop table if exists public.class_members   cascade;
drop table if exists public.classes         cascade;
drop table if exists public.documents       cascade;
drop table if exists public.activities      cascade;
drop table if exists public.user_achievements cascade;
drop table if exists public.achievements    cascade;
drop table if exists public.trending_topics cascade;
drop table if exists public.community_posts  cascade;
drop table if exists public.room_members    cascade;
drop table if exists public.study_rooms     cascade;
drop table if exists public.generated_study_sets cascade;
drop table if exists public.quizzes         cascade;
drop table if exists public.flashcards      cascade;
drop table if exists public.deck_cards      cascade;
drop table if exists public.decks           cascade;
drop table if exists public.note_versions   cascade;
drop table if exists public.notes           cascade;
drop table if exists public.study_stats     cascade;
drop table if exists public.subjects        cascade;
drop table if exists public.profiles        cascade;

-- 1. profiles ----------------------------------------------------------------
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid,                       -- optional link to auth.users(id)
  handle      text unique,
  full_name   text not null,
  first_name  text,
  last_name   text,
  email       text,
  dob         date,
  phone       text,
  role        text,                       -- 'student' | 'teacher'
  purpose     text,                       -- 'personal' | 'education' | 'teaching'
  avatar_url  text,
  program     text,
  school      text,
  location    text,
  reputation  int  not null default 0,
  tier        text,
  percentile  text,
  level       int  not null default 1,
  xp          int  not null default 0,
  xp_next     int  not null default 1000,
  streak      int  not null default 0,
  color       text default 'grad-blue',
  joined      date,
  created_at  timestamptz not null default now()
);

-- 2. subjects ----------------------------------------------------------------
create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  letters      text,
  color        text default 'grad-blue',
  name         text not null,
  description  text,
  category     text,
  rating       numeric(2,1) default 0,
  notes_count  int  not null default 0,
  students     int  not null default 0,
  progress     int  not null default 0,   -- simplified (per-user in a real app)
  owner_id     uuid references public.profiles(id) on delete set null,  -- null = seed/public
  owner_type   text default 'public',      -- personal | class | public
  visibility   text default 'public',      -- private | class | public
  class_id     uuid,                        -- FK wired in Phase 2
  created_at   timestamptz not null default now()
);

-- 3. study_stats (per-user analytics powering the charts) --------------------
create table public.study_stats (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  weekly_focus      jsonb,   -- { labels:[], values:[], max }
  reputation_series jsonb,   -- { labels:[], values:[], max, ytd }
  flashcard_stats   jsonb    -- { mastered, dueToday, streak, avgRecall, ... }
);

-- 4. notes -------------------------------------------------------------------
create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid references public.subjects (id) on delete set null,
  class_id      uuid,                          -- FK added with classes (Phase 3)
  author_id     uuid references public.profiles (id) on delete set null,
  title         text not null,
  week          text,
  read_minutes  int  default 0,
  content       text not null default '',
  ydoc          text,                         -- persisted Yjs CRDT state (base64)
  visibility    text not null default 'public',
  share_enabled    boolean default false,
  share_permission text default 'read',      -- read | edit (for shared links)
  likes_count   int  not null default 0,
  version       int  not null default 1,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- 5. note_versions (one row per saved snapshot) ------------------------------
create table public.note_versions (
  id             uuid primary key default gen_random_uuid(),
  note_id        uuid references public.notes (id) on delete cascade,
  content        text not null,
  version_number int  not null,
  summary        text,
  edited_by      uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- 5b. note_comments (inline comments anchored to a CommentMark in the doc) ----
create table public.note_comments (
  id          uuid primary key default gen_random_uuid(),
  comment_id  text not null,                 -- id of the mark in the document
  note_id     uuid references public.notes(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text,
  quote       text,
  body        text not null,
  resolved    boolean default false,
  created_at  timestamptz not null default now()
);

-- 6. decks + deck_cards (Flashcards page) ------------------------------------
create table public.decks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles (id) on delete cascade,  -- creator; lists are scoped to this
  name         text not null,
  subject_code text,
  color        text default 'grad-blue',
  due          int default 0,
  total        int default 0,
  created_at   timestamptz not null default now()
);

create table public.deck_cards (
  id        uuid primary key default gen_random_uuid(),
  deck_id   uuid references public.decks (id) on delete cascade,
  question  text not null,
  answer    text not null,
  position  int default 0
);

-- 7. flashcards (generated/saved from a note) --------------------------------
create table public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid references public.notes (id) on delete cascade,
  question    text not null,
  answer      text not null,
  difficulty  text,
  created_at  timestamptz not null default now()
);

-- 8. quizzes -----------------------------------------------------------------
create table public.quizzes (
  id              uuid primary key default gen_random_uuid(),
  note_id         uuid references public.notes (id) on delete cascade,
  question        text not null,
  options         jsonb not null,
  correct_answer  int  not null,
  created_at      timestamptz not null default now()
);

-- 8a. generated_study_sets (per-user cache of AI-generated material) ---------
-- One row per (user, kind, source). `content_hash` lets us reuse the cached set
-- while the source is unchanged and regenerate (upsert) when it changes — so we
-- don't spend AI credits re-generating on every visit.
create table public.generated_study_sets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null,          -- flashcards | quiz | summary | keywords
  source_key   text not null,          -- e.g. 'note:<uuid>' or 'subject:<uuid>'
  content_hash text not null,
  payload      jsonb not null,
  updated_at   timestamptz not null default now(),
  unique (user_id, kind, source_key)
);
create index generated_study_sets_lookup
  on public.generated_study_sets (user_id, kind, source_key);

-- 8b. documents (NotebookLM-style sources added into a subject) --------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid references public.subjects(id) on delete cascade,
  class_id      uuid,                              -- FK wired in Phase 2
  owner_id      uuid references public.profiles(id) on delete set null,
  title         text not null,
  source_type   text default 'text',              -- text | pdf | file | link
  file_path     text,                             -- Supabase Storage path (null in demo)
  source_url    text,
  extracted_text text default '',
  char_count    int default 0,
  status        text default 'ready',             -- pending | extracting | ready | error
  visibility    text default 'private',           -- private | class | public
  created_at    timestamptz not null default now()
);

-- 9. study_rooms -------------------------------------------------------------
create table public.study_rooms (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles (id) on delete cascade,  -- creator; lists are scoped to this
  subject_id   uuid references public.subjects (id) on delete set null,
  code         text,
  name         text not null,
  description  text,
  live         boolean default false,
  active_users int  not null default 0,
  created_at   timestamptz not null default now()
);

-- 9a. room_members (invites: who has joined a room they don't own) ------------
create table public.room_members (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.study_rooms (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);
create index room_members_user on public.room_members (user_id);

-- 10. community_posts + trending_topics --------------------------------------
create table public.community_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references public.profiles (id) on delete set null,
  subject_code text,
  title        text not null,
  excerpt      text,
  tags         text[] default '{}',
  votes        int default 0,
  replies      int default 0,
  answered     boolean default false,
  created_at   timestamptz not null default now()
);

create table public.trending_topics (
  id     uuid primary key default gen_random_uuid(),
  tag    text not null,
  posts  int  not null default 0
);

-- 11. achievements -----------------------------------------------------------
create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  icon        text,
  color       text,
  unlocked    boolean default false,    -- simplified (per-user in a real app)
  sort        int default 0
);

-- 12. activities (the Hub cross-feature feed) --------------------------------
create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  type        text not null,            -- note | room | community | flashcards
  icon        text,
  color       text,
  i18n_key    text,                     -- e.g. hub.activity.noteEdited
  params      jsonb default '{}',
  route_name  text,
  route_params jsonb default '{}',
  created_at  timestamptz not null default now()
);

-- 13. classes + enrollment + announcements (Phase 2) -------------------------
create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  code        text unique not null,        -- short join code
  color       text default 'grad-blue',
  archived    boolean default false,
  created_at  timestamptz not null default now()
);
create table public.class_members (
  id        uuid primary key default gen_random_uuid(),
  class_id  uuid references public.classes(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  role      text default 'member',          -- member | ta
  joined_at timestamptz not null default now(),
  unique (class_id, user_id)
);
create table public.class_announcements (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid references public.classes(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- Security-definer helpers (run as owner → bypass RLS → no policy recursion).
create or replace function public.is_class_owner(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and owner_id = auth.uid());
$$;
create or replace function public.is_class_member(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = cid and user_id = auth.uid())
      or exists (select 1 from public.classes where id = cid and owner_id = auth.uid());
$$;

-- 14. assignments + submissions + quiz attempts (Phase 3) --------------------
create table public.assignments (
  id                 uuid primary key default gen_random_uuid(),
  class_id           uuid references public.classes(id) on delete cascade,
  author_id          uuid references public.profiles(id) on delete set null,
  title              text not null,
  instructions       text,
  type               text default 'text',     -- text | quiz
  source_document_id uuid references public.documents(id) on delete set null,
  due_at             timestamptz,
  created_at         timestamptz not null default now()
);
create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  content       text,
  answers       jsonb default '[]',
  score         int,
  total         int,
  graded        boolean default false,
  created_at    timestamptz not null default now(),
  unique (assignment_id, user_id)
);
create table public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  subject_id  uuid references public.subjects(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  class_id    uuid references public.classes(id) on delete set null,
  score       int,
  total       int,
  created_at  timestamptz not null default now()
);
create or replace function public.is_assignment_owner(aid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.assignments a join public.classes c on c.id = a.class_id
    where a.id = aid and c.owner_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- Realtime: publish the tables the editor/rooms subscribe to.
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.note_versions;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.class_announcements;
alter publication supabase_realtime add table public.note_comments;

-- ----------------------------------------------------------------------------
-- Row Level Security. Reads are public (it's a sharing platform); writes are
-- limited to authenticated users. Tighten these for real production use.
-- ----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.subjects        enable row level security;
alter table public.study_stats     enable row level security;
alter table public.notes           enable row level security;
alter table public.note_versions   enable row level security;
alter table public.decks           enable row level security;
alter table public.deck_cards      enable row level security;
alter table public.flashcards      enable row level security;
alter table public.quizzes         enable row level security;
alter table public.study_rooms     enable row level security;
alter table public.room_members    enable row level security;

-- Room memberships (invites) are private: a user manages only their own.
create policy "rm read"   on public.room_members for select using (user_id = auth.uid());
create policy "rm insert" on public.room_members for insert to authenticated with check (user_id = auth.uid());
create policy "rm delete" on public.room_members for delete to authenticated using (user_id = auth.uid());
alter table public.community_posts enable row level security;
alter table public.trending_topics enable row level security;
alter table public.achievements    enable row level security;
alter table public.activities      enable row level security;
alter table public.documents       enable row level security;
alter table public.generated_study_sets enable row level security;

-- Own-row access only — a user's cached study sets are private to them.
create policy "gss read"   on public.generated_study_sets for select using (user_id = auth.uid());
create policy "gss insert" on public.generated_study_sets for insert to authenticated with check (user_id = auth.uid());
create policy "gss update" on public.generated_study_sets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gss delete" on public.generated_study_sets for delete to authenticated using (user_id = auth.uid());

-- Public read for everything the app displays.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','subjects','study_stats','notes','note_versions','decks',
    'deck_cards','flashcards','quizzes','study_rooms','community_posts',
    'trending_topics','achievements','activities'
  ]
  loop
    execute format('create policy "public read %1$s" on public.%1$I for select using (true);', t);
  end loop;
end $$;

-- Authenticated users can write the content they interact with.
create policy "auth insert notes"     on public.notes         for insert to authenticated with check (true);
create policy "auth update notes"     on public.notes         for update to authenticated using (true);
create policy "auth delete notes"     on public.notes         for delete to authenticated using (true);
-- Shared links: anyone (incl. anonymous) can edit when the link permits it.
create policy "shared edit notes"     on public.notes         for update using (share_enabled = true and share_permission = 'edit') with check (share_enabled = true and share_permission = 'edit');
create policy "insert versions"       on public.note_versions for insert with check (true);
create policy "auth insert posts"     on public.community_posts for insert to authenticated with check (true);
create policy "auth insert decks"     on public.decks         for insert to authenticated with check (true);
create policy "auth update decks"     on public.decks         for update to authenticated using (true);
create policy "auth delete decks"     on public.decks         for delete to authenticated using (true);
create policy "auth insert deck_cards" on public.deck_cards   for insert to authenticated with check (true);
create policy "auth update deck_cards" on public.deck_cards   for update to authenticated using (true);
create policy "auth delete deck_cards" on public.deck_cards   for delete to authenticated using (true);
create policy "auth insert flashcards" on public.flashcards   for insert to authenticated with check (true);
create policy "auth insert quizzes"   on public.quizzes       for insert to authenticated with check (true);
create policy "auth insert activity"  on public.activities    for insert to authenticated with check (true);

-- Profiles: anyone can create their row on sign-up; you may only edit your own.
create policy "insert own profile" on public.profiles for insert with check (true);
create policy "update own profile" on public.profiles for update using (auth.uid() = auth_id or auth.uid() = id);

-- Subjects: public read (above) + owners manage their own.
create policy "insert own subject" on public.subjects for insert to authenticated with check (owner_id = auth.uid());
create policy "update own subject" on public.subjects for update to authenticated using (owner_id = auth.uid());
create policy "delete own subject" on public.subjects for delete to authenticated using (owner_id = auth.uid());

-- Documents: owner, public, or any member of the document's class can read.
create policy "doc owner read"   on public.documents for select using (owner_id = auth.uid() or visibility = 'public' or public.is_class_member(class_id));
create policy "doc owner insert" on public.documents for insert to authenticated with check (owner_id = auth.uid());
create policy "doc owner update" on public.documents for update to authenticated using (owner_id = auth.uid());
create policy "doc owner delete" on public.documents for delete to authenticated using (owner_id = auth.uid());

-- Storage bucket for uploaded source files (private; owner-scoped objects).
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;
create policy "documents upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and owner = auth.uid());
create policy "documents read own" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());
create policy "documents delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());

-- Classes + enrollment + announcements (Phase 2).
alter table public.classes             enable row level security;
alter table public.class_members       enable row level security;
alter table public.class_announcements enable row level security;

create policy "classes read"   on public.classes for select using (true);
create policy "classes insert" on public.classes for insert to authenticated with check (owner_id = auth.uid());
create policy "classes update" on public.classes for update to authenticated using (owner_id = auth.uid());
create policy "classes delete" on public.classes for delete to authenticated using (owner_id = auth.uid());

create policy "members read"   on public.class_members for select using (public.is_class_member(class_id));
create policy "members insert" on public.class_members for insert to authenticated
  with check (user_id = auth.uid() or public.is_class_owner(class_id));
create policy "members update" on public.class_members for update to authenticated using (public.is_class_owner(class_id));
create policy "members delete" on public.class_members for delete to authenticated
  using (public.is_class_owner(class_id) or user_id = auth.uid());

create policy "ann read"   on public.class_announcements for select using (public.is_class_member(class_id));
create policy "ann insert" on public.class_announcements for insert to authenticated with check (public.is_class_owner(class_id));
create policy "ann delete" on public.class_announcements for delete to authenticated using (public.is_class_owner(class_id));

-- Assignments + submissions + quiz attempts (Phase 3).
alter table public.assignments   enable row level security;
alter table public.submissions   enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "assign read"   on public.assignments for select using (public.is_class_member(class_id));
create policy "assign write"  on public.assignments for insert to authenticated with check (public.is_class_owner(class_id));
create policy "assign update" on public.assignments for update to authenticated using (public.is_class_owner(class_id));
create policy "assign delete" on public.assignments for delete to authenticated using (public.is_class_owner(class_id));

create policy "sub read"   on public.submissions for select using (user_id = auth.uid() or public.is_assignment_owner(assignment_id));
create policy "sub insert" on public.submissions for insert to authenticated with check (user_id = auth.uid());
create policy "sub update" on public.submissions for update to authenticated using (user_id = auth.uid() or public.is_assignment_owner(assignment_id));
create policy "sub delete" on public.submissions for delete to authenticated using (user_id = auth.uid() or public.is_assignment_owner(assignment_id));

create policy "attempt read"   on public.quiz_attempts for select using (user_id = auth.uid() or public.is_class_owner(class_id));
create policy "attempt insert" on public.quiz_attempts for insert to authenticated with check (user_id = auth.uid());

-- Inline note comments: readable by anyone who can open the note; authenticated write.
alter table public.note_comments enable row level security;
create policy "comments read"   on public.note_comments for select using (true);
create policy "comments insert" on public.note_comments for insert to authenticated with check (true);
create policy "comments update" on public.note_comments for update to authenticated using (true);
create policy "comments delete" on public.note_comments for delete to authenticated using (true);
