# AGENTS.md

Guide for AI agents and developers working on WAY Studio (www.way-studio.online): a nutrition and physique tracker built for Indian food. Read this before changing code, and keep it current when you add routes, tables or security rules.

---

## 1. Stack

- **Next.js 16 (App Router), React 19**, JavaScript only (no TypeScript). Tailwind CSS v4.
- **Supabase**: Postgres with Row Level Security, Auth (Google OAuth and email one-time codes). Browser and server both use the public anon key plus the user's session, so **RLS and the database functions are the real authorization boundary**.
- **three.js** (`@react-three/fiber`, `drei`) for the 3D body models in `public/models/bodies/`.
- **Google Health API** (OAuth, read activity and vitals, write nutrition and weight). Strava is a stub.
- Hosted on **Vercel**. SQL in `supabase/` is run by hand in the Supabase SQL editor.

## 2. Layout

```text
src/
├── proxy.js                 # Runs before every matched request (Next 16 replacement for middleware.js):
│                            #   refreshes the session, onboarding redirect, signed identity headers,
│                            #   cross-site write guard, JSON-only API bodies, security headers
├── app/
│   ├── (auth)/login/        # Sign-in (Google, email code)
│   ├── (dashboard)/         # Signed-in app: home, log-food (+ recipe builder), nutrition, activity,
│   │                        #   compete (/friends redirects there), streak, settings; add-food/body/weight only redirect
│   ├── api/                 # Route handlers (see section 4)
│   ├── auth/callback/       # Supabase code exchange
│   ├── onboarding/          # First-run profile setup
│   ├── privacy/, terms/     # Legal pages (text in lib/legal.js and the page files)
│   └── page.js              # Landing page
├── components/
│   ├── today/               # Home dashboard (TodayClient, ScoreCard, BodyAgeCard, StreakCard…)
│   ├── logging/             # LogFoodClient (search, Suggested/Recent/My recipes, edit/delete own
│   │                        #   dishes), RecipeBuilderClient (new + edit), AmountSheet, IngredientPicker
│   ├── friends/             # Tabs: Arena (leaderboard + challenges, state-driven), Friends (people, up to 4),
│   │                        #   Family, Inbox, Privacy. Leaderboard.js is the shared podium board
│   ├── activity/, nutrition/, streak/, weight/, settings/, onboarding/, landing/, legal/
│   ├── body/                # 3D viewers and studio
│   ├── way/                 # Design system (ui.js, WayNav + phone profile island, TapTips, useJson cache, tiles)
│   └── home/                # Older home widgets; several are no longer routed (see section 7)
└── lib/
    ├── authServer.js        # getAuthUser(): signed proxy headers or getClaims(); signIdentity()
    ├── supabaseServer.js    # Server client (cookies) · supabaseClient.js: browser client
    ├── supabaseAdmin.js     # SERVER ONLY service-role client (daily_stats writes only)
    ├── securityHeaders.mjs  # CSP and other headers, shared by proxy.js and next.config.mjs
    ├── rateLimit.js         # Per-user limits for Google-calling routes (DB-backed)
    ├── tokenCrypto.js       # AES-256-GCM for stored OAuth tokens (fails closed in production)
    ├── googleHealth.js, googleHealthSync.js, googleHealthSyncClient.js, strava.js
    ├── cache/foodCache.js   # Per-tab foods/ingredients cache (built-in first, archived hidden)
    ├── portions.js, recipeNutrition.js, recommend.js, mealBreakdown.js, daily.js
    ├── friends.js, challenges.js (timed challenges), streak.js, dailyLoad.js, readiness.js, bodyAge.js
    ├── body*.js, physiqueClassifier.js, current/targetPhysiqueLogic.js, goal*.js, planner.js
    └── bmrTdee.js, dateUtils.js, weekStatus.js, weightTimeline.js, ui.js, legal.js
supabase/                    # Hand-run SQL (order in section 5)
scripts/                     # Offline CSV → SQL generators (csvSql.js validates every cell)
templates/                   # CSV templates for the generators
```

## 3. Security model (do not weaken)

- **Identity.** `src/proxy.js` verifies the session with `getClaims()`, strips any client-sent `x-way-uid`/`x-way-email`/`x-way-auth`, and forwards the verified user with an HMAC signature (`x-way-auth`). `getAuthUser()` trusts the headers only when the signature is valid; otherwise it verifies the token itself. Routes that write with the service-role key call `getAuthUser(supabase, { trustMiddleware: false })`.
- **Authorization is RLS.** Every table has RLS. Never add a policy without `auth.uid()` scoping, never use `using (true)` for user data, and give new policies `to authenticated`.
- **SECURITY DEFINER functions** must derive the actor from `auth.uid()`, check the caller's relationship to every row they touch (and blocks), set `search_path = public`, and be granted to `authenticated` only. Internal helpers are revoked from `authenticated`.
- **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) is used only in `lib/supabaseAdmin.js`, only from route handlers, and only for writes the browser must not make (today: `daily_stats`). Every query is scoped to the verified user. Never import it from client code; never give it a `NEXT_PUBLIC_` prefix.
- **Custom dishes.** Only the creator may edit or delete (`update_my_food`, `delete_my_food`). A dish someone else has logged is never changed in place: edits make a new version, deletes archive (`archived_at`). Triggers enforce this for direct API writes too. Max 150 active dishes per person.
- **Data others see** (`daily_stats`, XP, challenges) comes only from the server sync, never from browser writes.
- **Challenges** (`challenges`, `challenge_members`, `challenge_scores`): only friends or family can be invited (1–4); in a group everyone must be friends or family with everyone else (`are_connected`); one open challenge per pair of people (`shared_open_challenge`) until it ends, is cancelled (creator, any time before the end), declined or left; 1–5 stats each, only people who joined see each other's numbers, and only the challenge's stats for its days (`challenge_board()`); never across a block. Results lock per stat 2 days after the end (`finalize_my_challenges()`) and are read through `challenge_results()`; scores aren't selectable directly. Overall winner = most stats won, then better average place (computed in `lib/challenges.js`). Duels are retired (functions revoked, table kept as history). Friends limit is 4, family 3.
- **Comparisons only inside challenges.** The Arena shows just your own numbers unless a challenge is live, and then only that challenge's members, stats and days. The home rank banner follows the same rule.
- **Words in the UI.** Compete = the page. Friend = someone you can race (max 4). Challenge = invite-only race with a last day, with friends or family. Family = sharing.
- **Usernames** change only through `set_username()` (30-day rule).
- **CSRF.** Non-GET `/api/*` requests from another site are refused, and API bodies must be JSON.
- **Headers.** One source of truth in `lib/securityHeaders.mjs`; applied by both the proxy and `next.config.mjs`.
- **Tokens** are encrypted with `TOKEN_ENCRYPTION_KEY`; production refuses to store them without it.
- **Rate limits.** Google-calling routes call `rateLimit(supabase, bucket)` right after the auth check. Add it to any new route that calls Google.
- **No secrets in the repo.** `.env*`, keys and credential files are git-ignored.

## 4. API routes (`src/app/api`)

| Route | Notes |
|---|---|
| `GET google-health/connect`, `GET …/callback`, `POST …/disconnect` | OAuth; state cookie bound to the initiating user |
| `GET google-health/steps`, `vitals`, `tiles`, `daily-load`, `history`; `GET activity`, `GET body-age` | Read from Google; rate limited |
| `POST google-health/sync` | Mirror food and weight to Google Health; rate limited |
| `POST friends/sync[?force=1]` | Writes `daily_stats` via the service-role client; rate limited when it calls Google |
| `POST dish-builder` | Dishes you can cook from chosen ingredients |
| `GET recommendations`, `GET targets`, `POST repeat-meal` | Still deployed; no current page calls them |

## 5. Database (`supabase/`)

Run in this order on a new project (each file is safe to re-run unless noted):
`schema.sql` → `add-weight-tracking.sql` → `add-custom-foods.sql` → `share-custom-foods.sql` → `add-food-log-update-policy.sql` → `expand-meal-categories.sql` → `add-recipe-system.sql` → `add-ingredient-logging.sql` → `security-hardening.sql` → `add-friends.sql` → `cheer-once-a-day.sql` → `security-fixes-2026-10.sql` → `security-followups-2026-10.sql` → `challenges-2026-10.sql` → `challenges-multi-2026-10.sql` → `compete-2026-10.sql` → `units-2026-10.sql`.
Seed data: `seed-dummy-foods.sql`, `seed-ingredients.sql` or `generated-ingredients.sql` (pick one; both insert ingredients), `seed-dish-recipes.sql`. `reset-foods.sql` is destructive.
`google_health_connections` and `strava_connections` were created in the dashboard; `security-hardening.sql` adds their RLS.

## 6. Environment variables (Vercel)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `TOKEN_ENCRYPTION_KEY` (32 bytes, base64), `GOOGLE_HEALTH_REDIRECT_URI`, `NEXT_PUBLIC_GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_HEALTH_ENABLED`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_TIME_ZONE`, optional `STRAVA_*`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.

## 7. Working conventions

- Commands: `npm run dev`, `npm run build`, `npm run lint`. There is no test suite; verify SQL changes against a local Postgres with the repo's `supabase/*.sql` loaded, and UI changes at 390, 768, 1024 and 1440 px wide.
- Branch from `main`, open a PR, wait for the Vercel preview, then merge. New SQL goes in a new dated file and must be run **before** merging code that depends on it.
- Not routed today (kept for reference; delete rather than revive without review): `components/home/HomeClient.js` and the widgets only it uses (`TileBoard`, `DailyLog`, `WeightBar`, `WeightBodyPreview`…), `components/body/BodyAgeCard.js` (has its own unscoped cache), `components/layout/BottomNav.js`, `components/forms/ProfileForm.js`, `components/weight/*`, `lib/insights.js`, `lib/userData.js`.
- User-facing text: plain, short, no jargon.
- Units: everything is stored and calculated in cm and kg. Show and take height, weight and body measurements through `lib/units.js` (`fmtWeight`, `fmtHeight`, `fmtLength`) and `components/way/units.js` (`useUnits`, `UnitSwitch`, `WeightInput`, `HeightInput`); never print "kg" or "cm" by hand. The choice lives in `profiles.units` (and this browser until that column exists).
- Chart details: wrap the bars in `TapTips` and put the text in `data-tip` (never `title`, which phones don't show). Mouse hover and finger tap both work.
- Phones: the profile island (Settings, Account, Log out) floats top right on every page; page headers (`main > header`) keep 52px clear for it.
