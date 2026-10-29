-- =====================================================================
-- Display units (October 2026). Run once in Supabase → SQL Editor. Safe to
-- re-run. Everything is still stored in cm and kg; this only remembers how
-- each person wants to see and type height, weight and body measurements,
-- so the choice follows them to every device.
--   {"height": "cm" | "ftin", "weight": "kg" | "lb", "length": "cm" | "in"}
-- profiles already lets people update only their own row (RLS).
-- =====================================================================
alter table profiles add column if not exists units jsonb not null default '{}'::jsonb;
alter table profiles drop constraint if exists profiles_units_check;
alter table profiles add constraint profiles_units_check check (
  jsonb_typeof(units) = 'object'
  and (units ->> 'height' is null or units ->> 'height' in ('cm', 'ftin'))
  and (units ->> 'weight' is null or units ->> 'weight' in ('kg', 'lb'))
  and (units ->> 'length' is null or units ->> 'length' in ('cm', 'in'))
  -- Only these three keys (each optional).
  and units - array['height', 'weight', 'length'] = '{}'::jsonb
);
