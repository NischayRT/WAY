-- ============================================================
-- Friends: competing, sharing with family, duels and quests.
-- Run this once in the Supabase SQL editor (safe to re-run).
--
-- Privacy is enforced here, not in the app:
--   * Nobody can browse people. You reach someone only by their exact username.
--   * Other people's numbers are never selectable directly. They come only
--     through friend_stats() / duel_board(), which return just the fields
--     both sides agreed to (or the owner chose to share), for active,
--     unexpired connections, and never across a block.
--   * Every write that involves another person goes through a function
--     below that checks who is allowed to do it.
-- ============================================================

-- 1. USERNAMES ----------------------------------------------------
alter table profiles add column if not exists username text;
alter table profiles add column if not exists username_changed_at timestamptz;
create unique index if not exists profiles_username_lower_key on profiles (lower(username));
do $$ begin
  alter table profiles add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_.]{3,20}$');
exception when duplicate_object then null; end $$;

-- 2. DAILY STATS ------------------------------------------------------
-- Each person's own daily totals, written by their own app session
-- (POST /api/friends/sync). Only the owner can read the table directly.
create table if not exists daily_stats (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  steps integer,
  distance_km numeric(6, 2),
  active_kcal integer,
  floors integer,
  sleep_hours numeric(4, 2),
  resting_hr integer,
  weight_kg numeric(5, 1),
  calories_in integer,
  protein_g integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table daily_stats enable row level security;
drop policy if exists "Own daily stats" on daily_stats;
create policy "Own daily stats" on daily_stats for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Fields that can be compared or shared. The first five can be competed on;
-- the last four are personal and can only be shared.
create or replace function public.stat_fields()
returns text[] language sql immutable as $$
  select array['steps','distance_km','active_kcal','floors','sleep_hours','resting_hr','weight_kg','calories_in','protein_g']
$$;
create or replace function public.compete_fields()
returns text[] language sql immutable as $$
  select array['steps','distance_km','active_kcal','floors','sleep_hours']
$$;

-- 3. CONNECTIONS ------------------------------------------------------
-- kind 'compete': owner_id asked other_id to compete on `fields`.
-- kind 'share'  : owner_id's data is visible to other_id (the viewer).
--                 initiated_by = owner_id -> an offer; = other_id -> a request.
create table if not exists connections (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('compete', 'share')),
  owner_id uuid not null references profiles(id) on delete cascade,
  other_id uuid not null references profiles(id) on delete cascade,
  initiated_by uuid not null references profiles(id) on delete cascade,
  fields text[] not null default '{}',
  ends_at timestamptz,
  label text check (label is null or char_length(label) <= 24),
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'cancelled', 'ended')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (owner_id <> other_id),
  check (initiated_by in (owner_id, other_id)),
  check (fields <@ public.stat_fields())
);
create index if not exists connections_owner_idx on connections (owner_id);
create index if not exists connections_other_idx on connections (other_id);
alter table connections enable row level security;
drop policy if exists "See own connections" on connections;
create policy "See own connections" on connections for select
  using (auth.uid() in (owner_id, other_id));
-- No insert/update/delete policies: changes go through the functions below.

-- 4. DUELS ---------------------------------------------------------------
create table if not exists duels (
  id bigint generated always as identity primary key,
  challenger_id uuid not null references profiles(id) on delete cascade,
  opponent_id uuid not null references profiles(id) on delete cascade,
  metric text not null check (metric = any (public.compete_fields())),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (challenger_id <> opponent_id),
  check (ends_on >= starts_on)
);
alter table duels enable row level security;
drop policy if exists "See own duels" on duels;
create policy "See own duels" on duels for select
  using (auth.uid() in (challenger_id, opponent_id));

-- 5. CHEERS, NUDGES, VIEWS, QUESTS, BLOCKS --------------------------------
create table if not exists cheers (
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  event_key text not null check (char_length(event_key) <= 120),
  created_at timestamptz not null default now(),
  primary key (from_id, event_key)
);
alter table cheers enable row level security;
drop policy if exists "See own cheers" on cheers;
create policy "See own cheers" on cheers for select using (auth.uid() in (from_id, to_id));

create table if not exists nudges (
  id bigint generated always as identity primary key,
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('taunt', 'rally', 'check_in')),
  duel_id bigint references duels(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_on date not null default current_date
);
create unique index if not exists nudges_once_a_day on nudges (from_id, to_id, kind, sent_on);
alter table nudges enable row level security;
drop policy if exists "See own nudges" on nudges;
create policy "See own nudges" on nudges for select using (auth.uid() in (from_id, to_id));

create table if not exists share_views (
  id bigint generated always as identity primary key,
  owner_id uuid not null references profiles(id) on delete cascade,
  viewer_id uuid not null references profiles(id) on delete cascade,
  fields text[] not null,
  viewed_at timestamptz not null default now()
);
create index if not exists share_views_owner_idx on share_views (owner_id, viewed_at desc);
alter table share_views enable row level security;
drop policy if exists "Owners see who viewed" on share_views;
create policy "Owners see who viewed" on share_views for select using (owner_id = auth.uid());

create table if not exists quest_claims (
  user_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  quest_id text not null,
  xp integer not null check (xp > 0),
  claimed_at timestamptz not null default now(),
  primary key (user_id, week_start, quest_id)
);
alter table quest_claims enable row level security;
drop policy if exists "See own claims" on quest_claims;
create policy "See own claims" on quest_claims for select using (user_id = auth.uid());

create table if not exists blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table blocks enable row level security;
drop policy if exists "See own blocks" on blocks;
create policy "See own blocks" on blocks for select using (blocker_id = auth.uid());

-- 6. HELPERS ---------------------------------------------------------------
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.user_by_username(p_username text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles where lower(username) = lower(trim(leading '@' from trim(p_username)))
$$;
revoke execute on function public.user_by_username(text) from public, anon;

create or replace function public.week_start(d date default current_date)
returns date language sql immutable as $$ select date_trunc('week', d)::date $$;

-- 7. USERNAME -----------------------------------------------------------------
create or replace function public.set_username(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  u text := lower(trim(leading '@' from trim(p_username)));
  last_change timestamptz;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if u !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'Use 3–20 letters, numbers, dots or underscores.';
  end if;
  select username_changed_at into last_change from profiles where id = me;
  if last_change is not null and last_change > now() - interval '30 days'
     and (select username from profiles where id = me) is not null then
    raise exception 'You can change your username once every 30 days.';
  end if;
  if exists (select 1 from profiles where lower(username) = u and id <> me) then
    raise exception 'That username is taken.';
  end if;
  update profiles set username = u, username_changed_at = now() where id = me;
  return u;
end $$;

-- 8. CONNECTIONS -------------------------------------------------------------
-- p_mode: 'compete' | 'offer' (share mine) | 'request' (ask to see theirs)
create or replace function public.send_connection(p_username text, p_mode text, p_fields text[], p_days integer default null, p_label text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  them uuid := public.user_by_username(p_username);
  f text[] := array(select distinct x from unnest(coalesce(p_fields, '{}')) x where x = any (public.stat_fields()));
  new_id bigint;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if them is null or public.is_blocked(me, them) then raise exception 'No one with that username.'; end if;
  if them = me then raise exception 'That''s you.'; end if;
  if p_mode not in ('compete', 'offer', 'request') then raise exception 'Unknown request type.'; end if;
  if p_mode = 'compete' then
    f := array(select x from unnest(f) x where x = any (public.compete_fields()));
  end if;
  if array_length(f, 1) is null then raise exception 'Pick at least one thing.'; end if;
  if (select count(*) from connections where initiated_by = me and status = 'pending') >= 20 then
    raise exception 'You have too many invites waiting. Cancel some first.';
  end if;
  if exists (
    select 1 from connections
     where status in ('pending', 'active')
       and kind = case when p_mode = 'compete' then 'compete' else 'share' end
       and (
         (p_mode = 'compete' and ((owner_id = me and other_id = them) or (owner_id = them and other_id = me)))
         or (p_mode = 'offer' and owner_id = me and other_id = them)
         or (p_mode = 'request' and owner_id = them and other_id = me)
       )
  ) then
    raise exception 'You already have this with them.';
  end if;

  insert into connections (kind, owner_id, other_id, initiated_by, fields, ends_at, label)
  values (
    case when p_mode = 'compete' then 'compete' else 'share' end,
    case when p_mode = 'request' then them else me end,
    case when p_mode = 'request' then me else them end,
    me,
    f,
    case when p_mode = 'offer' and p_days is not null then now() + make_interval(days => least(greatest(p_days, 1), 365)) end,
    nullif(left(trim(coalesce(p_label, '')), 24), '')
  )
  returning id into new_id;
  return new_id;
end $$;

-- Accept or decline something waiting for you.
-- compete: you may narrow the fields. request: you choose the fields and how long.
create or replace function public.respond_connection(p_id bigint, p_accept boolean, p_fields text[] default null, p_days integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c connections%rowtype;
  f text[];
begin
  select * into c from connections where id = p_id for update;
  if not found or c.status <> 'pending' then raise exception 'This request is no longer waiting.'; end if;
  if me is null or me = c.initiated_by or me not in (c.owner_id, c.other_id) then raise exception 'Not yours to answer.'; end if;
  if not p_accept then
    update connections set status = 'declined', responded_at = now() where id = p_id;
    return;
  end if;
  if c.kind = 'compete' then
    f := array(select x from unnest(c.fields) x where p_fields is null or x = any (p_fields));
  elsif c.initiated_by = c.owner_id then
    f := c.fields; -- an offer is accepted as offered
  else
    f := array(select distinct x from unnest(coalesce(p_fields, c.fields)) x where x = any (public.stat_fields()));
  end if;
  if array_length(f, 1) is null then raise exception 'Pick at least one thing.'; end if;
  update connections
     set status = 'active',
         responded_at = now(),
         fields = f,
         ends_at = case
           when c.kind = 'share' and c.initiated_by = c.other_id then
             case when p_days is null then null else now() + make_interval(days => least(greatest(p_days, 1), 365)) end
           else c.ends_at end
   where id = p_id;
end $$;

-- Cancel your own pending request, or end an active connection (either side).
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
end $$;

-- The owner of a share can remove fields (never add) or change the end date.
create or replace function public.update_share(p_id bigint, p_fields text[], p_days integer default null, p_keep_end boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c connections%rowtype; f text[];
begin
  select * into c from connections where id = p_id for update;
  if not found or c.kind <> 'share' or c.owner_id <> me or c.status <> 'active' then raise exception 'Not found.'; end if;
  f := array(select x from unnest(c.fields) x where x = any (coalesce(p_fields, '{}')));
  if array_length(f, 1) is null then
    update connections set status = 'ended', responded_at = now() where id = p_id;
  else
    update connections
       set fields = f,
           ends_at = case when p_keep_end then c.ends_at
                          when p_days is null then null
                          else now() + make_interval(days => least(greatest(p_days, 1), 365)) end
     where id = p_id;
  end if;
end $$;

-- 9. DUELS ---------------------------------------------------------------------
create or replace function public.send_duel(p_username text, p_metric text, p_days integer)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); them uuid := public.user_by_username(p_username); new_id bigint;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if them is null or public.is_blocked(me, them) then raise exception 'No one with that username.'; end if;
  if them = me then raise exception 'That''s you.'; end if;
  if not (p_metric = any (public.compete_fields())) then raise exception 'Pick a stat to duel on.'; end if;
  if (select count(*) from duels where challenger_id = me and status = 'pending') >= 10 then
    raise exception 'You have too many challenges waiting.';
  end if;
  insert into duels (challenger_id, opponent_id, metric, starts_on, ends_on)
  values (me, them, p_metric, current_date + 1, current_date + least(greatest(coalesce(p_days, 7), 1), 30))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.respond_duel(p_id bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d duels%rowtype; len integer;
begin
  select * into d from duels where id = p_id for update;
  if not found or d.opponent_id <> me or d.status <> 'pending' then raise exception 'This challenge is no longer waiting.'; end if;
  len := d.ends_on - d.starts_on;
  if p_accept then
    -- The clock starts the day after it's accepted.
    update duels set status = 'active', responded_at = now(), starts_on = current_date + 1, ends_on = current_date + 1 + len where id = p_id;
  else
    update duels set status = 'declined', responded_at = now() where id = p_id;
  end if;
end $$;

create or replace function public.cancel_duel(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  update duels set status = 'cancelled', responded_at = now()
   where id = p_id and challenger_id = me and status = 'pending';
end $$;

-- 10. READS ---------------------------------------------------------------------
-- People you have anything with (any status), with only public details.
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
$$;

-- Daily numbers you're allowed to see: all of yours, competitors' agreed
-- fields, and what people actively share with you. At most the last 31 days.
create or replace function public.friend_stats(p_from date, p_to date)
returns table (user_id uuid, field text, day date, value numeric, via text)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  allowed as (
    select (select id from me) as uid, f as field, 'self'::text as via from unnest(public.stat_fields()) f
    union
    select case when c.owner_id = (select id from me) then c.other_id else c.owner_id end, f, 'compete'
      from connections c cross join unnest(c.fields) f
     where c.kind = 'compete' and c.status = 'active' and (select id from me) in (c.owner_id, c.other_id)
    union
    select c.owner_id, f, 'share'
      from connections c cross join unnest(c.fields) f
     where c.kind = 'share' and c.status = 'active' and c.other_id = (select id from me)
       and (c.ends_at is null or c.ends_at > now())
  ),
  visible as (
    select a.* from allowed a
     where a.uid = (select id from me) or not public.is_blocked(a.uid, (select id from me))
  )
  select distinct on (v.uid, v.field, s.day) v.uid, v.field, s.day,
         case v.field
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
         v.via
    from visible v
    join daily_stats s on s.user_id = v.uid
   where s.day between greatest(p_from, current_date - 31) and least(p_to, current_date)
   order by v.uid, v.field, s.day, case v.via when 'self' then 0 when 'share' then 1 else 2 end
$$;

-- Totals for your duels (both sides see the duel stat for the duel's days).
create or replace function public.duel_board()
returns table (duel_id bigint, user_id uuid, total numeric, days integer)
language sql stable security definer set search_path = public as $$
  select d.id, s.user_id,
         case when d.metric = 'sleep_hours' then avg(s.sleep_hours)
              else sum(case d.metric
                         when 'steps' then s.steps::numeric
                         when 'distance_km' then s.distance_km
                         when 'active_kcal' then s.active_kcal::numeric
                         when 'floors' then s.floors::numeric end) end,
         count(*)::integer
    from duels d
    join daily_stats s on s.user_id in (d.challenger_id, d.opponent_id)
                      and s.day between d.starts_on and least(d.ends_on, current_date)
   where auth.uid() in (d.challenger_id, d.opponent_id) and d.status = 'active'
   group by d.id, s.user_id, d.metric
$$;

-- How many cheers each of these events has (from anyone).
create or replace function public.cheer_counts(p_keys text[])
returns table (event_key text, n integer)
language sql stable security definer set search_path = public as $$
  select event_key, count(*)::integer from cheers where event_key = any (p_keys) group by event_key
$$;

-- 11. ACTIONS ------------------------------------------------------------------------
-- Cheer someone you compete with (toggles).
create or replace function public.toggle_cheer(p_to uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from connections where kind = 'compete' and status = 'active'
                  and ((owner_id = me and other_id = p_to) or (owner_id = p_to and other_id = me))) then
    raise exception 'You can only cheer people you compete with.';
  end if;
  if exists (select 1 from cheers where from_id = me and event_key = p_key) then
    delete from cheers where from_id = me and event_key = p_key;
    return false;
  end if;
  insert into cheers (from_id, to_id, event_key) values (me, p_to, p_key);
  return true;
end $$;

-- Taunt or rally a duel opponent, or check in on someone who shares with you. Once a day each.
create or replace function public.send_nudge(p_to uuid, p_kind text, p_duel bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if p_kind in ('taunt', 'rally') then
    if not exists (select 1 from duels where id = p_duel and status = 'active'
                    and ((challenger_id = me and opponent_id = p_to) or (challenger_id = p_to and opponent_id = me))) then
      raise exception 'Not in a duel with them.';
    end if;
  elsif p_kind = 'check_in' then
    if not exists (select 1 from connections where kind = 'share' and status = 'active' and owner_id = p_to and other_id = me) then
      raise exception 'They don''t share with you.';
    end if;
  else
    raise exception 'Unknown nudge.';
  end if;
  insert into nudges (from_id, to_id, kind, duel_id) values (me, p_to, p_kind, p_duel)
  on conflict (from_id, to_id, kind, sent_on) do nothing;
end $$;

-- Log that you looked at what people share with you (at most once per 30 min each).
create or replace function public.record_share_views()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  insert into share_views (owner_id, viewer_id, fields)
  select c.owner_id, me, c.fields
    from connections c
   where c.kind = 'share' and c.status = 'active' and c.other_id = me
     and (c.ends_at is null or c.ends_at > now())
     and not exists (select 1 from share_views v where v.owner_id = c.owner_id and v.viewer_id = me
                       and v.viewed_at > now() - interval '30 minutes');
end $$;

-- Weekly quests, checked against your own data before any XP is given.
create or replace function public.claim_quest(p_quest text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  ws date := public.week_start();
  ok boolean;
  reward integer;
begin
  if me is null then raise exception 'Not signed in'; end if;
  case p_quest
    when 'steps' then
      reward := 300;
      select coalesce(sum(steps), 0) >= 70000 into ok from daily_stats where user_id = me and day between ws and current_date;
    when 'food' then
      reward := 150;
      select count(distinct logged_at) >= 7 into ok from food_logs where user_id = me and logged_at between current_date - 6 and current_date;
    when 'cheer' then
      reward := 50;
      select count(distinct to_id) >= 3 into ok from cheers where from_id = me and created_at >= ws;
    when 'sleep' then
      reward := 200;
      select count(*) >= 5 into ok from daily_stats where user_id = me and day between ws and current_date and sleep_hours >= 7;
    else
      raise exception 'Unknown quest.';
  end case;
  if not ok then raise exception 'Not done yet.'; end if;
  insert into quest_claims (user_id, week_start, quest_id, xp) values (me, ws, p_quest, reward)
  on conflict do nothing;
  return reward;
end $$;

-- Block someone: ends everything with them and hides you from each other.
create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or p_user = me then raise exception 'Not allowed.'; end if;
  insert into blocks (blocker_id, blocked_id) values (me, p_user) on conflict do nothing;
  update connections set status = case when status = 'pending' then 'declined' else 'ended' end, responded_at = now()
   where status in ('pending', 'active') and ((owner_id = me and other_id = p_user) or (owner_id = p_user and other_id = me));
  update duels set status = case when status = 'pending' then 'declined' else 'cancelled' end, responded_at = now()
   where status in ('pending', 'active') and ((challenger_id = me and opponent_id = p_user) or (challenger_id = p_user and opponent_id = me));
end $$;

create or replace function public.unblock_user(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_user
$$;

-- 12. LIMITS, REVISIONS AND PRIVATE NICKNAMES ----------------------------------
-- At most 3 friends (people you compete with) and 3 family (people you share
-- with, either way). Pending invites count, so nobody can be flooded.
create or replace function public.circle_count(p_user uuid, p_kind text, p_except uuid default null)
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct case when owner_id = p_user then other_id else owner_id end)::integer
    from connections
   where kind = p_kind and status in ('pending', 'active')
     and p_user in (owner_id, other_id)
     and (kind = 'compete' or ends_at is null or ends_at > now())
     and (p_except is null or p_except not in (owner_id, other_id))
$$;
revoke execute on function public.circle_count(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.check_circle(p_me uuid, p_them uuid, p_kind text)
returns void language plpgsql stable security definer set search_path = public as $$
declare word text := case when p_kind = 'compete' then 'friends' else 'family members' end;
begin
  if public.circle_count(p_me, p_kind, p_them) >= 3 then
    raise exception 'You already have 3 %. Remove one to add someone new.', word;
  end if;
  if public.circle_count(p_them, p_kind, p_me) >= 3 then
    raise exception 'They already have 3 %.', word;
  end if;
end $$;
revoke execute on function public.check_circle(uuid, uuid, text) from public, anon, authenticated;

-- 'revised' = answered with new terms (a new request goes back the other way).
alter table connections drop constraint if exists connections_status_check;
alter table connections add constraint connections_status_check
  check (status in ('pending', 'active', 'declined', 'cancelled', 'ended', 'revised'));
alter table connections add column if not exists revised_from bigint references connections(id) on delete set null;
alter table duels drop constraint if exists duels_status_check;
alter table duels add constraint duels_status_check
  check (status in ('pending', 'active', 'declined', 'cancelled', 'revised'));
alter table duels add column if not exists revised_from bigint references duels(id) on delete set null;

-- Limits on new invites and on accepting.
create or replace function public.connections_circle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me uuid := coalesce(auth.uid(), new.initiated_by);
  them uuid := case when coalesce(auth.uid(), new.initiated_by) = new.owner_id then new.other_id else new.owner_id end;
begin
  if (tg_op = 'INSERT' and new.status = 'pending')
     or (tg_op = 'UPDATE' and new.status = 'active' and old.status = 'pending') then
    perform public.check_circle(me, them, new.kind);
  end if;
  return new;
end $$;
drop trigger if exists connections_circle_guard on connections;
create trigger connections_circle_guard before insert or update of status on connections
  for each row execute function public.connections_circle_guard();

-- Answer a request with different terms. The original is marked 'revised' and
-- a new request goes back to whoever sent it.
--   compete: other stats to compare.  share: other items (and, if you are the
--   one sharing, how long).
create or replace function public.revise_connection(p_id bigint, p_fields text[], p_days integer default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c connections%rowtype;
  f text[];
  new_id bigint;
begin
  select * into c from connections where id = p_id for update;
  if not found or c.status <> 'pending' then raise exception 'This request is no longer waiting.'; end if;
  if me is null or me = c.initiated_by or me not in (c.owner_id, c.other_id) then raise exception 'Not yours to answer.'; end if;
  f := array(select distinct x from unnest(coalesce(p_fields, '{}')) x
              where x = any (case when c.kind = 'compete' then public.compete_fields() else public.stat_fields() end));
  if array_length(f, 1) is null then raise exception 'Pick at least one thing.'; end if;
  update connections set status = 'revised', responded_at = now() where id = p_id;
  insert into connections (kind, owner_id, other_id, initiated_by, fields, ends_at, label, revised_from)
  values (c.kind, c.owner_id, c.other_id, me, f,
          case when c.kind = 'share' and me = c.owner_id and p_days is not null and p_days > 0
               then now() + make_interval(days => least(p_days, 365)) end,
          c.label, c.id)
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.revise_duel(p_id bigint, p_metric text, p_days integer)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d duels%rowtype; new_id bigint;
begin
  select * into d from duels where id = p_id for update;
  if not found or d.opponent_id <> me or d.status <> 'pending' then raise exception 'This challenge is no longer waiting.'; end if;
  if not (p_metric = any (public.compete_fields())) then raise exception 'Pick a stat to duel on.'; end if;
  update duels set status = 'revised', responded_at = now() where id = p_id;
  insert into duels (challenger_id, opponent_id, metric, starts_on, ends_on, revised_from)
  values (me, d.challenger_id, p_metric, current_date + 1, current_date + least(greatest(coalesce(p_days, 7), 1), 30), d.id)
  returning id into new_id;
  return new_id;
end $$;

-- Your own nicknames for people. Only you can see or change them.
create table if not exists contact_aliases (
  owner_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  other_id uuid not null references profiles(id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 24),
  updated_at timestamptz not null default now(),
  primary key (owner_id, other_id)
);
alter table contact_aliases enable row level security;
drop policy if exists "Own nicknames" on contact_aliases;
create policy "Own nicknames" on contact_aliases for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 13. DAILY VISITS (login streak) ---------------------------------------------
create table if not exists daily_visits (
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table daily_visits enable row level security;
drop policy if exists "Own visits" on daily_visits;
create policy "Own visits" on daily_visits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Signed-in users only.
do $$
declare fn text;
begin
  foreach fn in array array[
    'set_username(text)', 'send_connection(text, text, text[], integer, text)', 'respond_connection(bigint, boolean, text[], integer)',
    'end_connection(bigint)', 'update_share(bigint, text[], integer, boolean)', 'send_duel(text, text, integer)',
    'respond_duel(bigint, boolean)', 'cancel_duel(bigint)', 'friend_people()', 'friend_stats(date, date)', 'duel_board()',
    'cheer_counts(text[])', 'toggle_cheer(uuid, text)', 'send_nudge(uuid, text, bigint)', 'record_share_views()',
    'claim_quest(text)', 'block_user(uuid)', 'unblock_user(uuid)',
    'revise_connection(bigint, text[], integer)', 'revise_duel(bigint, text, integer)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  -- Only used inside the functions above.
  revoke execute on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
end $$;
