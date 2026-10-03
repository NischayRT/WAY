# AGENTS.md

Welcome to the project! This document provides an exhaustive overview of the directory tree, core architecture, API routes, library modules, and guidelines for AI agents and developers working on this codebase.

---

## 1. Project Overview

This project is a high-performance health, nutrition, and body visualization web app built with **Next.js (App Router)**, **Supabase**, **Three.js / Canvas (3D Body Studio)**, and **Tailwind CSS**. 

Key capabilities include:
- Daily macro/calorie tracking & meal breakdown analytics.
- Dish building, quick food search, and recommendation engine.
- 3D Body Studio rendering interactive physique archetypes & mesh canvases.
- Integration with Google Health Services (step counting, activity sync).
- Weight tracking, trend visualization, and target timeline calculations.

---

## 2. Comprehensive Directory Structure (`src/`)

```text
src/
├── app/                                  # Next.js App Router
│   ├── (auth)/                           # Auth route group
│   │   └── login/                        # Login page
│   ├── (dashboard)/                      # Authenticated dashboard views
│   │   ├── add-food/                     # Manual food creation page
│   │   ├── body/                         # 3D Body Studio page
│   │   ├── home/                         # Main home dashboard (loading.js, page.js)
│   │   ├── log-food/                     # Meal logging page
│   │   ├── settings/                     # User preferences & account settings
│   │   ├── nutrition/                       # Historical macro & nutrition charts
│   │   ├── weight/                       # Weight logs & timeline analytics
│   │   └── layout.js                     # Common layout for dashboard
│   ├── api/                              # Serverless API Endpoints
│   │   ├── activity/                     # Activity data endpoint
│   │   ├── dish-builder/                 # Custom dish composition endpoint
│   │   ├── google-health/                # Google Health OAuth & metrics endpoints
│   │   │   ├── callback/                 # OAuth redirect callback
│   │   │   ├── connect/                  # Initiate OAuth connection
│   │   │   ├── disconnect/               # Revoke OAuth tokens
│   │   │   └── steps/                    # Step & distance metrics fetching
│   │   ├── recommendations/              # Smart food recommendation API
│   │   ├── repeat-meal/                  # Quick repeat previous meals API
│   │   └── targets/                      # Daily targets calculator API
│   ├── auth/                             # Auth callbacks
│   │   └── callback/                     # Supabase auth session exchange
│   ├── onboarding/                       # User profile initialization setup
│   ├── globals.css                       # Global CSS & Tailwind imports
│   ├── layout.js                         # App root layout wrapper
│   └── page.js                           # Entry point / route redirector
│
├── components/                           # React UI Components
│   ├── auth/                             # Floating food background animation
│   ├── body/                             # 3D Body Studio (Three.js / Canvas renders)
│   │   ├── ArchetypeAvatar3D.js
│   │   ├── Avatar3D.js
│   │   ├── BodyMeshCanvas.js
│   │   ├── BodyStudio.js
│   │   ├── BodyStudioCanvas.js
│   │   └── RealisticAvatar3D.js
│   ├── forms/                            # Reusable profile & settings forms
│   ├── home/                             # Home dashboard widgets
│   │   ├── ActivityConnectBanner.js
│   │   ├── DailyLog.js
│   │   ├── DateSelector.js
│   │   ├── GoogleHealthConnectBanner.js
│   │   ├── GoogleHealthWidgets.js
│   │   ├── HomeClient.js
│   │   ├── MacroRings.js
│   │   ├── QuickWeightLogModal.js
│   │   ├── RepeatMealBanner.js
│   │   ├── StepWidget.module.css
│   │   ├── WeekDateStrip.js
│   │   └── WeekMacroChart.js
│   ├── layout/                           # Global navigation elements
│   │   ├── AppHeader.js
│   │   ├── BottomNav.js
│   │   └── ThemeToggle.js
│   ├── logging/                          # Food search, dish builder & cart
│   │   ├── AddFoodForm.js
│   │   ├── Cart.js
│   │   ├── ClosestMatchPicker.js
│   │   ├── DishBuilder.js
│   │   ├── FoodSearch.js
│   │   ├── IngredientSearch.js
│   │   ├── LogFoodBuilder.js
│   │   ├── MyDishesPanel.js
│   │   └── RecommendedFoods.js
│   ├── onboarding/                       # Multi-step onboarding flows
│   ├── settings/                         # Settings panel views
│   ├── nutrition/                           # Historical nutrition & macro bar charts
│   └── weight/                           # Weigh-in forms, history & trend charts
│
├── lib/                                  # Pure Logic, Math & Data Utilities
│   ├── bmrTdee.js                        # BMR & TDEE calculation formulas
│   ├── bodyProportions.js                # Body measurement proportions math
│   ├── cache/                            # Caching layer
│   │   └── foodCache.js                  # In-memory / server food query cache
│   ├── clientFoodCache.js                # Client-side cache helper
│   ├── currentPhysiqueLogic.js           # Current body physique estimations
│   ├── currentUser.js                    # User context helper
│   ├── dateUtils.js                      # ISO date formatters (YYYY-MM-DD)
│   ├── goalFeasibility.js                # Weight loss/gain pace feasibility checks
│   ├── googleHealth.js                   # Google Fit API client (exports fetchDailyMetrics)
│   ├── mealBreakdown.js                  # Macro & calorie aggregation math
│   ├── mealCategories.js                 # Meal categorization constants
│   ├── physiqueArchetype.js              # 3D physique archetype mapper
│   ├── recipeNutrition.js                # Multi-ingredient nutritional calculator
│   ├── recommend.js                      # Recommendation algorithms
│   ├── serverFoodCache.js                # Server cache helper
│   ├── strava.js                         # Strava API integration stub/helper
│   ├── supabaseClient.js                 # Browser Supabase client creator
│   ├── supabaseServer.js                 # Server Supabase client creator
│   ├── targetPhysiqueLogic.js            # Target physique projection math
│   ├── ui.js                             # Standardized Tailwind design system tokens
│   ├── userData.js                       # Profile data formatters
│   ├── weekStatus.js                     # Weekly log status flags & visual ring styles
│   └── weightTimeline.js                 # Weight log target resolution logic
│
└── middleware.js                         # Next.js Route Guard & Auth Middleware