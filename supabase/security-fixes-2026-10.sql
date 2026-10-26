-- =====================================================================
-- Security fixes from the October 2026 audit.
-- Run once in Supabase → SQL Editor, after every other file in supabase/.
-- Safe to re-run.
--
--  1. Your own dishes: edit and delete them (owner only). A dish someone
--     else has already logged is never changed under them: editing saves a
--     new version, deleting archives it (locked and hidden from search).
--  2. Custom dishes: at most 150 active per person, sensible name lengths.
--  3. Foods are readable by signed-in users only.
--  4. daily_stats (what friends, quests and duels read) can only be written
--     by the server (POST /api/friends/sync with the service-role key), and
--     impossible values are rejected.
--  5. cheer_counts only counts cheers you are allowed to see; toggle_cheer
--     only accepts a key that belongs to the person you are cheering.
--  6. friend_people no longer shows you people who have blocked you.
--  7. Usernames change only through set_username() (30-day rule).
--  8. user_by_username is internal only.
-- =====================================================================

-- 1. OWN DISHES: archive, lock, edit, delete ---------------------------

alter table foods add column if not exists archived_at timestamptz;
create index if not exists foods_created_by_idx on foods (created_by) where created_by is not null;
create index if not exists food_logs_food_id_idx on food_logs (food_id);

-- Someone other than the creator has logged this dish.
create or replace function public.food_used_by_others(p_food_id bigint, p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from food_logs where food_id = p_food_id and user_id <> p_owner)
$$;
revoke execute on function public.food_used_by_others(bigint, uuid) from public, anon, authenticated;

-- Guard every write to a user's dish, whatever the path (app, RPC or a
-- direct API call):
--  * archived dishes are locked;
--  * once someone else has logged a dish, its name and nutrition are frozen;
--  * at most 150 active dishes per person; name and author lengths bounded.
create or replace function public.foods_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then return new; end if;    -- reference data (SQL editor / food_for_ingredient)
    new.archived_at := null;
    if char_length(coalesce(new.name, '')) not between 1 and 80 then
      raise exception 'Give the dish a name of 1–80 characters.';
    end if;
    new.author_name := left(new.author_name, 40);
    perform pg_advisory_xact_lock(hashtext('foods:' || new.created_by::text));
    if (select count(*) from foods where created_by = new.created_by and archived_at is null) >= 150 then
      raise exception 'You can keep up to 150 dishes. Delete one you no longer use to add another.';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.created_by is null then return new; end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'A dish can''t change owner.';
  end if;
  if old.archived_at is not null then
    raise exception 'This dish was deleted and is kept only for people who logged it.';
  end if;
  if (new.name, new.calories_kcal, new.protein_g, new.carbs_g, new.fat_g, new.fiber_g,
      new.serving_size_g, new.raw_weight_g, new.final_weight_g)
     is distinct from
     (old.name, old.calories_kcal, old.protein_g, old.carbs_g, old.fat_g, old.fiber_g,
      old.serving_size_g, old.raw_weight_g, old.final_weight_g)
     and public.food_used_by_others(old.id, old.created_by) then
    raise exception 'FOOD_IN_USE: someone else has logged this dish, so it can''t be changed in place.';
  end if;
  if char_length(coalesce(new.name, '')) not between 1 and 80 then
    raise exception 'Give the dish a name of 1–80 characters.';
  end if;
  new.author_name := left(new.author_name, 40);
  return new;
end $$;
revoke execute on function public.foods_guard() from public, anon, authenticated;

drop trigger if exists foods_guard on foods;
create trigger foods_guard before insert or update on foods
  for each row execute function public.foods_guard();

-- Recipe lines of a dish others have logged, or of an archived dish, are locked too.
create or replace function public.dish_lines_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select id, created_by, archived_at into f from foods where id = coalesce(new.food_id, old.food_id);
  if f.id is null or f.created_by is null then return coalesce(new, old); end if;
  -- Allow the cascade when a never-logged dish is deleted.
  if tg_op = 'DELETE' and not exists (select 1 from foods where id = old.food_id) then return old; end if;
  if f.archived_at is not null or public.food_used_by_others(f.id, f.created_by) then
    raise exception 'FOOD_IN_USE: this dish''s recipe is locked.';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.dish_lines_guard() from public, anon, authenticated;

drop trigger if exists dish_lines_guard on dish_ingredients;
create trigger dish_lines_guard before insert or update or delete on dish_ingredients
  for each row execute function public.dish_lines_guard();

-- Edit one of YOUR dishes. p_food holds the new values, p_lines the recipe
-- ([{ingredient_id, quantity_g}], may be empty for a plain custom food).
-- Returns the id of the dish as it now stands: the same id when edited in
-- place, or a new id when someone else had logged the old version (the old
-- one is archived for them, and your own logs move to the new version).
create or replace function public.update_my_food(p_food_id bigint, p_food jsonb, p_lines jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  f foods%rowtype;
  target bigint;
  l jsonb;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into f from foods where id = p_food_id for update;
  if f.id is null or f.created_by is distinct from me then
    raise exception 'You can only edit dishes you created.';
  end if;
  if f.archived_at is not null then raise exception 'This dish was deleted.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) > 60 then
    raise exception 'Too many ingredients.';
  end if;

  if public.food_used_by_others(f.id, me) then
    -- Copy-on-write: archive the old version for the people who logged it.
    update foods set archived_at = now() where id = f.id;
    insert into foods (name, category, region, cooking_method, dish_class, calories_kcal, protein_g, carbs_g, fat_g,
                       fiber_g, serving_size_g, raw_weight_g, final_weight_g, source, created_by, author_name)
    values (p_food->>'name', f.category, f.region, nullif(p_food->>'cooking_method', ''), nullif(p_food->>'dish_class', ''),
            (p_food->>'calories_kcal')::numeric, (p_food->>'protein_g')::numeric, (p_food->>'carbs_g')::numeric,
            (p_food->>'fat_g')::numeric, (p_food->>'fiber_g')::numeric,
            coalesce((p_food->>'serving_size_g')::numeric, f.serving_size_g),
            (p_food->>'raw_weight_g')::numeric, (p_food->>'final_weight_g')::numeric,
            f.source, me, f.author_name)
    returning id into target;
    update food_logs set food_id = target where food_id = f.id and user_id = me;
    update user_portions set food_id = target where food_id = f.id and user_id = me;
  else
    target := f.id;
    update foods set
      name = p_food->>'name',
      cooking_method = nullif(p_food->>'cooking_method', ''),
      dish_class = nullif(p_food->>'dish_class', ''),
      calories_kcal = (p_food->>'calories_kcal')::numeric,
      protein_g = (p_food->>'protein_g')::numeric,
      carbs_g = (p_food->>'carbs_g')::numeric,
      fat_g = (p_food->>'fat_g')::numeric,
      fiber_g = (p_food->>'fiber_g')::numeric,
      serving_size_g = coalesce((p_food->>'serving_size_g')::numeric, serving_size_g),
      raw_weight_g = (p_food->>'raw_weight_g')::numeric,
      final_weight_g = (p_food->>'final_weight_g')::numeric
    where id = target;
    delete from dish_ingredients where food_id = target;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    insert into dish_ingredients (food_id, ingredient_id, quantity_g)
    values (target, (l->>'ingredient_id')::bigint, (l->>'quantity_g')::numeric);
  end loop;
  return target;
end $$;

-- Delete one of YOUR dishes. Never logged by anyone: removed. Otherwise it
-- is archived: hidden from search, locked, kept for the logs that use it.
-- Returns 'deleted' or 'archived'.
create or replace function public.delete_my_food(p_food_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  f foods%rowtype;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into f from foods where id = p_food_id for update;
  if f.id is null or f.created_by is distinct from me then
    raise exception 'You can only delete dishes you created.';
  end if;
  if f.archived_at is not null then return 'archived'; end if;
  if exists (select 1 from food_logs where food_id = f.id) then
    update foods set archived_at = now() where id = f.id;
    delete from user_portions where food_id = f.id and user_id = me;
    return 'archived';
  end if;
  delete from foods where id = f.id;   -- recipe lines and portions cascade
  return 'deleted';
end $$;

revoke execute on function public.update_my_food(bigint, jsonb, jsonb) from public, anon;
revoke execute on function public.delete_my_food(bigint) from public, anon;
grant execute on function public.update_my_food(bigint, jsonb, jsonb) to authenticated;
grant execute on function public.delete_my_food(bigint) to authenticated;

-- 3. FOODS READABLE BY SIGNED-IN USERS ONLY ---------------------------------
drop policy if exists "Everyone can view all foods" on foods;
create policy "Everyone can view all foods" on foods for select to authenticated using (true);
revoke all on foods from anon;

-- 4. DAILY_STATS: SERVER-WRITTEN ONLY ---------------------------------------
drop policy if exists "Own daily stats" on daily_stats;
drop policy if exists "Read own daily stats" on daily_stats;
create policy "Read own daily stats" on daily_stats for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on daily_stats from anon, authenticated;

alter table daily_stats drop constraint if exists daily_stats_bounds;
alter table daily_stats add constraint daily_stats_bounds check (
      (steps is null or steps between 0 and 100000)
  and (distance_km is null or distance_km between 0 and 300)
  and (active_kcal is null or active_kcal between 0 and 10000)
  and (floors is null or floors between 0 and 1000)
  and (sleep_hours is null or sleep_hours between 0 and 24)
  and (resting_hr is null or resting_hr between 20 and 250)
  and (weight_kg is null or weight_kg between 20 and 400)
  and (calories_in is null or calories_in between 0 and 30000)
  and (protein_g is null or protein_g between 0 and 2000)
) not valid;  -- checks every new write; existing rows are left alone

-- 5. CHEERS ---------------------------------------------------------------------
create or replace function public.cheer_counts(p_keys text[])
returns table (event_key text, n integer)
language sql stable security definer set search_path = public as $$
  select c.event_key, count(*)::integer
    from cheers c
   where c.event_key = any (p_keys)
     and (c.to_id = auth.uid()
          or exists (select 1 from connections k
                      where k.kind = 'compete' and k.status = 'active'
                        and ((k.owner_id = auth.uid() and k.other_id = c.to_id)
                          or (k.other_id = auth.uid() and k.owner_id = c.to_id))))
     and not public.is_blocked(c.to_id, auth.uid())
   group by c.event_key
$$;

create or replace function public.toggle_cheer(p_to uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not exists (select 1 from connections where kind = 'compete' and status = 'active'
                  and ((owner_id = me and other_id = p_to) or (owner_id = p_to and other_id = me))) then
    raise exception 'You can only cheer people you compete with.';
  end if;
  -- Feed keys are '<person id>:<event>:<day>' and must belong to the person cheered.
  if split_part(coalesce(p_key, ''), ':', 1) <> p_to::text or char_length(p_key) > 120 then
    raise exception 'That cheer doesn''t match this person.';
  end if;
  if exists (select 1 from cheers where from_id = me and event_key = p_key) then
    delete from cheers where from_id = me and event_key = p_key;
    return false;
  end if;
  if exists (select 1 from cheers where from_id = me and to_id = p_to
             and (created_at at time zone 'Asia/Kolkata')::date = today) then
    raise exception 'You already cheered them today.';
  end if;
  insert into cheers (from_id, to_id, event_key) values (me, p_to, p_key);
  return true;
end $$;

-- 6. FRIEND_PEOPLE: never across a block ----------------------------------------
create or replace function public.friend_people()
returns table (id uuid, username text, full_name text, xp integer)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  ids as (
    select case when owner_id = (select id from me) then other_id else owner_id end as uid
      from connections where (select id from me) in (owner_id, other_id)
    union select case when challenger_id = (select id from me) then opponent_id else challenger_id end
      from duels where (select id from me) in (challenger_id, opponent_id)
    union select viewer_id from share_views where owner_id = (select id from me)
    union select from_id from nudges where to_id = (select id from me)
    union select blocked_id from blocks where blocker_id = (select id from me)
    union select (select id from me)
  )
  select p.id, p.username, split_part(coalesce(p.full_name, ''), ' ', 1),
         coalesce((select sum(q.xp) from quest_claims q where q.user_id = p.id), 0)::integer
    from profiles p join ids on ids.uid = p.id
   where p.id = (select id from me)
      or not exists (select 1 from blocks b where b.blocker_id = p.id and b.blocked_id = (select id from me))
$$;

-- 7. USERNAMES ONLY THROUGH set_username() --------------------------------------
-- set_username() is SECURITY DEFINER, so inside it current_user is the
-- function owner and this guard lets it through.
create or replace function public.profiles_username_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.username := null;
      new.username_changed_at := null;
    elsif new.username is distinct from old.username
       or new.username_changed_at is distinct from old.username_changed_at then
      raise exception 'Change your username from the Friends page.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_username_guard on profiles;
create trigger profiles_username_guard before insert or update on profiles
  for each row execute function public.profiles_username_guard();

-- 8. INTERNAL HELPERS -----------------------------------------------------------
revoke execute on function public.user_by_username(text) from public, anon, authenticated;

-- Re-assert the grants for the functions replaced above.
do $$
declare fn text;
begin
  foreach fn in array array['cheer_counts(text[])', 'toggle_cheer(uuid, text)', 'friend_people()'] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
