WAY — Diet & Physique StudioWAY is an Indian-food-focused nutrition tracker and 3D body transformation platform. It combines deterministic metabolic math, recipe water-loss adjustments, nearest-neighbor dietary recommendations, and realistic 3D mesh physique projections.  Key FeaturesNutritional Orbit & Radial Gauge (MacroRings): A responsive tracking interface featuring a parametric elliptical planetary system on desktop and a compact dual-track dotted radial gauge on mobile viewports.  Indian Culinary Nutrition Engine: Calculates nutritional density per 100g of finished dish by factoring in raw ingredient inputs against post-cooking weights (water gain/loss).  Vector Match Food Recommender: Suggests whole foods and regional recipes using cosine similarity between the user's remaining daily macro vectors and food calorie distributions.  Interactive 3D Body Studio: Translates anthropometric inputs (height, weight, waist, chest, hips, biceps) into realistic 3D morphological mesh archetypes with live timeline and physiological feasibility checks.  Adaptive Dark Mode & Neon Aesthetics: Seamless theme switching with high-contrast slate surfaces, crisp white typography, and ambient neon aura highlights.  Tech StackFramework: Next.js (App Router, Turbopack)  Styling: Tailwind CSS v4, Lucide React icons  Typography: Instrument_Serif (branding), IBM_Plex_Sans, IBM_Plex_Mono  3D Engine: Three.js, React Three Fiber, React Three Drei  Database & Auth: Supabase (PostgreSQL, Row Level Security, SSR Cookie Auth)  Project StructurePlaintext├── app/
│   ├── (auth)/login/             # Google OAuth authentication flow
│   ├── (dashboard)/
│   │   ├── home/                 # Main log view, orbital gauge & date strip
│   │   ├── log-food/             # Food search, recipe matcher, meal builder
│   │   ├── add-food/             # Custom recipe builder with cook weight calculator
│   │   ├── trends/               # 7-day macro and calorie charts
│   │   ├── weight/               # Weigh-in history and trend chart
│   │   └── settings/             # Profile targets & 3D body calibration studio[cite: 4]
│   ├── api/                      # Target resolution, repeat meal & recipe builder APIs[cite: 4]
│   └── globals.css               # Design system tokens, dark mode rules & neon filters[cite: 4]
├── components/
│   ├── body/                     # Three.js 3D avatars & studio visualizer[cite: 4]
│   ├── home/                     # MacroRings, DailyLog, WeekDateStrip, RepeatMealBanner[cite: 4]
│   ├── layout/                   # AppHeader, BottomNav, ThemeToggle[cite: 4]
│   └── logging/                  # FoodSearch, DishBuilder, RecommendedFoods, Cart[cite: 4]
├── lib/
│   ├── bmrTdee.js                # Mifflin-St Jeor BMR, TDEE, macro target split[cite: 4]
│   ├── bodyProportions.js        # US Navy body fat calculations & dream physique partitioning[cite: 4]
│   ├── physiqueArchetype.js      # GLTF mesh lineup mapping & index classifiers[cite: 4]
│   ├── recipeNutrition.js        # Raw ingredient summation to post-cook weight scaling[cite: 4]
│   ├── recommend.js              # Cosine similarity macro-matching recommendation engine[cite: 4]
│   └── ui.js                     # Shared Tailwind design system tokens[cite: 4]
└── public/
    └── models/
        └── stylized_male_base_mesh_free.glb  # 3D physique lineup base model[cite: 4]
Getting Started1. Clone & Install DependenciesBashgit clone <repository-url>
cd way-diet-studio
npm install
2. Environment ConfigurationCreate a .env.local file in the root directory:Code snippetNEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
3. Database SetupEnsure your Supabase project contains the following tables with Row Level Security (RLS) configured:profiles (id, height_cm, weight_kg, age, sex, activity_level, goal, overrides)[cite: 4]foods (id, name, region, calories_kcal, protein_g, carbs_g, fat_g, created_by)[cite: 4]ingredients (id, name, category, calories_kcal, protein_g, carbs_g, fat_g)[cite: 4]food_logs (id, user_id, food_id, quantity_g, meal_type, logged_at)[cite: 4]weight_logs (id, user_id, weight_kg, logged_at)[cite: 4]dish_ingredients (id, food_id, ingredient_id, quantity_g)[cite: 4]4. Run Development ServerBashnpm run dev
Navigate to http://localhost:3000 to launch the app.
