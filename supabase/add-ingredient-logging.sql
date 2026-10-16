-- =====================================================================
-- Log ingredients directly, and remember custom portion sizes.
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- 1. food_for_ingredient(id): food_logs can only point at a row in `foods`,
--    so logging a raw ingredient (banana, paneer, oats…) needs a matching
--    food. This returns the shared food for that ingredient, reusing a
--    shared food with the same name if one exists, and creating it once
--    otherwise. Runs with elevated rights only for that insert; callers
--    must be signed in and can't choose any of the values written.
--
-- 2. user_portions: "my bowl is 250 g" per user and food, private to the
--    user (RLS).
-- =====================================================================

alter table public.foods add column if not exists ingredient_id bigint references public.ingredients(id);
create unique index if not exists foods_shared_ingredient_key
  on public.foods (ingredient_id) where ingredient_id is not null and created_by is null;

create or replace function public.food_for_ingredient(p_ingredient_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fid bigint;
  ing public.ingredients;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  select id into fid from foods where ingredient_id = p_ingredient_id and created_by is null limit 1;
  if fid is not null then return fid; end if;

  select * into ing from ingredients where id = p_ingredient_id;
  if ing.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- A shared food with the same name already exists (e.g. "Banana"): link and reuse it.
  select id into fid from foods
  where created_by is null and ingredient_id is null and lower(name) = lower(ing.name)
  order by id limit 1;
  if fid is not null then
    update foods set ingredient_id = ing.id where id = fid and ingredient_id is null;
    return fid;
  end if;

  insert into foods (name, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, serving_size_g, source, ingredient_id)
  values (
    ing.name, 'ingredient', ing.calories_kcal, ing.protein_g, ing.carbs_g, ing.fat_g, coalesce(ing.fiber_g, 0), 100,
    case when ing.source in ('ifct_2017', 'usda', 'community_estimated') then ing.source else 'community_estimated' end,
    ing.id
  )
  on conflict do nothing
  returning id into fid;

  if fid is null then -- created by someone else at the same moment
    select id into fid from foods where ingredient_id = p_ingredient_id and created_by is null limit 1;
  end if;
  return fid;
end $$;

revoke all on function public.food_for_ingredient(bigint) from public, anon;
grant execute on function public.food_for_ingredient(bigint) to authenticated;

create table if not exists public.user_portions (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id    bigint not null references public.foods (id) on delete cascade,
  unit       text not null check (char_length(unit) between 1 and 20),
  grams      numeric not null check (grams > 0 and grams <= 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.user_portions enable row level security;
revoke all on public.user_portions from anon;
grant select, insert, update, delete on public.user_portions to authenticated;

drop policy if exists user_portions_own on public.user_portions;
create policy user_portions_own on public.user_portions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
