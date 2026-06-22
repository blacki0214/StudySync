-- ============================================================================
-- Migration — collaborative editing (Yjs CRDT state)
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Idempotent / safe to re-run.
-- Stores the persisted Yjs document (base64) so edits survive reloads and late
-- joiners get the full history. The `content` column keeps a rendered HTML
-- snapshot for previews, search and the rule-based study tools.
-- ============================================================================

alter table public.notes add column if not exists ydoc text;
