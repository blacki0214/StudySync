-- ============================================================================
-- Migration — "Shared with me" (note collaborators)
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Idempotent / safe to re-run.
--
-- Why this table exists
-- --------------------
-- Opening a share link does NOT transfer ownership: `notes.author_id` stays
-- with whoever created the note. The notes list is scoped to `author_id`
-- (noteService.listNotes) because `notes` grants public read at the RLS level,
-- so an unscoped select would leak every other account's notes.
--
-- The consequence was that a signed-in user could open a share link, edit the
-- note, close the tab — and never find it again, because it belonged to
-- somebody else. This table records the relationship so those notes can be
-- listed back under "Shared with me", WITHOUT loosening the author_id scoping
-- that fixed the original cross-account leak.
--
-- One row per (note, user). Anonymous guests are deliberately NOT recorded:
-- they have no profile row to reference, and a capability link is meant to work
-- without an account.
-- ============================================================================

create table if not exists public.note_collaborators (
  id              uuid primary key default gen_random_uuid(),
  note_id         uuid not null references public.notes (id)    on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  -- The link's permission at the moment it was opened ('read' | 'edit'). Kept
  -- for display only — the live permission is always re-read from notes.
  permission      text not null default 'read',
  first_opened_at timestamptz not null default now(),
  last_opened_at  timestamptz not null default now(),
  unique (note_id, user_id)
);

-- The only query shape used: "every note shared with me, most recent first".
create index if not exists note_collaborators_by_user
  on public.note_collaborators (user_id, last_opened_at desc);

alter table public.note_collaborators enable row level security;

-- Own-row access only — mirrors generated_study_sets. Your list of notes shared
-- with you is yours; nobody else can read or write it.
drop policy if exists "nc read"   on public.note_collaborators;
drop policy if exists "nc insert" on public.note_collaborators;
drop policy if exists "nc update" on public.note_collaborators;
drop policy if exists "nc delete" on public.note_collaborators;

create policy "nc read"   on public.note_collaborators for select using (user_id = auth.uid());
create policy "nc insert" on public.note_collaborators for insert to authenticated with check (user_id = auth.uid());
create policy "nc update" on public.note_collaborators for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "nc delete" on public.note_collaborators for delete to authenticated using (user_id = auth.uid());
