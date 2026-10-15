-- =====================================================================
-- WAY Studio: security hardening for tables created outside schema.sql.
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- google_health_connections (and the old strava_connections) hold OAuth
-- tokens. They were created in the dashboard, so their Row Level Security
-- isn't in version control. This makes sure RLS is ON and that each user can
-- only ever touch their own row. (The tokens themselves are also encrypted by
-- the app since this release: see src/lib/tokenCrypto.js.)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['google_health_connections', 'strava_connections'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);

    execute format('drop policy if exists %I on public.%I', t || '_own_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', t || '_own_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', t || '_own_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', t || '_own_delete', t);
  end loop;
end $$;

-- Quick check: every table in "public" should show rls_enabled = true.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by rls_enabled, table_name;
