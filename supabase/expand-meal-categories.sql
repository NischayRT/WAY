-- ============================================================
-- Expand meal categories beyond the original 4, to support
-- mid-day snacks, evening snacks, and beverages as their own
-- trackable sections on the dashboard.
-- ============================================================

alter table food_logs drop constraint if exists food_logs_meal_type_check;
alter table food_logs add constraint food_logs_meal_type_check
  check (meal_type in (
    'breakfast', 'mid_day_snack', 'lunch', 'evening_snack', 'dinner', 'beverage', 'other'
  ));
