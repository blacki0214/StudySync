-- migration_rooms_community_write.sql
-- ---------------------------------------------------------------------------
-- Adds the missing write policies so the app can:
--   • create study rooms (study_rooms had only public-read)
--   • update a room's active_users
--   • persist community up-votes (community_posts had insert but no update)
--
-- Safe to run more than once (drops the policy first). Run in the Supabase
-- SQL editor after schema.sql.

-- Study rooms: any signed-in user can create/update/delete a room.
drop policy if exists "auth insert rooms" on public.study_rooms;
create policy "auth insert rooms" on public.study_rooms
  for insert to authenticated with check (true);

drop policy if exists "auth update rooms" on public.study_rooms;
create policy "auth update rooms" on public.study_rooms
  for update to authenticated using (true);

drop policy if exists "auth delete rooms" on public.study_rooms;
create policy "auth delete rooms" on public.study_rooms
  for delete to authenticated using (true);

-- Community: allow updating a post (needed to persist vote counts).
drop policy if exists "auth update posts" on public.community_posts;
create policy "auth update posts" on public.community_posts
  for update to authenticated using (true);
