-- ============================================================
-- Raw ingredient database — per 100g, uncooked/raw form.
-- These are the building blocks the recipe calculator uses;
-- community-estimated, refine with IFCT values over time.
-- ============================================================

insert into ingredients (name, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g)
values
  ('Rice (raw)', 'grain', 345, 6.8, 78.0, 0.5, 1.0),
  ('Wheat flour (atta)', 'grain', 341, 12.0, 69.0, 1.7, 11.0),
  ('Toor dal (raw)', 'lentil', 335, 22.0, 57.0, 1.5, 15.0),
  ('Moong dal (raw)', 'lentil', 334, 24.0, 56.0, 1.2, 16.0),
  ('Chana dal (raw)', 'lentil', 364, 20.8, 61.0, 5.6, 12.0),
  ('Urad dal (raw)', 'lentil', 341, 25.0, 59.0, 1.6, 18.0),
  ('Besan (gram flour)', 'grain', 387, 22.0, 58.0, 6.7, 11.0),
  ('Refined oil', 'oil_fat', 884, 0, 0, 100.0, 0),
  ('Mustard oil', 'oil_fat', 884, 0, 0, 100.0, 0),
  ('Ghee', 'oil_fat', 900, 0, 0, 99.5, 0),
  ('Coconut oil', 'oil_fat', 862, 0, 0, 99.0, 0),
  ('Butter', 'oil_fat', 717, 0.9, 0.1, 81.0, 0),
  ('Paneer', 'dairy', 265, 18.3, 1.2, 20.8, 0),
  ('Milk (whole)', 'dairy', 61, 3.2, 4.8, 3.3, 0),
  ('Curd (plain)', 'dairy', 61, 3.5, 4.7, 3.3, 0),
  ('Potato (raw)', 'vegetable', 77, 2.0, 17.0, 0.1, 2.2),
  ('Onion (raw)', 'vegetable', 40, 1.1, 9.3, 0.1, 1.7),
  ('Tomato (raw)', 'vegetable', 18, 0.9, 3.9, 0.2, 1.2),
  ('Garlic', 'vegetable', 149, 6.4, 33.0, 0.5, 2.1),
  ('Ginger', 'vegetable', 80, 1.8, 18.0, 0.8, 2.0),
  ('Green chilli', 'vegetable', 40, 2.0, 9.0, 0.2, 1.5),
  ('Cauliflower', 'vegetable', 25, 1.9, 5.0, 0.3, 2.0),
  ('Brinjal (eggplant)', 'vegetable', 24, 1.0, 5.7, 0.2, 3.0),
  ('Okra (bhindi)', 'vegetable', 33, 1.9, 7.5, 0.2, 3.2),
  ('Spinach (palak)', 'vegetable', 23, 2.9, 3.6, 0.4, 2.2),
  ('Green peas', 'vegetable', 81, 5.4, 14.0, 0.4, 5.1),
  ('Carrot', 'vegetable', 41, 0.9, 9.6, 0.2, 2.8),
  ('Chicken (raw, boneless)', 'meat', 165, 31.0, 0, 3.6, 0),
  ('Mutton (raw)', 'meat', 258, 25.0, 0, 17.0, 0),
  ('Egg (whole, raw)', 'meat', 155, 13.0, 1.1, 11.0, 0),
  ('Fish (rohu, raw)', 'meat', 97, 16.6, 0, 3.3, 0),
  ('Sugar', 'sweetener', 387, 0, 100.0, 0, 0),
  ('Jaggery', 'sweetener', 383, 0.4, 98.0, 0.1, 0),
  ('Coconut (fresh, grated)', 'other', 354, 3.3, 15.0, 33.0, 9.0),
  ('Coconut milk', 'other', 230, 2.3, 5.5, 24.0, 0),
  ('Water', 'other', 0, 0, 0, 0, 0);
