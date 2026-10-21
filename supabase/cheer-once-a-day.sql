-- =====================================================================
-- One cheer per person per day (India time), wherever it's given (Live feed
-- or Your people). Tapping again on the same cheer still undoes it.
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- =====================================================================

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
  -- Same cheer again: undo it.
  if exists (select 1 from cheers where from_id = me and event_key = p_key) then
    delete from cheers where from_id = me and event_key = p_key;
    return false;
  end if;
  -- A different cheer for the same person today: not allowed.
  if exists (select 1 from cheers where from_id = me and to_id = p_to
             and (created_at at time zone 'Asia/Kolkata')::date = today) then
    raise exception 'You already cheered them today.';
  end if;
  insert into cheers (from_id, to_id, event_key) values (me, p_to, p_key);
  return true;
end $$;

revoke execute on function public.toggle_cheer(uuid, text) from public, anon;
grant execute on function public.toggle_cheer(uuid, text) to authenticated;
