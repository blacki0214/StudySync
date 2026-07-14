-- migration_subject_icon.sql
-- ---------------------------------------------------------------------------
-- Lets a subject carry a custom icon: either a Bootstrap icon name (e.g.
-- 'bi-code-slash') or a small uploaded image stored as a data URL. Falls back
-- to the coloured letter badge when null. Also used with the existing
-- `visibility` column to share a personal subject to the public catalog.
--
-- Safe to re-run.

alter table public.subjects
  add column if not exists icon text;
