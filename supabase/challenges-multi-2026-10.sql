-- =====================================================================
-- Challenges with several stats (October 2026). Run once in Supabase →
-- SQL Editor, after challenges-2026-10.sql. Safe to re-run.
--
--  1. Friends limit is 4 (family stays at 3). People already above it keep
--     their friends; they just can't add more until they're under 4.
--  2. A challenge can cover 1 to 5 stats. Each stat has its own board; the
--     app names an overall winner by stats won.
--  3. Results are stored per stat.
-- =====================================================================

-- 1. FRIENDS LIMIT 4 ------------------------------------------------------
create or replace function public.check_circle(p_me uuid, p_them uuid, p_kind text)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  word text := case when p_kind = 'compete' then 'friends' else 'family members' end;
  cap integer := case when p_kind = 'compete' then 4 else 3 end;
begin
  if public.circle_count(p_me, p_kind, p_them) >= cap then
    raise exception 'You already have % %. Remove one to add someone new.', cap, word;
  end if;
  if public.circle_count(p_them, p_kind, p_me) >= cap then
    raise exception 'They already have % %.', cap, word;
  end if;
end $$;
revoke execute on function public.check_circle(uuid, uuid, text) from public, anon, authenticated;

-- 2. SEVERAL STATS --------------------------------------------------------
alter table challenges add column if not exists metrics text[];
update challenges set metrics = array[metric] where metrics is null;
alter table challenges alter column metrics set not null;
alter table challenges drop constraint if exists challenges_metrics_check;
alter table challenges add constraint challenges_metrics_check
  check (cardinality(metrics) between 1 and 5 and metrics <@ public.compete_fields() and metric = metrics[1]);

-- Per-stat results, filled when a challenge locks.
create table if not exists challenge_scores (
  challenge_id bigint not null references challenges(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  metric text not null,
  total numeric,
  rank integer,
  prev_rank integer,
  streak integer,
  primary key (challenge_id, user_id, metric)
);
alter table challenge_scores enable row level security;
-- No policies: read through challenge_results() only.
revoke all on challenge_scores from anon, authenticated;
insert into challenge_scores (challenge_id, user_id, metric, total, rank, prev_rank, streak)
select m.challenge_id, m.user_id, c.metric, m.final_total, m.final_rank, m.prev_rank, m.final_streak
  from challenge_members m join challenges c on c.id = m.challenge_id
 where c.finalized_at is not null and m.status = 'joined'
on conflict do nothing;

-- Invite 1 to 4 friends to 1 to 5 stats for p_days days.
create or replace function public.create_challenge(p_metrics text[], p_people uuid[], p_days integer)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.app_today();
  stats text[];
  ppl uuid[];
  p uuid;
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
  if ppl is null then raise exception 'Pick at least one friend.'; end if;
  if cardinality(ppl) > 4 then raise exception 'Up to 4 friends per challenge.'; end if;
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
  insert into challenges (creator_id, metric, metrics, starts_on, ends_on)
  values (me, stats[1], stats, today + 1, today + p_days)
  returning id into new_id;
  insert into challenge_members (challenge_id, user_id, status, responded_at) values (new_id, me, 'joined', now());
  insert into challenge_members (challenge_id, user_id) select new_id, unnest(ppl);
  return new_id;
end $$;

-- The one-stat version stays for any open tab still running the old page.
create or replace function public.create_challenge(p_metric text, p_people uuid[], p_days integer)
returns bigint language sql security definer set search_path = public as $$
  select public.create_challenge(array[p_metric], p_people, p_days)
$$;

-- Lock results per stat for your challenges that ended at least two days ago.
create or replace function public.finalize_my_challenges()
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.app_today();
  c challenges%rowtype;
  st text;
  n integer := 0;
begin
  if me is null then return 0; end if;
  for c in
    select ch.* from challenges ch
     where ch.status = 'open' and ch.finalized_at is null and ch.ends_on <= today - 2
       and exists (select 1 from challenge_members m where m.challenge_id = ch.id and m.user_id = me)
     for update skip locked
  loop
    foreach st in array c.metrics loop
      insert into challenge_scores (challenge_id, user_id, metric, total, rank, prev_rank, streak)
      select c.id, t.user_id, st, t.total,
             case when t.total is null then null else rank() over (order by t.total desc nulls last) end,
             case when t.prev is null then null else rank() over (order by t.prev desc nulls last) end,
             t.streak
        from (
          select m.user_id,
                 public.challenge_total(m.user_id, st, c.starts_on, c.ends_on) as total,
                 case when c.ends_on > c.starts_on then public.challenge_total(m.user_id, st, c.starts_on, c.ends_on - 1) end as prev,
                 public.challenge_streak(m.user_id, st, c.starts_on, c.ends_on) as streak
            from challenge_members m where m.challenge_id = c.id and m.status = 'joined'
        ) t
      on conflict (challenge_id, user_id, metric) do update
        set total = excluded.total, rank = excluded.rank, prev_rank = excluded.prev_rank, streak = excluded.streak;
    end loop;
    update challenges set finalized_at = now() where id = c.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Daily numbers per stat for challenges you joined (running or awaiting
-- results): only its stats, only its days, only people who joined.
drop function if exists public.challenge_board();
create function public.challenge_board()
returns table (challenge_id bigint, user_id uuid, metric text, day date, value numeric)
language sql stable security definer set search_path = public as $$
  select c.id, m.user_id, st, s.day, public.stat_value(s, st)
    from challenges c
    cross join lateral unnest(c.metrics) st
    join challenge_members mine on mine.challenge_id = c.id and mine.user_id = auth.uid() and mine.status = 'joined'
    join challenge_members m on m.challenge_id = c.id and m.status = 'joined'
    join daily_stats s on s.user_id = m.user_id and s.day between c.starts_on and least(c.ends_on, public.app_today())
   where c.status = 'open' and c.finalized_at is null and c.starts_on <= public.app_today()
     and (m.user_id = auth.uid() or not public.is_blocked(m.user_id, auth.uid()))
$$;

-- Locked results per stat for challenges you finished in.
drop function if exists public.challenge_results();
create function public.challenge_results()
returns table (challenge_id bigint, user_id uuid, metric text, total numeric, rank integer, prev_rank integer, streak integer)
language sql stable security definer set search_path = public as $$
  select sc.challenge_id, sc.user_id, sc.metric, sc.total, sc.rank, sc.prev_rank, sc.streak
    from challenge_scores sc
    join challenges c on c.id = sc.challenge_id and c.finalized_at is not null
    join challenge_members mine on mine.challenge_id = c.id and mine.user_id = auth.uid() and mine.status = 'joined'
    join challenge_members m on m.challenge_id = c.id and m.user_id = sc.user_id and m.status = 'joined'
   where sc.user_id = auth.uid() or not public.is_blocked(sc.user_id, auth.uid())
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'create_challenge(text[], uuid[], integer)', 'create_challenge(text, uuid[], integer)',
    'finalize_my_challenges()', 'challenge_board()', 'challenge_results()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
