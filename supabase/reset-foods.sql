-- ============================================================
-- WARNING: destructive. This deletes:
--   - ALL rows in food_logs (your entire logged history) — required
--     because food_logs.food_id has no ON DELETE CASCADE, so it
--     would block deleting foods otherwise.
--   - ALL rows in foods (canonical + everyone's custom dishes).
-- dish_ingredients rows delete automatically via their own
-- ON DELETE CASCADE when their parent food is removed.
-- ingredients and profiles are NOT touched.
-- ============================================================

delete from food_logs;
delete from foods;

-- Optional: restarts the id counter so your fresh CSV-driven inserts
-- start counting from 1 again. Safe to skip if you don't care.
alter table foods alter column id restart with 1;
