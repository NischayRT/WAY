-- ============================================================
-- Diet App — Phase 1 Schema
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. PROFILES ---------------------------------------------------
-- One row per user, linked to Supabase auth.users via id.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  height_cm numeric not null,
  weight_kg numeric not null,
  age int not null,
  sex text not null check (sex in ('male', 'female')),
  activity_level text not null default 'moderate'
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null default 'maintain'
    check (goal in ('lose_weight', 'gain_muscle', 'lean_mass', 'improve_cardio', 'maintain')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. FOODS --------------------------------------------------------
-- Indian food nutrition database. Values are per 100g unless noted.
create table if not exists foods (
  id bigint generated always as identity primary key,
  name text not null,
  region text,               -- e.g. 'Punjab', 'Kerala', 'Manipur'
  category text,             -- e.g. 'main', 'snack', 'beverage', 'sweet'
  calories_kcal numeric not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  fiber_g numeric,
  serving_size_g numeric default 100,
  source text default 'community_estimated'
    check (source in ('ifct_2017', 'usda', 'community_estimated')),
  created_at timestamptz default now()
);

create index if not exists idx_foods_name on foods using gin (to_tsvector('english', name));
create index if not exists idx_foods_region on foods (region);

-- 3. LOGS -----------------------------------------------------------
-- Daily food entries per user.
create table if not exists food_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  food_id bigint not null references foods(id),
  logged_at date not null default current_date,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity_g numeric not null default 100,
  created_at timestamptz default now()
);

-- Optional: daily weight tracking, used later for adaptive calibration (phase 3).
create table if not exists weight_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  weight_kg numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz default now()
);

-- ============================================================
-- Row-Level Security — users only see their own data
-- ============================================================
alter table profiles enable row level security;
alter table food_logs enable row level security;
alter table weight_logs enable row level security;
-- foods table stays public-read, no RLS needed (shared reference data)

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can view own food logs"
  on food_logs for select using (auth.uid() = user_id);
create policy "Users can insert own food logs"
  on food_logs for insert with check (auth.uid() = user_id);
create policy "Users can delete own food logs"
  on food_logs for delete using (auth.uid() = user_id);

create policy "Users can view own weight logs"
  on weight_logs for select using (auth.uid() = user_id);
create policy "Users can insert own weight logs"
  on weight_logs for insert with check (auth.uid() = user_id);
