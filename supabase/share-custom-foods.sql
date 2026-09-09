-- ============================================================
-- Custom dishes are now shared with everyone (read-only to
-- non-creators — edit/delete stay restricted to whoever made it).
-- author_name is a snapshot taken at creation time, not a live
-- join to profiles, so we never need to broaden profiles' RLS.
-- ============================================================

alter table foods add column if not exists author_name text;

drop policy if exists "View canonical foods and own custom foods" on foods;

create policy "Everyone can view all foods"
  on foods for select
  using (true);

-- Insert/update/delete policies are unchanged — still restricted to
-- created_by = auth.uid(), so sharing is visibility-only.
