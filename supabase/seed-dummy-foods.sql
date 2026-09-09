-- ============================================================
-- Dummy food data — for testing the logging UI only.
-- Replace with real IFCT-sourced data once the UI is validated.
-- Values are per 100g.
-- ============================================================

insert into foods (name, region, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source)
values
  ('Roti (whole wheat)', 'Pan-Indian', 'main', 297, 11.0, 58.0, 3.7, 10.0, 'community_estimated'),
  ('Dal Tadka', 'Pan-Indian', 'main', 116, 7.0, 15.0, 3.5, 5.0, 'community_estimated'),
  ('Paneer Butter Masala', 'Punjab', 'main', 245, 10.5, 8.0, 19.0, 1.5, 'community_estimated'),
  ('Idli', 'Tamil Nadu', 'main', 132, 4.0, 26.0, 0.5, 1.0, 'community_estimated'),
  ('Sambar', 'Tamil Nadu', 'main', 95, 4.5, 12.0, 3.0, 3.0, 'community_estimated'),
  ('Chicken Curry', 'Pan-Indian', 'main', 180, 18.0, 5.0, 10.0, 1.0, 'community_estimated'),
  ('Plain Rice (cooked)', 'Pan-Indian', 'main', 130, 2.7, 28.0, 0.3, 0.4, 'community_estimated'),
  ('Masala Dosa', 'Karnataka', 'main', 168, 3.9, 27.0, 5.2, 1.5, 'community_estimated'),
  ('Chana Masala', 'Punjab', 'main', 164, 8.0, 24.0, 4.5, 7.0, 'community_estimated'),
  ('Curd (plain)', 'Pan-Indian', 'beverage', 61, 3.5, 4.7, 3.3, 0, 'community_estimated');
