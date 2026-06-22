-- ============================================================================
-- Migration — Note sharing (shareable links + anonymous editing)
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Idempotent / safe to re-run.
-- A fresh schema.sql already includes this.
-- ============================================================================

-- 1. Sharing columns on notes ------------------------------------------------
alter table public.notes add column if not exists share_enabled    boolean default false;
alter table public.notes add column if not exists share_permission text default 'read';  -- read | edit

-- 2. RLS: anyone with the link can read (already public) and, when the link is
--    set to "edit", anyone — including anonymous visitors — can update the note.
drop policy if exists "shared edit notes" on public.notes;
create policy "shared edit notes" on public.notes for update
  using (share_enabled = true and share_permission = 'edit')
  with check (share_enabled = true and share_permission = 'edit');

-- Version snapshots may be written by anonymous shared editors too.
drop policy if exists "auth insert versions" on public.note_versions;
drop policy if exists "insert versions"      on public.note_versions;
create policy "insert versions" on public.note_versions for insert with check (true);
