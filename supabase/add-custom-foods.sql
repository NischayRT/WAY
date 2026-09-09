-- ============================================================
-- Custom foods — let users add their own dishes.
-- Canonical foods (source: ifct_2017 / usda / community_estimated,
-- created_by is null) stay visible to everyone. User-added dishes
-- are private to the user who created them.
-- ============================================================

alter table foods add column if not exists created_by uuid references profiles(id) on delete cascade;

-- Re-enable RLS on foods (it may currently be disabled from earlier
-- troubleshooting) and replace with the correct policies.
alter table foods enable row level security;

drop policy if exists "Anyone can read foods" on foods;

create policy "View canonical foods and own custom foods"
  on foods for select
  using (created_by is null or created_by = auth.uid());

create policy "Users can add their own foods"
  on foods for insert
  with check (created_by = auth.uid());

create policy "Users can update their own foods"
  on foods for update
  using (created_by = auth.uid());

create policy "Users can delete their own foods"
  on foods for delete
  using (created_by = auth.uid());
