-- =====================================================================
-- Compete rules (October 2026). Run once in Supabase → SQL Editor, after
-- challenges-multi-2026-10.sql. Safe to re-run.
--
--  1. Challenges can include friends or family. In a group (3 or more
--     people), everyone has to be friends or family with everyone else,
--     so nobody ends up comparing numbers with a stranger.
--  2. One challenge at a time per pair of people: you can't challenge
--     someone you're already in a challenge with (waiting or running) until
--     it ends, is cancelled, or one of you leaves or declines.
--  3. Whoever started a challenge can cancel it any time before it ends
--     (before, only before day one).
-- =====================================================================

-- Friends (compete) or family (an active share, either direction), and no block.
create or replace function public.are_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select a <> b and not public.is_blocked(a, b) and exists (
    select 1 from connections c
     where c.status = 'active'
       and ((c.owner_id = a and c.other_id = b) or (c.owner_id = b and c.other_id = a))
       and (c.kind = 'compete' or c.ends_at is null or c.ends_at > now())
  )
$$;
revoke execute on function public.are_connected(uuid, uuid) from public, anon, authenticated;

-- An open challenge (waiting or running) that both people are in, joined or
-- still invited. Returns its id, or null.
create or replace function public.shared_open_challenge(a uuid, b uuid, p_except bigint default null)
returns bigint language sql stable security definer set search_path = public as $$
  select c.id
    from challenges c
    join challenge_members ma on ma.challenge_id = c.id and ma.user_id = a and ma.status in ('joined', 'invited')
    join challenge_members mb on mb.challenge_id = c.id and mb.user_id = b and mb.status in ('joined', 'invited')
   where c.status = 'open' and c.ends_on >= public.app_today()
     and (p_except is null or c.id <> p_except)
   limit 1
$$;
revoke execute on function public.shared_open_challenge(uuid, uuid, bigint) from public, anon, authenticated;

create or replace function public.short_name(p uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(coalesce(full_name, ''), ' ', 1), ''), '@' || username, 'them') from profiles where id = p
$$;
revoke execute on function public.short_name(uuid) from public, anon, authenticated;

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

  perform public.lock_people(me);
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

-- Join or decline. Joining is refused if it would put you in a second
-- challenge with anyone already in this one.
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

-- Whoever started it can cancel it any time before it ends. No results are kept.
create or replace function public.cancel_challenge(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update challenges set status = 'cancelled'
   where id = p_id and creator_id = auth.uid() and status = 'open' and ends_on >= public.app_today();
  if not found then raise exception 'Only whoever started it can cancel it, and only before it ends.'; end if;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array['create_challenge(text[], uuid[], integer)', 'respond_challenge(bigint, boolean)', 'cancel_challenge(bigint)'] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
