# Diet App

**Indian-food-focused macro tracking, with a body you can actually see change.**

This is a Next.js app for tracking daily nutrition the way people in India actually
eat — proper portions (katori, roti, piece — not just grams), goal-aware calorie
and protein targets, and a 3D "Physique Studio" that shows you a current-vs-target
body comparison instead of just a number on a scale.

It's built to feel less like a spreadsheet and more like something that
understands your goal, whether that's losing weight, building muscle, leaning
out, or just eating a bit more consistently.

---

## What's inside

### Daily tracking
- Log meals against categories that match how Indian meals are actually
  structured: breakfast, mid-day snack, lunch, evening snack, dinner, beverage.
- A content-based recommender suggests foods that fit whatever's *left* in your
  day's macros — not a generic "eat more protein" nudge, but foods whose actual
  macro shape matches your remaining calories/protein/carbs/fat.
- A recipe calculator that takes raw ingredient quantities plus the dish's final
  cooked weight and works out accurate per-100g nutrition — so a dal or curry
  that loses or gains water weight during cooking still gets a correct number,
  without needing a separate "cooking method" adjustment.

### Goals & targets
- BMR via Mifflin-St Jeor, TDEE via activity multiplier, and macro targets that
  shift with your goal (lose weight, gain muscle, lean-mass recomposition,
  improve cardio, or maintain) — each goal has its own calorie offset and
  protein-per-kg target, not one-size-fits-all.
- Manual overrides: if you (or a coach) want to hand-set your calorie or macro
  targets instead of the calculated defaults, those take priority automatically.
- A feasibility check runs behind any weight goal — it flags rates of loss/gain
  that exceed safe clinical thresholds, calorie floors that dip too low, or a
  target body fat % that creeps toward essential-fat territory, before you
  commit to a timeline.

### Physique Studio
The part that makes this more than a numbers app: a side-by-side 3D comparison
of your current body and your target goal, rendered from real body-composition
math rather than a generic avatar.

- Current body fat % is estimated from actual measurements (waist, neck,
  height) using the US Navy body-fat formula — not guessed.
- Your target is projected using realistic body partitioning: losing weight
  isn't 100% fat, and gaining weight isn't 100% muscle. The model splits any
  weight change into a fat component and a lean component and adjusts your
  projected waist, chest, hip, and bicep measurements accordingly.
- Both bodies are matched to one of five sculpted 3D archetypes — Lean/Athletic,
  Overweight/Soft belly, Heavyset/Obese, Muscular/Bodybuilder, and Slim/Skinny —
  chosen by body fat %, with a fat-free-mass-index check to tell "lean and
  muscular" apart from "lean and just thin" at similar body fat levels.
- Each avatar rotates independently on its own base, so you can compare both
  bodies from any angle without them awkwardly orbiting each other.

### Trends & history
- A 7-day macro trend view (calories, protein, carbs, fat) with daily averages.
- A weight log with a trend chart, so progress is visible over weeks, not just
  today.

### Sign-in
- Google sign-in via Supabase Auth. New users go through a short onboarding
  flow that collects the basics (height, weight, age, sex, activity level,
  goal) before landing on their first daily targets.

---

## Tech stack

- **Framework:** Next.js (App Router)
- **Auth & database:** Supabase (Postgres + Auth, Google OAuth provider)
- **Styling:** Tailwind CSS v4, with a shared style dictionary (`lib/ui.js`) and
  a real dark mode (CSS variable overrides, not a filter hack)
- **3D rendering:** `three.js` via `@react-three/fiber` and `@react-three/drei`
- **Icons:** `lucide-react`

---

## Project structure

```
app/
  page.js                 - root redirect: signed-in -> /home, else -> /login
  login/page.js           - Google sign-in
  onboarding/page.js      - first-time profile setup
  home/                   - today's tracking view
  settings/page.js        - profile & body-measurement settings
  weight/page.js          - weight log + trend chart
  trends/page.js          - 7-day macro trend charts
  body-studio/page.js     - the Physique Studio 3D comparison
  api/targets/route.js    - GET current user's daily targets as JSON

components/
  body/
    BodyStudio.js          - orchestrates current-vs-target physique data
    BodyStudioCanvas.js     - the 3D canvas: two independently-rotating avatars
    RealisticAvatar3D.js    - picks + scales one of the 5 sculpted archetypes
    ArchetypeAvatar3D.js    - (legacy path, not currently wired into the canvas)
    Avatar3D.js              - simpler procedural (non-GLB) avatar, if you want
                               a lighter-weight fallback
    BodyMeshCanvas.js        - flat SVG silhouette version (no 3D dependency)
  settings/SettingsClient.js - profile & body-measurement tabs
  layout/AppHeader.js         - shared page header (referenced, not included here)
  weight/, trends/, onboarding/ - form + chart components for those pages

lib/
  bmrTdee.js               - BMR -> TDEE -> goal-adjusted macro targets
  bodyProportions.js       - body-fat estimation + target-physique projection
  physiqueArchetype.js     - maps body composition to one of the 5 3D archetypes
  goalFeasibility.js       - clinical safety checks on a weight-change timeline
  mealBreakdown.js / mealCategories.js - grouping food logs into meal categories
  recipeNutrition.js       - raw-ingredient -> per-100g dish nutrition
  recommend.js             - cosine-similarity food recommender
  weekStatus.js            - daily totals + color-coding for the week view
  dateUtils.js             - small UTC-safe date helpers
  supabaseClient.js / supabaseServer.js - browser vs. server Supabase clients
  ui.js                    - shared Tailwind class tokens (light + dark)

public/models/
  stylized_male_base_mesh_free.glb - the 5-archetype body model used by
                                      RealisticAvatar3D.js
```

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

You'll need `@supabase/ssr`, `@react-three/fiber`, `@react-three/drei`, `three`,
and `lucide-react` alongside Next.js — check `package.json` for exact versions
if you're setting this up from scratch.

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Under **Authentication → Providers**, enable **Google** and add your OAuth
   client ID/secret (from Google Cloud Console). Set the redirect URL to
   `<your-app-url>/auth/callback`.
3. Grab your project URL and anon key from **Settings → API**.

### 3. Environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Database schema

The app expects roughly the following tables (adjust to taste — this is
inferred from the queries in the app, not a shipped migration file):

```sql
create table profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  height_cm numeric,
  weight_kg numeric,
  age integer,
  sex text check (sex in ('male', 'female')),
  activity_level text,
  goal text,
  override_calories integer,
  override_protein_g integer,
  override_carbs_g integer,
  override_fat_g integer
);

create table foods (
  id bigint generated always as identity primary key,
  name text not null,
  calories_kcal numeric not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  fiber_g numeric,
  created_by uuid references auth.users(id),
  author_name text
);

create table food_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  food_id bigint references foods(id),
  quantity_g numeric not null,
  meal_type text not null,
  logged_at date not null default current_date
);

create table weight_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  weight_kg numeric not null,
  logged_at date not null default current_date
);
```

Add Row Level Security policies scoping each table to `auth.uid()` before
going anywhere near production.

### 5. Add the 3D model

Place `stylized_male_base_mesh_free.glb` in `public/models/`. The Physique
Studio expects exactly this filename and path.

### 6. Run it

```bash
npm run dev
```

---

## How the Physique Studio actually picks a body

This part took some real trial and error, so it's worth writing down.

The GLB file contains **5 separate sculpted meshes**, not one adjustable model.
`RealisticAvatar3D.js` picks one by classifying body composition into an index
0–4 (via `physiqueArchetype.js`) and then extracting that specific mesh from
the scene — **by array position**, not by matching mesh names. Name-based
matching seemed reasonable at first but was quietly unreliable (these are
skinned/rigged meshes, and their runtime `.name` values didn't behave the way
the raw file data suggested they would). Positional indexing into the
scene-traversal order is what actually works.

The five archetypes, and what routes to each:

| Index | Model | Trigger |
|---|---|---|
| 0 | Lean / Athletic | body fat 13–18% |
| 1 | Overweight / Soft belly | body fat 18–25% |
| 2 | Heavyset / Obese | body fat ≥ 25%, or BMI ≥ 32 as a safety net |
| 3 | Muscular / Bodybuilder | body fat < 13% **and** high fat-free-mass index |
| 4 | Slim / Skinny | body fat < 13% **and** low fat-free-mass index |

Body fat % is the primary axis, checked as clean, non-overlapping bands —
deliberately not a chain of `if/else` conditions racing each other, since an
earlier version had a real bug where an easy-to-trigger "overweight" check ran
before the "muscular" check and quietly swallowed it for anyone with a
higher-than-expected BMI, muscle or not.

A small `visualBoost` multiplier (in `physiqueArchetype.js`) nudges each
archetype's waist/chest/arm scale a bit further in its own direction on top of
correct selection — the base GLB sculpts for the non-obese archetypes are
fairly close to each other in raw size, so this keeps all five visually
distinguishable rather than relying purely on subtle mesh differences.

---

## Dark mode

Dark mode uses real CSS variable overrides (in `globals.css`), not a
`filter: invert()` trick — inverting an arbitrary light palette doesn't
produce a chosen dark one, it just scrambles hues. Accent colors are
deliberately lightened one shade for dark backgrounds (saturated 500-shades
read as dim on dark surfaces). `lib/ui.js`'s shared component styles carry
explicit `dark:` variants throughout, since most of them use raw Tailwind
`slate-*` classes that the CSS variables alone can't reach.

---

## Known limitations / possible next steps

- The Physique Studio's body model is male-only; `bodyProportions.js` already
  supports a female body-fat formula, but there's no matching female GLB yet.
- The Indian food database itself isn't included in what's documented here —
  worth expanding regionally (there's a lot of India left to cover).
- `ArchetypeAvatar3D.js` is a legacy rendering path using a different GLB
  (`male_lineup.glb`) that isn't currently wired into the app — safe to remove
  once you've confirmed nothing still imports it.
- No automated tests yet on the nutrition math (`bmrTdee.js`,
  `bodyProportions.js`) — these are exactly the kind of pure functions that
  are easy to unit test and easy to silently break.

---

## License

Add whatever license fits — nothing's specified yet.
