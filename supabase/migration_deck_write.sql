-- migration_deck_write.sql
-- ---------------------------------------------------------------------------
-- The base schema enables RLS on `decks` and `deck_cards` and grants PUBLIC
-- READ, but never added an INSERT/UPDATE/DELETE policy — so "Save as deck"
-- (creating a deck from generated flashcards) was rejected by RLS.
--
-- This adds write access for authenticated users. Safe to re-run: each policy
-- is dropped first.
-- Run in: Supabase → SQL Editor → New query → paste → Run.

-- decks ---------------------------------------------------------------------
drop policy if exists "auth insert decks" on public.decks;
drop policy if exists "auth update decks" on public.decks;
drop policy if exists "auth delete decks" on public.decks;

create policy "auth insert decks" on public.decks for insert to authenticated with check (true);
create policy "auth update decks" on public.decks for update to authenticated using (true);
create policy "auth delete decks" on public.decks for delete to authenticated using (true);

-- deck_cards ----------------------------------------------------------------
drop policy if exists "auth insert deck_cards" on public.deck_cards;
drop policy if exists "auth update deck_cards" on public.deck_cards;
drop policy if exists "auth delete deck_cards" on public.deck_cards;

create policy "auth insert deck_cards" on public.deck_cards for insert to authenticated with check (true);
create policy "auth update deck_cards" on public.deck_cards for update to authenticated using (true);
create policy "auth delete deck_cards" on public.deck_cards for delete to authenticated using (true);
