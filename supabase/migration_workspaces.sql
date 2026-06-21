-- ============================================================================
-- Migration — Phase 1: student-owned subjects + documents (NotebookLM sources)
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor on an existing database. Idempotent and
-- safe to re-run (uses IF EXISTS / IF NOT EXISTS and drops policies first).
-- A fresh schema.sql already includes all of this.
-- ============================================================================

-- 1. Subjects: ownership + visibility ---------------------------------------
alter table public.subjects add column if not exists owner_id   uuid references public.profiles(id) on delete set null;
alter table public.subjects add column if not exists owner_type text default 'public';   -- personal | class | public
alter table public.subjects add column if not exists visibility text default 'public';   -- private | class | public
alter table public.subjects add column if not exists class_id   uuid;                     -- FK added in Phase 2

-- 2. Documents (sources added into a subject) -------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid references public.subjects(id) on delete cascade,
  class_id      uuid,                              -- FK added in Phase 2
  owner_id      uuid references public.profiles(id) on delete set null,
  title         text not null,
  source_type   text default 'text',              -- text | pdf | file | link
  file_path     text,                             -- Supabase Storage object path (null in demo)
  source_url    text,
  extracted_text text default '',
  char_count    int default 0,
  status        text default 'ready',             -- pending | extracting | ready | error
  visibility    text default 'private',           -- private | class | public (broadened in Phase 2)
  created_at    timestamptz not null default now()
);

-- 3. Realtime: publish documents (ignore if already a member) ----------------
do $$
begin
  alter publication supabase_realtime add table public.documents;
exception when duplicate_object then null;
end $$;

-- 4. Row Level Security -----------------------------------------------------
alter table public.documents enable row level security;

-- Subjects: keep public read; owners manage their own subjects.
drop policy if exists "insert own subject" on public.subjects;
drop policy if exists "update own subject" on public.subjects;
drop policy if exists "delete own subject" on public.subjects;
create policy "insert own subject" on public.subjects for insert to authenticated with check (owner_id = auth.uid());
create policy "update own subject" on public.subjects for update to authenticated using (owner_id = auth.uid());
create policy "delete own subject" on public.subjects for delete to authenticated using (owner_id = auth.uid());

-- Documents: owner-only in Phase 1 (class sharing added in Phase 2).
drop policy if exists "doc owner read"   on public.documents;
drop policy if exists "doc owner insert" on public.documents;
drop policy if exists "doc owner update" on public.documents;
drop policy if exists "doc owner delete" on public.documents;
create policy "doc owner read"   on public.documents for select using (owner_id = auth.uid() or visibility = 'public');
create policy "doc owner insert" on public.documents for insert to authenticated with check (owner_id = auth.uid());
create policy "doc owner update" on public.documents for update to authenticated using (owner_id = auth.uid());
create policy "doc owner delete" on public.documents for delete to authenticated using (owner_id = auth.uid());

-- 5. Storage bucket for uploaded source files -------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Each user can manage only their own objects in the documents bucket.
drop policy if exists "documents upload own" on storage.objects;
drop policy if exists "documents read own"   on storage.objects;
drop policy if exists "documents delete own" on storage.objects;
create policy "documents upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and owner = auth.uid());
create policy "documents read own" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());
create policy "documents delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());
