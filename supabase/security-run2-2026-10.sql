-- =====================================================================
-- Security fixes from the second audit (October 2026). Run once in
-- Supabase → SQL Editor, after units-2026-10.sql. Safe to re-run.
--
--  1. friend_stats: friends' numbers are no longer readable outside a
--     challenge. It now returns only your own numbers and what family share
--     with you. Friends' numbers come from challenge_board(), which already
--     limits them to a live challenge's members, stats and days.
--  2. Challenges: joining re-checks that you're still friends or family with
--     everyone who has joined. Removing someone also withdraws open invites
--     between the two of you.
--  3. can_see_member answers only about people in that challenge, so it can't
--     be used to find out who blocked you.
--  4. Friend limit: only your friends and the invites YOU sent count. Invites
--     strangers send you can't fill your spots.
--  5. Rate limits: each bucket's limit and window are set here, not by the
--     caller, so nobody can reset their own counter.
--  6. Dishes: once others have logged a dish, its labels (category, region,
--     cooking method, class, source, author) are frozen too, and a log made at
--     the same moment as an edit is no longer missed. Recipe lines can't be
--     moved out of a locked dish.
--  7. create_challenge locks everyone involved, so two people can't end up
--     in two open challenges together.
--  8. food_for_ingredient: search_path is plain public, like every other
--     function.
--  9. daily_stats: rows that break the bounds (left from before they were
--     server-written) are removed and the bounds are checked for all rows.
-- =====================================================================

-- 1. FRIEND_STATS: YOURS + FAMILY SHARES ONLY -------------------------------
create or replace function public.friend_stats(p_from date, p_to date)
returns table (user_id uuid, field text, day date, value numeric, via text)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  allowed as (
    select (select id from me) as uid, f as field, 'self'::text as via from unnest(public.stat_fields()) f
    union
    select c.owner_id, f, 'share'
      from connections c cross join unnest(c.fields) f
     where c.kind = 'share' and c.status = 'active' and c.other_id = (select id from me)
       and (c.ends_at is null or c.ends_at > now())
       and not public.is_blocked(c.owner_id, (select id from me))
  )
  select distinct on (a.uid, a.field, s.day) a.uid, a.field, s.day,
         case a.field
           when 'steps' then s.steps::numeric
           when 'distance_km' then s.distance_km
           when 'active_kcal' then s.active_kcal::numeric
           when 'floors' then s.floors::numeric
           when 'sleep_hours' then s.sleep_hours
           when 'resting_hr' then s.resting_hr::numeric
           when 'weight_kg' then s.weight_kg
           when 'calories_in' then s.calories_in::numeric
           when 'protein_g' then s.protein_g::numeric
         end as value,
         a.via
    from allowed a
    join daily_stats s on s.user_id = a.uid
   where (select id from me) is not null
     and s.day between greatest(p_from, current_date - 31) and least(p_to, current_date)
   order by a.uid, a.field, s.day, case a.via when 'self' then 0 else 1 end
$$;
revoke execute on function public.friend_stats(date, date) from public, anon;
grant execute on function public.friend_stats(date, date) to authenticated;

-- 2. CHALLENGES: STILL CONNECTED WHEN YOU JOIN --------------------------------
create or replace function public.respond_challenge(p_id bigint, p_join boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.app_today();
  c challenges%rowtype;
  st text;
  other uuid;
begin
  select * into c from challenges where id = p_id;
  select status into st from challenge_members where challenge_id = p_id and user_id = me for update;
  if not found or st <> 'invited' or c.status <> 'open' or c.ends_on < today then
    raise exception 'This challenge is no longer open.';
  end if;
  if p_join then
    perform public.lock_people(me);
    for other in select user_id from challenge_members where challenge_id = p_id and status = 'joined' and user_id <> me loop
      -- Friends or family with everyone already in it, as when it was created.
      if not public.are_connected(me, other) then
        raise exception 'You''re no longer friends or family with everyone in this challenge, so you can''t join it.';
      end if;
      if public.shared_open_challenge(me, other, p_id) is not null then
        raise exception 'You''re already in another challenge with %. Finish or leave that one first.', public.short_name(other);
      end if;
    end loop;
    if (select count(*) from challenge_members m join challenges x on x.id = m.challenge_id
         where m.user_id = me and m.status = 'joined' and x.status = 'open' and x.ends_on >= today) >= 10 then
      raise exception 'You''re already in 10 challenges. Wait for one to end.';
    end if;
  end if;
  update challenge_members set status = case when p_join then 'joined' else 'declined' end, responded_at = now()
   where challenge_id = p_id and user_id = me;
end $$;
revoke execute on function public.respond_challenge(bigint, boolean) from public, anon;
grant execute on function public.respond_challenge(bigint, boolean) to authenticated;

-- Removing someone (or ending a share) withdraws open invites between you,
-- like blocking does, unless you're still connected another way.
-- Challenges you've both already joined finish on their own.
create or replace function public.end_connection(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c connections%rowtype;
begin
  select * into c from connections where id = p_id for update;
  if not found or me is null or me not in (c.owner_id, c.other_id) then raise exception 'Not found.'; end if;
  if c.status = 'pending' and me = c.initiated_by then
    update connections set status = 'cancelled', responded_at = now() where id = p_id;
  elsif c.status in ('pending', 'active') then
    update connections set status = 'ended', responded_at = now() where id = p_id;
  end if;
  if not public.are_connected(c.owner_id, c.other_id) then
    update challenge_members m set status = 'declined', responded_at = now()
      from challenges ch
     where ch.id = m.challenge_id and ch.status = 'open' and m.status = 'invited'
       and ((m.user_id = c.owner_id and ch.creator_id = c.other_id)
         or (m.user_id = c.other_id and ch.creator_id = c.owner_id));
  end if;
end $$;
revoke execute on function public.end_connection(bigint) from public, anon;
grant execute on function public.end_connection(bigint) to authenticated;

-- 3. CAN_SEE_MEMBER: ONLY ABOUT PEOPLE IN THAT CHALLENGE ----------------------
create or replace function public.can_see_member(p_id bigint, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.in_challenge(p_id)
     and exists (select 1 from challenge_members where challenge_id = p_id and user_id = p_user)
     and (p_user = auth.uid() or not public.is_blocked(p_user, auth.uid()))
$$;
revoke execute on function public.can_see_member(bigint, uuid) from public, anon;
grant execute on function public.can_see_member(bigint, uuid) to authenticated;

-- 4. FRIEND LIMIT: YOUR FRIENDS + INVITES YOU SENT ----------------------------
-- The limit is still checked when you accept an invite
-- (connections_circle_guard runs on pending → active).
create or replace function public.circle_count(p_user uuid, p_kind text, p_except uuid default null)
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct case when owner_id = p_user then other_id else owner_id end)::integer
    from connections
   where kind = p_kind
     and (status = 'active' or (status = 'pending' and initiated_by = p_user))
     and p_user in (owner_id, other_id)
     and (kind = 'compete' or ends_at is null or ends_at > now())
     and (p_except is null or p_except not in (owner_id, other_id))
$$;
revoke execute on function public.circle_count(uuid, text, uuid) from public, anon, authenticated;

-- 5. RATE LIMITS SET ON THE SERVER --------------------------------------------
-- Same signature as before, so the app works with either version; the limit
-- and window arguments are ignored. Keep in step with src/lib/rateLimit.js.
create or replace function public.hit_rate_limit(p_bucket text, p_limit integer default null, p_window_seconds integer default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  lim integer;
  win integer;
  n integer;
begin
  if me is null then return false; end if;
  select v.lim, v.win into lim, win
    from (values ('google', 240, 600), ('history', 30, 3600), ('sync', 120, 600), ('friends', 12, 3600)) v(bucket, lim, win)
   where v.bucket = p_bucket;
  if lim is null then raise exception 'Bad rate limit.'; end if;
  insert into api_rate_limits as r (user_id, bucket, window_start, hits)
  values (me, p_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set hits = case when r.window_start < now() - make_interval(secs => win) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => win) then now() else r.window_start end
  returning hits into n;
  return n <= lim;
end $$;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.hit_rate_limit(text, integer, integer) to authenticated;

-- 6. DISHES OTHERS HAVE LOGGED ------------------------------------------------
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
  new.author_name := left(new.author_name, 40);
  if (new.name, new.calories_kcal, new.protein_g, new.carbs_g, new.fat_g, new.fiber_g,
      new.serving_size_g, new.raw_weight_g, new.final_weight_g,
      new.category, new.region, new.cooking_method, new.dish_class, new.source, new.author_name)
     is distinct from
     (old.name, old.calories_kcal, old.protein_g, old.carbs_g, old.fat_g, old.fiber_g,
      old.serving_size_g, old.raw_weight_g, old.final_weight_g,
      old.category, old.region, old.cooking_method, old.dish_class, old.source, old.author_name) then
    -- Wait for anyone logging this dish right now, then check.
    perform 1 from foods where id = old.id for update;
    if public.food_used_by_others(old.id, old.created_by) then
      raise exception 'FOOD_IN_USE: someone else has logged this dish, so it can''t be changed in place.';
    end if;
  end if;
  if char_length(coalesce(new.name, '')) not between 1 and 80 then
    raise exception 'Give the dish a name of 1–80 characters.';
  end if;
  return new;
end $$;
revoke execute on function public.foods_guard() from public, anon, authenticated;

-- Check the dish a line comes from AND the dish it goes to.
create or replace function public.dish_lines_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  f record;
  fid bigint;
begin
  foreach fid in array array_remove(array[
      case when tg_op <> 'INSERT' then old.food_id end,
      case when tg_op <> 'DELETE' then new.food_id end], null) loop
    select id, created_by, archived_at into f from foods where id = fid;
    -- Gone (the cascade when a never-logged dish is deleted) or reference data.
    if f.id is null or f.created_by is null then continue; end if;
    if f.archived_at is not null or public.food_used_by_others(f.id, f.created_by) then
      raise exception 'FOOD_IN_USE: this dish''s recipe is locked.';
    end if;
  end loop;
  return coalesce(new, old);
end $$;
revoke execute on function public.dish_lines_guard() from public, anon, authenticated;

-- 7. CREATE_CHALLENGE LOCKS EVERYONE INVOLVED ---------------------------------
-- Invite 1 to 4 friends or family to 1 to 5 stats for p_days days.
create or replace function public.create_challenge(p_metrics text[], p_people uuid[], p_days integer)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.app_today();
  stats text[];
  ppl uuid[];
  p uuid;
  q uuid;
  new_id bigint;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select array_agg(x order by array_position(public.compete_fields(), x)) into stats
    from (select distinct x from unnest(coalesce(p_metrics, '{}'::text[])) x) d;
  if stats is null then raise exception 'Pick at least one stat.'; end if;
  if not (stats <@ public.compete_fields()) then raise exception 'Pick stats from the list.'; end if;
  if cardinality(stats) > 5 then raise exception 'Up to 5 stats per challenge.'; end if;
  if p_days is null or p_days not between 1 and 30 then raise exception 'Pick between 1 and 30 days.'; end if;
  select array_agg(distinct x) into ppl from unnest(coalesce(p_people, '{}'::uuid[])) x where x is not null and x <> me;
  if ppl is null then raise exception 'Pick at least one person.'; end if;
  if cardinality(ppl) > 4 then raise exception 'Up to 4 people per challenge.'; end if;

  -- Lock everyone involved (in one fixed order), so two people inviting
  -- each other at the same moment can't both get through.
  for p in select x from unnest(array_append(ppl, me)) x order by x::text loop
    perform pg_advisory_xact_lock(hashtext('person:' || p::text));
  end loop;
  foreach p in array ppl loop
    if not public.are_connected(me, p) then
      raise exception 'You can only challenge your friends and family.';
    end if;
    if public.shared_open_challenge(me, p) is not null then
      raise exception 'You''re already in a challenge with %. Start a new one after it ends, or cancel it first.', public.short_name(p);
    end if;
  end loop;
  -- A group: everyone must know everyone, and no pair may already be racing.
  foreach p in array ppl loop
    foreach q in array ppl loop
      if p < q then
        if not public.are_connected(p, q) then
          raise exception 'In a group challenge everyone has to be friends or family with each other. Not everyone you picked is.';
        end if;
        if public.shared_open_challenge(p, q) is not null then
          raise exception 'Two of the people you picked are already in a challenge together. Try again after it ends.';
        end if;
      end if;
    end loop;
  end loop;

  if (select count(*) from challenges where creator_id = me and status = 'open' and ends_on >= today) >= 5 then
    raise exception 'You already have 5 challenges going. Wait for one to end.';
  end if;
  insert into challenges (creator_id, metric, metrics, starts_on, ends_on)
  values (me, stats[1], stats, today + 1, today + p_days)
  returning id into new_id;
  insert into challenge_members (challenge_id, user_id, status, responded_at) values (new_id, me, 'joined', now());
  insert into challenge_members (challenge_id, user_id) select new_id, unnest(ppl);
  return new_id;
end $$;
revoke execute on function public.create_challenge(text[], uuid[], integer) from public, anon;
grant execute on function public.create_challenge(text[], uuid[], integer) to authenticated;

-- 8. FOOD_FOR_INGREDIENT ------------------------------------------------------
-- Ingredients are read-only to users, so the values written come from
-- reference data. Only the search_path changes.
alter function public.food_for_ingredient(bigint) set search_path = public;

-- 9. DAILY_STATS BOUNDS FOR EVERY ROW -----------------------------------------
-- Rows only hold the last 45 days and the next sync rewrites them.
delete from daily_stats where not (
      (steps is null or steps between 0 and 100000)
  and (distance_km is null or distance_km between 0 and 300)
  and (active_kcal is null or active_kcal between 0 and 10000)
  and (floors is null or floors between 0 and 1000)
  and (sleep_hours is null or sleep_hours between 0 and 24)
  and (resting_hr is null or resting_hr between 20 and 250)
  and (weight_kg is null or weight_kg between 20 and 400)
  and (calories_in is null or calories_in between 0 and 30000)
  and (protein_g is null or protein_g between 0 and 2000)
);
alter table daily_stats validate constraint daily_stats_bounds;
