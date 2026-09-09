-- ============================================================
-- Weight tracking — one entry per user per day (re-logging the
-- same day updates instead of creating a duplicate row).
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weight_logs_user_date_unique'
  ) then
    alter table weight_logs add constraint weight_logs_user_date_unique unique (user_id, logged_at);
  end if;
end $$;

-- The original schema only had select/insert policies for weight_logs;
-- upsert needs update permission too for the conflict-resolution path.
create policy "Users can update own weight logs"
  on weight_logs for update
  using (auth.uid() = user_id);
