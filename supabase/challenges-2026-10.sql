-- =====================================================================
-- Challenges (October 2026). Run once in Supabase → SQL Editor, after
-- security-followups-2026-10.sql. Safe to re-run.
--
--  1. Friends limit goes from 3 to 6 (family stays at 3).
--  2. Challenges replace duels: invite 1 to 6 friends to a stat for 1 to 30
--     days. It starts the next day (India time) and ends on a fixed date.
--     Friends can join until it ends; their numbers count from day one.
--  3. Only people who joined see each other's numbers, and only that stat,
--     only for those days. Never across a block.
--  4. Results are locked two days after the end (so late syncs count) and
--     kept, even after daily numbers are cleared.
--  5. Taunts and rallies now belong to challenges.
--  6. Running and waiting duels become challenges; no new duels.
-- =====================================================================

create or replace function public.app_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- 1. FRIENDS LIMIT 6 ------------------------------------------------------
create or replace function public.check_circle(p_me uuid, p_them uuid, p_kind text)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  word text := case when p_kind = 'compete' then 'friends' else 'family members' end;
  cap integer := case when p_kind = 'compete' then 6 else 3 end;
begin
  if public.circle_count(p_me, p_kind, p_them) >= cap then
    raise exception 'You already have % %. Remove one to add someone new.', cap, word;
  end if;
  if public.circle_count(p_them, p_kind, p_me) >= cap then
    raise exception 'They already have % %.', cap, word;
  end if;
end $$;
revoke execute on function public.check_circle(uuid, uuid, text) from public, anon, authenticated;

-- 2. TABLES ---------------------------------------------------------------
create table if not exists challenges (
  id bigint generated always as identity primary key,
  creator_id uuid not null references profiles(id) on delete cascade,
  metric text not null check (metric = any (public.compete_fields())),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'cancelled')),
  finalized_at timestamptz,
  from_duel bigint unique,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 29)
);
create index if not exists challenges_creator_idx on challenges (creator_id);

create table if not exists challenge_members (
  challenge_id bigint not null references challenges(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined', 'left')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  -- Filled when the results lock (see finalize_my_challenges).
  final_total numeric,
  final_rank integer,
  prev_rank integer,
  final_streak integer,
  result_seen boolean not null default false,
  primary key (challenge_id, user_id)
);
create index if not exists challenge_members_user_idx on challenge_members (user_id);

-- Membership check for the policies (a policy can't query its own table).
create or replace function public.in_challenge(p_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from challenge_members where challenge_id = p_id and user_id = auth.uid())
$$;
-- A member row is visible to the other members of that challenge, never
-- across a block.
create or replace function public.can_see_member(p_id bigint, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.in_challenge(p_id) and (p_user = auth.uid() or not public.is_blocked(p_user, auth.uid()))
$$;
revoke execute on function public.in_challenge(bigint) from public, anon;
revoke execute on function public.can_see_member(bigint, uuid) from public, anon;
grant execute on function public.in_challenge(bigint) to authenticated;
grant execute on function public.can_see_member(bigint, uuid) to authenticated;

alter table challenges enable row level security;
alter table challenge_members enable row level security;
drop policy if exists "Members see challenges" on challenges;
create policy "Members see challenges" on challenges for select to authenticated
  using (public.in_challenge(id));
drop policy if exists "Members see each other" on challenge_members;
create policy "Members see each other" on challenge_members for select to authenticated
  using (public.can_see_member(challenge_id, user_id));
-- Every change goes through the functions below. Final numbers are read
-- through challenge_results(), so the columns that hold them aren't selectable.
revoke all on challenges from anon, authenticated;
revoke all on challenge_members from anon, authenticated;
grant select on challenges to authenticated;
grant select (challenge_id, user_id, status, invited_at, responded_at, result_seen) on challenge_members to authenticated;

-- 3. HELPERS --------------------------------------------------------------
create or replace function public.stat_value(s daily_stats, f text)
returns numeric language sql immutable as $$
  select case f
    when 'steps' then s.steps::numeric
    when 'distance_km' then s.distance_km
    when 'active_kcal' then s.active_kcal::numeric
    when 'floors' then s.floors::numeric
    when 'sleep_hours' then s.sleep_hours
  end
$$;
revoke execute on function public.stat_value(daily_stats, text) from public, anon, authenticated;

-- Total over [p_from, p_to]: a sum, or an average for sleep. Null with no data.
create or replace function public.challenge_total(p_user uuid, p_metric text, p_from date, p_to date)
returns numeric language sql stable security definer set search_path = public as $$
  select case when p_metric = 'sleep_hours' then avg(v) else sum(v) end
    from (select public.stat_value(s, p_metric) as v from daily_stats s
           where s.user_id = p_user and s.day between p_from and p_to) x
   where v is not null
$$;
revoke execute on function public.challenge_total(uuid, text, date, date) from public, anon, authenticated;

-- Days in a row, up to p_to, with some activity.
create or replace function public.challenge_streak(p_user uuid, p_metric text, p_from date, p_to date)
returns integer language sql stable security definer set search_path = public as $$
  select (p_to - coalesce(max(g.d::date), p_from - 1))::integer
    from generate_series(p_from, p_to, interval '1 day') g(d)
   where not exists (select 1 from daily_stats s where s.user_id = p_user and s.day = g.d::date
                      and coalesce(public.stat_value(s, p_metric), 0) > 0)
$$;
revoke execute on function public.challenge_streak(uuid, text, date, date) from public, anon, authenticated;

-- 4. ACTIONS --------------------------------------------------------------
-- Invite 1 to 6 friends (people you compete with) to a stat for p_days days.
create or replace function public.create_challenge(p_metric text, p_people uuid[], p_days integer)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.app_today();
  ppl uuid[];
  p uuid;
  new_id bigint;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not (p_metric = any (public.compete_fields())) then raise exception 'Pick a stat to compete on.'; end if;
  if p_days is null or p_days not between 1 and 30 then raise exception 'Pick between 1 and 30 days.'; end if;
  select array_agg(distinct x) into ppl from unnest(coalesce(p_people, '{}'::uuid[])) x where x is not null and x <> me;
  if ppl is null then raise exception 'Pick at least one friend.'; end if;
  if cardinality(ppl) > 6 then raise exception 'Up to 6 friends per challenge.'; end if;
  foreach p in array ppl loop
    if public.is_blocked(me, p) or not exists (
         select 1 from connections where kind = 'compete' and status = 'active'
            and ((owner_id = me and other_id = p) or (owner_id = p and other_id = me))) then
      raise exception 'You can only challenge your friends.';
    end if;
  end loop;
  perform public.lock_people(me);
  if (select count(*) from challenges where creator_id = me and status = 'open' and ends_on >= today) >= 5 then
    raise exception 'You already have 5 challenges going. Wait for one to end.';
  end if;
  insert into challenges (creator_id, metric, starts_on, ends_on)
  values (me, p_metric, today + 1, today + p_days)
  returning id into new_id;
  insert into challenge_members (challenge_id, user_id, status, responded_at) values (new_id, me, 'joined', now());
  insert into challenge_members (challenge_id, user_id) select new_id, unnest(ppl);
  return new_id;
end $$;

-- Join or decline. You can join any time before it ends; every day counts.
create or replace function public.respond_challenge(p_id bigint, p_join boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.app_today();
  c challenges%rowtype;
  st text;
begin
  select * into c from challenges where id = p_id;
  select status into st from challenge_members where challenge_id = p_id and user_id = me for update;
  if not found or st <> 'invited' or c.status <> 'open' or c.ends_on < today then
    raise exception 'This challenge is no longer open.';
  end if;
  if p_join then
    perform public.lock_people(me);
    if (select count(*) from challenge_members m join challenges x on x.id = m.challenge_id
         where m.user_id = me and m.status = 'joined' and x.status = 'open' and x.ends_on >= today) >= 10 then
      raise exception 'You''re already in 10 challenges. Wait for one to end.';
    end if;
  end if;
  update challenge_members set status = case when p_join then 'joined' else 'declined' end, responded_at = now()
   where challenge_id = p_id and user_id = me;
end $$;

-- Leave a challenge that hasn't ended. Your numbers leave the board.
create or replace function public.leave_challenge(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  update challenge_members m set status = 'left', responded_at = now()
    from challenges c
   where m.challenge_id = p_id and m.user_id = me and m.status = 'joined'
     and c.id = m.challenge_id and c.status = 'open' and c.ends_on >= public.app_today();
  if not found then raise exception 'You can''t leave this one.'; end if;
end $$;

-- The creator can call it off before it starts.
create or replace function public.cancel_challenge(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update challenges set status = 'cancelled'
   where id = p_id and creator_id = auth.uid() and status = 'open' and starts_on > public.app_today();
  if not found then raise exception 'Only whoever started it can cancel, and only before day one.'; end if;
end $$;

create or replace function public.mark_challenge_seen(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update challenge_members set result_seen = true where challenge_id = p_id and user_id = auth.uid()
$$;

-- Lock the results of your challenges that ended at least two days ago.
-- Totals, ranks, the rank before the last day (for the ▲▼ arrows) and the
-- closing streak are stored, so results outlive the daily numbers.
create or replace function public.finalize_my_challenges()
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.app_today();
  c challenges%rowtype;
  n integer := 0;
begin
  if me is null then return 0; end if;
  for c in
    select ch.* from challenges ch
     where ch.status = 'open' and ch.finalized_at is null and ch.ends_on <= today - 2
       and exists (select 1 from challenge_members m where m.challenge_id = ch.id and m.user_id = me)
     for update skip locked
  loop
    with t as (
      select m.user_id,
             public.challenge_total(m.user_id, c.metric, c.starts_on, c.ends_on) as total,
             case when c.ends_on > c.starts_on then public.challenge_total(m.user_id, c.metric, c.starts_on, c.ends_on - 1) end as prev,
             public.challenge_streak(m.user_id, c.metric, c.starts_on, c.ends_on) as streak
        from challenge_members m where m.challenge_id = c.id and m.status = 'joined'
    ), r as (
      select user_id, total, streak,
             case when total is null then null else rank() over (order by total desc nulls last) end as rk,
             case when prev is null then null else rank() over (order by prev desc nulls last) end as prk
        from t
    )
    update challenge_members m
       set final_total = r.total, final_rank = r.rk, prev_rank = r.prk, final_streak = r.streak
      from r where m.challenge_id = c.id and m.user_id = r.user_id;
    update challenges set finalized_at = now() where id = c.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- 5. READS ----------------------------------------------------------------
-- Daily numbers for challenges you joined that are running or awaiting
-- results: only the challenge stat, only its days, only people who joined.
create or replace function public.challenge_board()
returns table (challenge_id bigint, user_id uuid, day date, value numeric)
language sql stable security definer set search_path = public as $$
  select c.id, m.user_id, s.day, public.stat_value(s, c.metric)
    from challenges c
    join challenge_members mine on mine.challenge_id = c.id and mine.user_id = auth.uid() and mine.status = 'joined'
    join challenge_members m on m.challenge_id = c.id and m.status = 'joined'
    join daily_stats s on s.user_id = m.user_id and s.day between c.starts_on and least(c.ends_on, public.app_today())
   where c.status = 'open' and c.finalized_at is null and c.starts_on <= public.app_today()
     and (m.user_id = auth.uid() or not public.is_blocked(m.user_id, auth.uid()))
$$;

-- Locked results for challenges you finished in.
create or replace function public.challenge_results()
returns table (challenge_id bigint, user_id uuid, total numeric, rank integer, prev_rank integer, streak integer)
language sql stable security definer set search_path = public as $$
  select m.challenge_id, m.user_id, m.final_total, m.final_rank, m.prev_rank, m.final_streak
    from challenges c
    join challenge_members mine on mine.challenge_id = c.id and mine.user_id = auth.uid() and mine.status = 'joined'
    join challenge_members m on m.challenge_id = c.id and m.status = 'joined'
   where c.finalized_at is not null
     and (m.user_id = auth.uid() or not public.is_blocked(m.user_id, auth.uid()))
$$;

-- People you share a challenge with now show up by name too.
create or replace function public.friend_people()
returns table (id uuid, username text, full_name text, xp integer)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  ids as (
    select case when owner_id = (select id from me) then other_id else owner_id end as uid
      from connections where (select id from me) in (owner_id, other_id)
    union select case when challenger_id = (select id from me) then opponent_id else challenger_id end
      from duels where (select id from me) in (challenger_id, opponent_id)
    union select m.user_id from challenge_members m
      where public.in_challenge(m.challenge_id)
    union select creator_id from challenges where public.in_challenge(id)
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

-- 6. NUDGES ---------------------------------------------------------------
alter table nudges add column if not exists challenge_id bigint references challenges(id) on delete cascade;
drop function if exists public.send_nudge(uuid, text, bigint);
create or replace function public.send_nudge(p_to uuid, p_kind text, p_duel bigint default null, p_challenge bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.app_today();
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_kind in ('taunt', 'rally') then
    if public.is_blocked(me, p_to) or not exists (
         select 1 from challenges c where c.id = p_challenge and c.status = 'open' and today between c.starts_on and c.ends_on
            and exists (select 1 from challenge_members m where m.challenge_id = c.id and m.user_id = me and m.status = 'joined')
            and exists (select 1 from challenge_members m where m.challenge_id = c.id and m.user_id = p_to and m.status = 'joined')) then
      raise exception 'Not in a running challenge with them.';
    end if;
  elsif p_kind = 'check_in' then
    if not exists (select 1 from connections where kind = 'share' and status = 'active' and owner_id = p_to and other_id = me
                    and (ends_at is null or ends_at > now())) then
      raise exception 'They don''t share with you.';
    end if;
  else
    raise exception 'Unknown nudge.';
  end if;
  insert into nudges (from_id, to_id, kind, challenge_id)
  values (me, p_to, p_kind, case when p_kind = 'check_in' then null else p_challenge end)
  on conflict (from_id, to_id, kind, sent_on) do nothing;
end $$;

-- 7. BLOCKS ---------------------------------------------------------------
-- Blocking someone declines open invites between you. Boards already hide
-- each of you from the other.
create or replace function public.challenge_block_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update challenge_members m set status = 'declined', responded_at = now()
    from challenges c
   where c.id = m.challenge_id and m.status = 'invited'
     and ((m.user_id = new.blocked_id and c.creator_id = new.blocker_id)
       or (m.user_id = new.blocker_id and c.creator_id = new.blocked_id));
  return new;
end $$;
drop trigger if exists challenge_block_cleanup on blocks;
create trigger challenge_block_cleanup after insert on blocks
  for each row execute function public.challenge_block_cleanup();

-- 8. DUELS BECOME CHALLENGES -----------------------------------------------
insert into challenges (creator_id, metric, starts_on, ends_on, from_duel, created_at)
select d.challenger_id, d.metric, d.starts_on, d.ends_on, d.id, d.created_at
  from duels d
 where (d.status = 'active' or (d.status = 'pending' and d.ends_on >= public.app_today()))
   and d.ends_on - d.starts_on <= 29
   and not exists (select 1 from challenges c where c.from_duel = d.id);
insert into challenge_members (challenge_id, user_id, status, invited_at, responded_at)
select c.id, d.challenger_id, 'joined', d.created_at, d.created_at
  from challenges c join duels d on d.id = c.from_duel
on conflict do nothing;
insert into challenge_members (challenge_id, user_id, status, invited_at, responded_at)
select c.id, d.opponent_id, case when d.status = 'active' then 'joined' else 'invited' end, d.created_at, d.responded_at
  from challenges c join duels d on d.id = c.from_duel
on conflict do nothing;

-- 9. GRANTS ---------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'create_challenge(text, uuid[], integer)', 'respond_challenge(bigint, boolean)', 'leave_challenge(bigint)',
    'cancel_challenge(bigint)', 'mark_challenge_seen(bigint)', 'finalize_my_challenges()', 'challenge_board()',
    'challenge_results()', 'friend_people()', 'send_nudge(uuid, text, bigint, bigint)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  -- No new duels; the duel tables stay as history.
  foreach fn in array array[
    'send_duel(text, text, integer)', 'respond_duel(bigint, boolean)', 'cancel_duel(bigint)',
    'revise_duel(bigint, text, integer)', 'duel_board()'
  ] loop
    begin
      execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    exception when undefined_function then null;
    end;
  end loop;
end $$;
revoke execute on function public.challenge_block_cleanup() from public, anon, authenticated;
