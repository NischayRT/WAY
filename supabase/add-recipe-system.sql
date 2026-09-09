-- ============================================================
-- Recipe-based custom dishes
-- - ingredients: raw ingredient nutrition DB (per 100g)
-- - dish_ingredients: recipe lines linking a food to its ingredients
-- - foods: gains dish-type tags + the raw/final weights used to
--   derive its nutrition, when built via the recipe calculator
-- ============================================================

-- 1. INGREDIENTS ---------------------------------------------------
create table if not exists ingredients (
  id bigint generated always as identity primary key,
  name text not null unique,
  category text, -- grain, lentil, vegetable, dairy, oil_fat, meat, spice, sweetener, other
  calories_kcal numeric not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  fiber_g numeric default 0,
  source text default 'community_estimated'
    check (source in ('ifct_2017', 'usda', 'community_estimated')),
  created_at timestamptz default now()
);

create index if not exists idx_ingredients_name on ingredients using gin (to_tsvector('english', name));

alter table ingredients enable row level security;

-- Shared reference data — everyone can read, only admins add
-- (via SQL editor, which uses a role that bypasses RLS).
create policy "Anyone can view ingredients"
  on ingredients for select using (true);

-- 2. DISH TYPE TAGS + RECIPE WEIGHTS ON FOODS -----------------------
alter table foods add column if not exists cooking_method text
  check (cooking_method in (
    'curry', 'dry_curry', 'deep_fried', 'shallow_fried', 'baked', 'grilled',
    'steamed', 'boiled', 'roasted', 'stir_fried', 'raw', 'fermented', 'pickled'
  ));

alter table foods add column if not exists dish_class text
  check (dish_class in (
    'main', 'snack', 'dessert', 'beverage', 'bread', 'rice_dish',
    'soup_stew', 'dairy', 'condiment', 'leftover'
  ));

alter table foods add column if not exists raw_weight_g numeric;
alter table foods add column if not exists final_weight_g numeric;

-- Allow a new source value for dishes computed from a recipe.
alter table foods drop constraint if exists foods_source_check;
alter table foods add constraint foods_source_check
  check (source in ('ifct_2017', 'usda', 'community_estimated', 'user_calculated'));

-- 3. DISH_INGREDIENTS (recipe lines) ---------------------------------
create table if not exists dish_ingredients (
  id bigint generated always as identity primary key,
  food_id bigint not null references foods(id) on delete cascade,
  ingredient_id bigint not null references ingredients(id),
  quantity_g numeric not null,
  created_at timestamptz default now()
);

alter table dish_ingredients enable row level security;

create policy "View recipe lines for visible foods"
  on dish_ingredients for select
  using (
    exists (
      select 1 from foods
      where foods.id = dish_ingredients.food_id
        and (foods.created_by is null or foods.created_by = auth.uid())
    )
  );

create policy "Add recipe lines to own foods"
  on dish_ingredients for insert
  with check (
    exists (
      select 1 from foods
      where foods.id = dish_ingredients.food_id
        and foods.created_by = auth.uid()
    )
  );

create policy "Update recipe lines on own foods"
  on dish_ingredients for update
  using (
    exists (
      select 1 from foods
      where foods.id = dish_ingredients.food_id
        and foods.created_by = auth.uid()
    )
  );

create policy "Delete recipe lines on own foods"
  on dish_ingredients for delete
  using (
    exists (
      select 1 from foods
      where foods.id = dish_ingredients.food_id
        and foods.created_by = auth.uid()
    )
  );
