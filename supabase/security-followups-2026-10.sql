-- =====================================================================
-- Security follow-ups (October 2026). Run once in Supabase → SQL Editor,
-- after security-fixes-2026-10.sql. Safe to re-run.
--
--  1. Per-user rate limits for the routes that call Google
--     (public.hit_rate_limit, used by src/lib/rateLimit.js).
--  2. Nudges: check-ins stop when a share expires; taunts and rallies stop
--     when a duel's last day has passed.
--  3. Limits that two simultaneous requests could slip past are now taken
--     under a lock: the 3-person circle, 20 waiting invites, 10 waiting
--     duel challenges, one cheer per person per day.
-- =====================================================================

-- 1. RATE LIMITS --------------------------------------------------------
create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 0,
  primary key (user_id, bucket)
);
alter table public.api_rate_limits enable row level security;
-- No policies: only the function below touches it.
revoke all on public.api_rate_limits from anon, authenticated;

-- Count one request for the caller in a fixed window. Returns true while the
-- caller is within p_limit. A caller can only ever add to their own count.
create or replace function public.hit_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if me is null then return false; end if;
  if p_bucket !~ '^[a-z_]{1,32}$' or p_limit not between 1 and 100000 or p_window_seconds not between 1 and 86400 then
    raise exception 'Bad rate limit.';
  end if;
  insert into api_rate_limits as r (user_id, bucket, window_start, hits)
  values (me, p_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into n;
  return n <= p_limit;
end $$;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.hit_rate_limit(text, integer, integer) to authenticated;

-- 2. NUDGES -------------------------------------------------------------------
create or replace function public.send_nudge(p_to uuid, p_kind text, p_duel bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if p_kind in ('taunt', 'rally') then
    if not exists (select 1 from duels where id = p_duel and status = 'active' and ends_on >= today
                    and ((challenger_id = me and opponent_id = p_to) or (challenger_id = p_to and opponent_id = me))) then
      raise exception 'Not in a running duel with them.';
    end if;
  elsif p_kind = 'check_in' then
    if not exists (select 1 from connections where kind = 'share' and status = 'active' and owner_id = p_to and other_id = me
                    and (ends_at is null or ends_at > now())) then
      raise exception 'They don''t share with you.';
    end if;
  else
    raise exception 'Unknown nudge.';
  end if;
  insert into nudges (from_id, to_id, kind, duel_id) values (me, p_to, p_kind, p_duel)
  on conflict (from_id, to_id, kind, sent_on) do nothing;
end $$;
revoke execute on function public.send_nudge(uuid, text, bigint) from public, anon;
grant execute on function public.send_nudge(uuid, text, bigint) to authenticated;

-- 3. LIMITS UNDER A LOCK ------------------------------------------------------
-- Advisory locks are held until the transaction ends, so the count and the
-- insert/accept that follows can't interleave with a second request.
create or replace function public.lock_people(a uuid, b uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Always lock in the same order to avoid deadlocks.
  if b is null or a::text < b::text then
    perform pg_advisory_xact_lock(hashtext('person:' || a::text));
    if b is not null then perform pg_advisory_xact_lock(hashtext('person:' || b::text)); end if;
  else
    perform pg_advisory_xact_lock(hashtext('person:' || b::text));
    perform pg_advisory_xact_lock(hashtext('person:' || a::text));
  end if;
end $$;
revoke execute on function public.lock_people(uuid, uuid) from public, anon, authenticated;

-- Circle limit (3) and waiting-invite limit (20), checked under the lock.
create or replace function public.connections_circle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me uuid := coalesce(auth.uid(), new.initiated_by);
  them uuid := case when coalesce(auth.uid(), new.initiated_by) = new.owner_id then new.other_id else new.owner_id end;
begin
  if (tg_op = 'INSERT' and new.status = 'pending')
     or (tg_op = 'UPDATE' and new.status = 'active' and old.status = 'pending') then
    perform public.lock_people(me, them);
    perform public.check_circle(me, them, new.kind);
    if tg_op = 'INSERT' and (select count(*) from connections where initiated_by = new.initiated_by and status = 'pending') >= 20 then
      raise exception 'You have too many invites waiting. Cancel some first.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists connections_circle_guard on connections;
create trigger connections_circle_guard before insert or update of status on connections
  for each row execute function public.connections_circle_guard();

-- Waiting duel challenges (10), checked under the lock.
create or replace function public.duels_pending_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform public.lock_people(new.challenger_id);
    if (select count(*) from duels where challenger_id = new.challenger_id and status = 'pending') >= 10 then
      raise exception 'You have too many challenges waiting.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists duels_pending_guard on duels;
create trigger duels_pending_guard before insert on duels
  for each row execute function public.duels_pending_guard();

-- One cheer per person per day, under the lock (key binding from security-fixes kept).
create or replace function public.toggle_cheer(p_to uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if me is null then raise exception 'Not signed in'; end if;
  perform public.lock_people(me);
  if not exists (select 1 from connections where kind = 'compete' and status = 'active'
                  and ((owner_id = me and other_id = p_to) or (owner_id = p_to and other_id = me))) then
    raise exception 'You can only cheer people you compete with.';
  end if;
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
revoke execute on function public.toggle_cheer(uuid, text) from public, anon;
grant execute on function public.toggle_cheer(uuid, text) to authenticated;
