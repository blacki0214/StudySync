-- migration_generated_sets.sql
-- ---------------------------------------------------------------------------
-- Per-user cache for AI-generated study material (flashcards / quiz / summary /
-- keywords). Generating these costs AI credits, and the views used to re-run
-- generation on EVERY visit. This table stores the result once per user, keyed
-- by (kind, source_key) with a content hash so it auto-invalidates when the
-- underlying note/corpus changes. Regenerating overwrites the row (upsert).
--
-- Safe to re-run. Run in: Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.generated_study_sets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null,          -- flashcards | quiz | summary | keywords
  source_key   text not null,          -- e.g. 'note:<uuid>' or 'subject:<uuid>'
  content_hash text not null,          -- hash of the source content it was built from
  payload      jsonb not null,         -- the generated set (array of cards/questions/etc.)
  updated_at   timestamptz not null default now(),
  unique (user_id, kind, source_key)
);

create index if not exists generated_study_sets_lookup
  on public.generated_study_sets (user_id, kind, source_key);

alter table public.generated_study_sets enable row level security;

-- Own-row access only: a user reads/writes their own cached sets.
drop policy if exists "gss read"   on public.generated_study_sets;
drop policy if exists "gss insert" on public.generated_study_sets;
drop policy if exists "gss update" on public.generated_study_sets;
drop policy if exists "gss delete" on public.generated_study_sets;

create policy "gss read"   on public.generated_study_sets for select using (user_id = auth.uid());
create policy "gss insert" on public.generated_study_sets for insert to authenticated with check (user_id = auth.uid());
create policy "gss update" on public.generated_study_sets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gss delete" on public.generated_study_sets for delete to authenticated using (user_id = auth.uid());
