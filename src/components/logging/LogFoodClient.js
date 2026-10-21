'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  SearchX,
  X,
  Plus,
  Minus,
  Trash2,
  Check,
  History,
  ChefHat,
  Utensils,
  Sunrise,
  Sun,
  Cookie,
  Moon,
  CookingPot,
} from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { getCachedFoods, peekCachedFoods, getCachedIngredients, invalidateFoodCache } from '@/lib/cache/foodCache';
import { syncToGoogleHealth } from '@/lib/googleHealthSyncClient';
import { addDays, APP_TIME_ZONE } from '@/lib/dateUtils';
import { snackMealType, groupForMealType } from '@/lib/daily';
import { portionOf } from '@/lib/portions';
import { PAGE, Card, Eyebrow, Segmented, Dot, fmt, useToast, useLocalPref, cx } from '@/components/way/ui';
import { recommendFoods } from '@/lib/recommend';
import IngredientPicker from './IngredientPicker';
import AmountSheet from './AmountSheet';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', Icon: Sunrise },
  { key: 'lunch', label: 'Lunch', Icon: Sun },
  { key: 'snacks', label: 'Snack', Icon: Cookie },
  { key: 'dinner', label: 'Dinner', Icon: Moon },
];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_RESULTS = 60;

// The hour in the app's time zone, so the server render and the browser agree
// (the server runs in UTC; a different default meal caused a hydration error).
const HOUR_FMT = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: APP_TIME_ZONE });
function mealByClock(d = new Date()) {
  const h = Number(HOUR_FMT.format(d));
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snacks' : 'dinner';
}

function dayInfo(date, today) {
  const d = new Date(`${date}T00:00:00`);
  const dStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const yesterday = addDays(today, -1);
  return {
    short: date === today ? 'Today' : date === yesterday ? 'Yesterday' : `${WD[d.getDay()]} ${d.getDate()}`,
    long: date === today ? `Today, ${dStr}` : date === yesterday ? `Yesterday, ${dStr}` : `${WD[d.getDay()]}, ${dStr}`,
    whenShort: `${WD[d.getDay()]} ${d.getDate()}`,
  };
}

const sumLogs = (logs) =>
  logs.reduce(
    (a, l) => {
      const r = (Number(l.quantity_g) || 0) / 100;
      const f = l.foods || {};
      return {
        k: a.k + (f.calories_kcal || 0) * r,
        p: a.p + (f.protein_g || 0) * r,
        c: a.c + (f.carbs_g || 0) * r,
        f: a.f + (f.fat_g || 0) * r,
      };
    },
    { k: 0, p: 0, c: 0, f: 0 }
  );

// Nutrition for g grams of a food (values are per 100 g).
const nutr = (food, g) => {
  const r = (Number(g) || 0) / 100;
  return {
    g,
    calories: (Number(food.calories_kcal) || 0) * r,
    protein: (Number(food.protein_g) || 0) * r,
    carbs: (Number(food.carbs_g) || 0) * r,
    fat: (Number(food.fat_g) || 0) * r,
  };
};

// "½", "1", "1¼", "2.3"
const countLabel = (n) => {
  const q = Math.round(n * 4) / 4;
  if (Math.abs(q - n) < 0.01) {
    const whole = Math.floor(q);
    const frac = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[q - whole];
    return `${whole || !frac ? whole : ''}${frac}`;
  }
  return (Math.round(n * 10) / 10).toString();
};
const PLURAL = { glass: 'glasses', katori: 'katoris' };

// An ingredient shown and logged like a food (resolved to a real food row at log time).
const ingredientAsFood = (i) => ({
  id: `ing-${i.id}`,
  ingredientId: i.id,
  isIngredient: true,
  name: i.name,
  calories_kcal: i.calories_kcal,
  protein_g: i.protein_g,
  carbs_g: i.carbs_g,
  fat_g: i.fat_g,
  serving_size_g: 100,
});

function Stepper({ qty, onDec, onInc, onEdit, decIcon = 'minus', tone = 'accent', wide = false }) {
  const accent = tone === 'accent';
  const DecIcon = decIcon === 'trash' ? Trash2 : Minus;
  return (
    <div
      className={cx(
        'flex shrink-0 items-center rounded-xl border',
        accent ? 'border-emerald-400/40 bg-emerald-400/8' : 'rounded-[10px] border-way-line2'
      )}
    >
      <button
        type="button"
        onClick={onDec}
        aria-label="Less"
        className={cx('flex h-10 w-[34px] items-center justify-center md:h-[38px] md:w-[38px]', accent ? 'text-way-protein' : 'h-9 w-8 text-way-mute md:h-[34px] md:w-8')}
      >
        <DecIcon size={13} />
      </button>
      <button
        type="button"
        onClick={onEdit}
        title="Set an exact amount"
        className={cx(
          'self-stretch rounded-md px-0.5 text-center font-mono text-[11px] font-semibold underline decoration-dotted underline-offset-4 hover:bg-white/5',
          accent ? 'text-emerald-100 md:text-xs' : 'text-way-ink',
          wide ? 'min-w-[48px] md:min-w-[72px]' : 'min-w-[44px] md:min-w-[60px]'
        )}
      >
        {qty}
      </button>
      <button
        type="button"
        onClick={onInc}
        aria-label="More"
        className={cx('flex h-10 w-[34px] items-center justify-center md:h-[38px] md:w-[38px]', accent ? 'text-way-protein' : 'h-9 w-8 text-way-mute md:h-[34px] md:w-8')}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

export default function LogFoodClient({ userId, today, minDate, initialDate, initialMeal, initialQuery = '', targets, goal = 'maintain' }) {
  const supabase = createClient();
  const router = useRouter();
  const [foods, setFoods] = useState(() => peekCachedFoods() ?? []);
  const [foodsError, setFoodsError] = useState(null);
  const [q, setQ] = useState(initialQuery);
  const [tab, setTab] = useState('suggested');
  const [have, setHave] = useState([]); // ingredients for "Cook from"
  const [dishRes, setDishRes] = useState({ key: '', matches: [] });
  const [meal, setMeal] = useState(() => (initialMeal ? groupForMealType(initialMeal) : mealByClock()));
  const [date, setDate] = useState(initialDate || today);
  const [tray, setTray] = useState([]); // [{ food, n }]
  const [trayOpen, setTrayOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dayState, setDayState] = useState({ date: null, logs: [] });
  const [historyCounts, setHistoryCounts] = useState(() => new Map());
  const [recent, setRecent] = useState([]);
  const [nonce, setNonce] = useState(0);
  const [units, setUnits] = useLocalPref('way.logfood.units', 'portions');
  const [kind, setKind] = useLocalPref('way.logfood.kind', 'all'); // all | recipes | ingredients
  const [ingredients, setIngredients] = useState([]);
  const [myPortions, setMyPortions] = useState(() => new Map()); // food id -> { unit, g }
  const [recipeIds, setRecipeIds] = useState(() => new Set()); // foods that have an ingredient list
  const [editing, setEditing] = useState(null); // { food, grams }
  const [toastNode, toast] = useToast();
  const grams = units === 'grams';

  useEffect(() => {
    let live = true;
    getCachedFoods(supabase)
      .then((data) => live && setFoods(data))
      .catch((e) => live && setFoodsError(e.message || 'Could not load foods.'));
    return () => {
      live = false;
    };
    // supabase client is stable for the page's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ingredients (banana, paneer, oats…) are searchable and loggable too.
  useEffect(() => {
    let live = true;
    getCachedIngredients(supabase)
      .then((data) => live && setIngredients(data))
      .catch(() => {});
    // The user's own portion sizes ("my bowl = 250 g").
    supabase
      .from('user_portions')
      .select('food_id, unit, grams')
      .then(({ data }) => live && data && setMyPortions(new Map(data.map((r) => [r.food_id, { unit: r.unit, g: Number(r.grams) }]))));
    // Which dishes have a recipe (ingredient list).
    supabase
      .from('dish_ingredients')
      .select('food_id')
      .limit(20000)
      .then(({ data }) => live && data && setRecipeIds(new Set(data.map((r) => r.food_id))));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What's already logged on the chosen day, for "your day after this meal".
  useEffect(() => {
    let live = true;
    supabase
      .from('food_logs')
      .select('food_id, quantity_g, foods (calories_kcal, protein_g, carbs_g, fat_g)')
      .eq('user_id', userId)
      .eq('logged_at', date)
      .then(({ data }) => live && setDayState({ date, logs: data ?? [] }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, userId, nonce]);

  // Recently logged foods, newest first.
  useEffect(() => {
    let live = true;
    supabase
      .from('food_logs')
      .select('food_id, logged_at, meal_type')
      .eq('user_id', userId)
      .gte('logged_at', addDays(today, -60))
      .order('logged_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!live) return;
        // How often each food was logged lately: suggestions lean towards
        // foods you actually eat.
        const counts = new Map();
        for (const r of data ?? []) counts.set(r.food_id, (counts.get(r.food_id) ?? 0) + 1);
        setHistoryCounts(counts);
        const seen = new Set();
        const out = [];
        const since = addDays(today, -21);
        for (const r of data ?? []) {
          if (r.logged_at < since) break;
          if (seen.has(r.food_id)) continue;
          seen.add(r.food_id);
          out.push(r);
        }
        setRecent(out.slice(0, 20));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, today, nonce]);

  // Leaving with an unlogged tray asks first.
  useEffect(() => {
    if (!tray.length) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e) => {
      const a = e.target.closest?.('a');
      if (!a || !a.href || a.target === '_blank') return;
      const url = new URL(a.href);
      if (url.pathname === window.location.pathname) return;
      if (!window.confirm(`You have ${tray.length} item${tray.length > 1 ? 's' : ''} in this meal that aren't logged yet. Leave anyway?`)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [tray.length]);

  // Dishes that use the chosen ingredients.
  const haveKey = have.map((h) => h.id).join(',');
  useEffect(() => {
    if (!haveKey) return undefined;
    let live = true;
    fetch('/api/dish-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientIds: haveKey.split(',').map(Number) }),
    })
      .then((res) => res.json())
      .then((data) => live && setDishRes({ key: haveKey, matches: data.matches ?? [] }))
      .catch(() => live && setDishRes({ key: haveKey, matches: [] }));
    return () => {
      live = false;
    };
  }, [haveKey]);
  const dishLoading = !!haveKey && dishRes.key !== haveKey;

  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  // Suggestions are scored right here in the browser (lib/recommend.js) from
  // data this page already has: the food list, the day's logs, your recent
  // history and your targets. No request, so they appear as soon as the day
  // has loaded, and they follow the day you're logging for.
  const dayReady = dayState.date === date;
  const rec = { loading: !foods.length || !dayReady };
  const suggested = useMemo(() => {
    if (!foods.length || !dayReady) return [];
    const done = sumLogs(dayState.logs);
    const remaining = {
      calories: targets.targetCalories - done.k,
      protein: targets.proteinG - done.p,
      carbs: targets.carbsG - done.c,
      fat: targets.fatG - done.f,
    };
    const loggedTodayIds = new Set(dayState.logs.map((l) => l.food_id));
    return recommendFoods({ remaining, foods, goal, historyCounts, loggedTodayIds, topN: 8 }).map((r) => r.food);
  }, [foods, dayReady, dayState.logs, targets, goal, historyCounts]);
  const recentFoods = useMemo(
    () => recent.map((r) => ({ food: byId.get(r.food_id), r })).filter((x) => x.food),
    [recent, byId]
  );
  const mine = useMemo(() => foods.filter((f) => f.created_by && f.created_by === userId), [foods, userId]);

  const setN = (food, n) =>
    setTray((t) => {
      const i = t.findIndex((x) => x.food.id === food.id);
      if (n <= 0) return i >= 0 ? t.filter((_, j) => j !== i) : t;
      if (i >= 0) return t.map((x, j) => (j === i ? { food, n } : x));
      return [...t, { food, n }];
    });
  const nOf = (id) => tray.find((x) => x.food.id === id)?.n || 0;

  // Portion for a food: the user's saved size, else the standard one.
  const pOf = (food) => (typeof food.id === 'number' && myPortions.get(food.id)) || portionOf(food);
  const portionNutrition = (food, n) => nutr(food, pOf(food).g * n);
  const portionLabel = (food, n) => {
    const { unit, g } = pOf(food);
    if (unit === 'serving' && g === 100) return `${fmt(g * n)} g`;
    const plural = n > 1 ? PLURAL[unit] || `${unit}s` : unit;
    return `${countLabel(n)} ${plural}`;
  };
  const openEditor = (food) => {
    const n0 = nOf(food.id) || 1;
    setEditing({ food, grams: pOf(food).g * n0 });
  };

  // Recipe lines for a dish: [{ quantity_g, ingredient }], and the cooked weight they make.
  const loadRecipe = async (food) => {
    const [{ data: lines, error }, { data: row }] = await Promise.all([
      supabase
        .from('dish_ingredients')
        .select('quantity_g, ingredients (id, name, calories_kcal, protein_g, carbs_g, fat_g)')
        .eq('food_id', food.id),
      supabase.from('foods').select('raw_weight_g, final_weight_g').eq('id', food.id).maybeSingle(),
    ]);
    if (error) throw error;
    const clean = (lines || []).filter((l) => l.ingredients).map((l) => ({ quantity_g: Number(l.quantity_g) || 0, ingredient: l.ingredients }));
    const raw = clean.reduce((a, l) => a + l.quantity_g, 0);
    return { lines: clean, cooked: Number(row?.final_weight_g) || Number(row?.raw_weight_g) || raw };
  };

  const saveMyPortion = async (foodId, portion) => {
    setMyPortions((m) => new Map(m).set(foodId, portion));
    const { error } = await supabase.from('user_portions').upsert({ food_id: foodId, unit: portion.unit, grams: Math.round(portion.g) }, { onConflict: 'user_id,food_id' });
    if (error) toast('Portion size used for now, but couldn’t be saved', X, 'error');
  };

  const applyAmount = ({ grams, portion, saveDefault, lines }) => {
    const food = editing.food;
    setEditing(null);
    if (lines) {
      // Log the recipe as its ingredients, with the amounts the user set.
      setTray((t) => {
        let next = t.filter((x) => x.food.id !== food.id);
        for (const { ingredient, g } of lines) {
          const f = ingredientAsFood(ingredient);
          const unitG = pOf(f).g;
          const i = next.findIndex((x) => x.food.id === f.id);
          if (i >= 0) next = next.map((x, j) => (j === i ? { ...x, n: x.n + g / unitG } : x));
          else next = [...next, { food: f, n: g / unitG }];
        }
        return next;
      });
      toast(`${food.name} added as ${lines.length} ingredients`, Check);
      return;
    }
    const std = pOf(food);
    const changed = portion.unit !== std.unit || Math.round(portion.g) !== Math.round(std.g);
    if (changed && typeof food.id === 'number') {
      if (saveDefault) saveMyPortion(food.id, portion);
      else setMyPortions((m) => new Map(m).set(food.id, portion)); // this session only
    } else if (saveDefault && typeof food.id === 'number') {
      saveMyPortion(food.id, portion);
    }
    setN(food, grams / portion.g);
  };

  const qty = (food, n) => (grams ? `${fmt(pOf(food).g * n)} g` : portionLabel(food, n));
  const ql = q.trim().toLowerCase();
  // Raw ingredients (searched from the ingredient list, or already logged once) vs dishes/recipes.
  const isIng = (f) => !!(f.isIngredient || f.category === 'ingredient');
  const kindOk = (f) => kind === 'all' || (kind === 'ingredients' ? isIng(f) : !isIng(f));
  const allResults = useMemo(() => {
    if (!ql) return [];
    const starts = [];
    const contains = [];
    for (const f of foods) {
      const nm = f.name.toLowerCase();
      if (nm.startsWith(ql)) starts.push(f);
      else if (nm.includes(ql)) contains.push(f);
      if (starts.length >= MAX_RESULTS * 3) break;
    }
    const names = new Set(foods.map((f) => f.name.toLowerCase()));
    const ingStarts = [];
    const ingContains = [];
    for (const i of ingredients) {
      const nm = i.name.toLowerCase();
      if (names.has(nm)) continue;
      if (nm.startsWith(ql)) ingStarts.push(ingredientAsFood(i));
      else if (nm.includes(ql)) ingContains.push(ingredientAsFood(i));
    }
    return [...starts, ...ingStarts, ...contains, ...ingContains];
  }, [foods, ingredients, ql]);
  const results = useMemo(() => allResults.filter(kindOk).slice(0, MAX_RESULTS), [allResults, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const kindCounts = useMemo(() => {
    const ing = allResults.filter(isIng).length;
    return { all: allResults.length, ingredients: ing, recipes: allResults.length - ing };
  }, [allResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const lists = {
    suggested: suggested.map((f) => ({ food: f })),
    recent: recentFoods,
    mine: mine.map((f) => ({ food: f })),
    cook: haveKey && dishRes.key === haveKey ? dishRes.matches.map((m) => ({ food: byId.get(m.food.id) || m.food, match: m })) : [],
  };
  const items = ql ? results.map((f) => ({ food: f })) : lists[tab].filter((x) => kindOk(x.food));

  const tot = tray.reduce(
    (a, t) => {
      const x = portionNutrition(t.food, t.n);
      return { k: a.k + x.calories, p: a.p + x.protein, c: a.c + x.carbs, f: a.f + x.fat };
    },
    { k: 0, p: 0, c: 0, f: 0 }
  );
  const before = dayState.date === date ? sumLogs(dayState.logs) : { k: 0, p: 0, c: 0, f: 0 };
  const T = { k: targets.targetCalories, p: targets.proteinG, c: targets.carbsG, f: targets.fatG };
  const pGap = Math.max(0, T.p - before.p - tot.p);

  const day = dayInfo(date, today);
  const backdated = date !== today;
  const mealLabel = MEALS.find((m) => m.key === meal).label;
  const goDay = (delta) => {
    const next = addDays(date, delta);
    if (next < minDate || next > today) return;
    setDate(next);
  };

  const proj = [
    ['Calories', 'k', '#fbbf24', ' kcal', false],
    ['Protein', 'p', '#34d399', ' g', true],
    ['Carbs', 'c', '#60a5fa', ' g', false],
    ['Fat', 'f', '#a78bfa', ' g', false],
  ].map(([label, key, color, unit, more]) => {
    const t = T[key];
    const b = before[key];
    const a = tot[key];
    const after = b + a;
    const max = Math.max(t, after) || 1;
    const left = t - after;
    const over = !more && after > t * 1.05;
    return {
      label,
      color,
      unit,
      t: fmt(t),
      after: fmt(after),
      beforePct: (b / max) * 100,
      addPct: (a / max) * 100,
      status: left >= 0 ? `${fmt(left)} left` : more ? `+${fmt(-left)}` : `${fmt(-left)} over`,
      statusColor: over ? '#fb7185' : more && left <= t * 0.1 ? '#34d399' : '#94a3b8',
    };
  });

  const blurbs = {
    suggested:
      rec.loading
        ? 'Picking foods that fit what’s left of your day…'
        : pGap > 5
          ? `You still need ${fmt(pGap)} g protein today. These close the gap without blowing your calories.`
          : 'Protein is covered today. These are lighter picks that keep you on target.',
    recent: recentFoods.length ? 'What you logged lately, newest first.' : 'Nothing logged in the last three weeks.',
    mine: mine.length ? 'Dishes you built from your own ingredients.' : 'No recipes yet. Build one with Custom recipe.',
    cook: !haveKey
      ? 'Tell us what’s in your kitchen and we’ll suggest dishes.'
      : dishLoading
        ? 'Finding dishes…'
        : lists.cook.length
          ? `${lists.cook.length} dish${lists.cook.length === 1 ? '' : 'es'} use what you have.`
          : 'No dishes use these yet. Try adding more ingredients.',
  };
  const blurb = ql ? (items.length ? `${items.length}${items.length >= MAX_RESULTS ? '+' : ''} match${items.length === 1 ? '' : 'es'} for “${q.trim()}”` : '') : blurbs[tab];
  const hiddenByKind = !!ql && items.length === 0 && kind !== 'all' && kindCounts.all > 0;
  const empty = !!ql && items.length === 0 && foods.length > 0 && !hiddenByKind;
  const recipeHref = ql && !items.length ? `/log-food/recipe?name=${encodeURIComponent(q.trim())}` : '/log-food/recipe';
  const recipeCta = ql && !items.length ? `Build “${q.trim()}” as a recipe` : 'Build a custom recipe';

  const n = tray.length;
  const logIt = async () => {
    if (!n || saving) return;
    setSaving(true);
    const mealType = meal === 'snacks' ? (initialMeal && groupForMealType(initialMeal) === 'snacks' ? initialMeal : snackMealType()) : meal;
    // Ingredients become shared foods the first time anyone logs them.
    const ids = new Map();
    let createdFood = false;
    for (const t of tray) {
      if (!t.food.isIngredient) continue;
      const { data: fid, error: rpcError } = await supabase.rpc('food_for_ingredient', { p_ingredient_id: t.food.ingredientId });
      if (rpcError || !fid) {
        setSaving(false);
        toast(
          /function .* does not exist|schema cache/i.test(rpcError?.message || '')
            ? 'Logging ingredients needs the latest database update.'
            : `Couldn't add ${t.food.name}. Please try again.`,
          X,
          'error'
        );
        return;
      }
      ids.set(t.food.id, fid);
      createdFood = true;
    }
    const rows = tray.map((t) => ({
      user_id: userId,
      food_id: ids.get(t.food.id) ?? t.food.id,
      quantity_g: Math.round(pOf(t.food).g * t.n),
      meal_type: mealType,
      logged_at: date,
    }));
    const { data: inserted, error } = await supabase.from('food_logs').insert(rows).select('id');
    setSaving(false);
    if (error) {
      toast(error.message, X, 'error');
      return;
    }
    if (inserted?.length) syncToGoogleHealth({ action: 'food_upsert', logIds: inserted.map((r) => r.id) });
    if (createdFood) {
      invalidateFoodCache();
      getCachedFoods(supabase).then(setFoods).catch(() => {});
    }
    toast(`${mealLabel} logged to ${date === today ? 'today' : day.short} · ${fmt(tot.k)} kcal`, Check);
    setTray([]);
    setTrayOpen(false);
    setNonce((x) => x + 1);
    router.refresh();
  };

  const tabs = [
    ['suggested', 'Suggested', lists.suggested.length],
    ['recent', 'Recent', lists.recent.length],
    ['mine', 'My recipes', lists.mine.length],
    ['cook', 'From ingredients', have.length || null],
  ];

  const whenLabel = (r) => {
    if (!r) return '';
    const mealName = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', mid_day_snack: 'snack', evening_snack: 'snack', beverage: 'drink' }[r.meal_type] || 'other';
    const d = r.logged_at === today ? 'Today' : r.logged_at === addDays(today, -1) ? 'Yesterday' : dayInfo(r.logged_at, today).whenShort;
    return `${d} · ${mealName}`;
  };

  const trayRows = tray.map((t, i) => {
    const x = portionNutrition(t.food, t.n);
    return (
      <div key={t.food.id} className={cx('flex items-center gap-2 py-2 md:gap-2.5 md:py-2.5', i && 'border-t border-way-line')}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium md:text-sm">{t.food.name}</span>
          <span className="font-mono text-[10px] font-medium text-way-dim md:text-[11px]">
            {grams ? `${fmt(x.protein)} g protein` : `${fmt(x.g)} g`} · {fmt(x.calories)} kcal
          </span>
        </div>
        <Stepper
          tone="plain"
          qty={qty(t.food, t.n)}
          decIcon={t.n <= 0.5 ? 'trash' : 'minus'}
          onDec={() => setN(t.food, t.n <= 0.5 ? 0 : Math.max(0.5, Math.round((t.n - 0.5) * 2) / 2))}
          onInc={() => setN(t.food, Math.round((t.n + 0.5) * 2) / 2)}
          onEdit={() => openEditor(t.food)}
        />
      </div>
    );
  });

  const legend = (
    <span className="flex gap-2.5 text-[11px] text-way-dim">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-way-line3" />
        logged
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-way-ink" />
        this meal
      </span>
    </span>
  );

  const dayPicker = (long) => (
    <div className="flex items-center gap-0.5 rounded-xl border border-way-line bg-way-card p-[3px] md:rounded-[14px] md:p-1">
      <button
        type="button"
        onClick={() => goDay(-1)}
        disabled={date <= minDate}
        aria-label="Previous day"
        className="flex h-8 w-8 items-center justify-center rounded-[10px] text-way-mute transition-colors hover:bg-way-hover disabled:opacity-35 md:h-[34px] md:w-[34px]"
      >
        <ChevronLeft size={15} />
      </button>
      <span className={cx('text-center font-mono text-xs font-semibold md:text-[13px]', long ? 'min-w-[150px]' : 'min-w-[76px]', backdated ? 'text-way-kcal' : 'text-way-ink')}>
        {long ? day.long : day.short}
      </span>
      <button
        type="button"
        onClick={() => goDay(1)}
        disabled={date >= today}
        aria-label="Next day"
        className="flex h-8 w-8 items-center justify-center rounded-[10px] text-way-mute transition-colors hover:bg-way-hover disabled:opacity-35 md:h-[34px] md:w-[34px]"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );

  return (
    <main className={cx(PAGE, 'pb-[calc(190px+env(safe-area-inset-bottom))] md:pb-[130px] lg:pb-10')}>
      <header className="flex items-center justify-between gap-3 px-0.5 md:gap-6">
        <div className="flex items-baseline gap-3.5">
          <h1 className="font-heading text-[28px] font-bold leading-none tracking-[-0.01em] md:text-[34px]">Log food</h1>
          <span className="hidden font-mono text-xs font-medium text-way-dim md:inline">
            {fmt(before.k)} of {fmt(T.k)} kcal logged {date === today ? 'today' : 'that day'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Segmented
            className="hidden lg:flex"
            value={meal}
            onChange={setMeal}
            options={MEALS.map((m) => ({ value: m.key, label: m.label, icon: m.Icon }))}
          />
          <div className="lg:hidden">{dayPicker(false)}</div>
          <div className="hidden lg:block">{dayPicker(true)}</div>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-1 rounded-[14px] border border-way-line bg-way-card p-1 lg:hidden">
        {MEALS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMeal(m.key)}
            aria-pressed={meal === m.key}
            className={cx(
              'flex min-h-[52px] flex-col items-center justify-center gap-[3px] rounded-[10px] transition-colors',
              meal === m.key ? 'bg-way-ink text-way-page' : 'text-way-mute'
            )}
          >
            <m.Icon size={15} />
            <span className="text-[11px] font-semibold">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3 md:gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex min-w-0 flex-col gap-3 md:gap-3.5">
          {backdated ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-400/8 px-3 py-[9px] text-xs text-way-kcal md:px-3.5 md:py-2.5 md:text-[13px]">
              <History size={14} />
              Logging to {day.long}, not today.<span className="hidden md:inline"> Entries land on that day&apos;s totals.</span>
            </div>
          ) : null}

          <div className="relative flex items-center">
            <Search size={16} className="pointer-events-none absolute left-3.5 text-way-dim md:left-4" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={foods.length ? `Search ${fmt(foods.length)} foods and your recipes — dal, roti, dosa…` : 'Search dal, roti, dosa…'}
              className="h-12 w-full rounded-[14px] border border-way-line2 bg-way-card pl-[42px] pr-11 text-[15px] text-way-ink outline-none placeholder:text-way-faint focus:border-way-faint md:h-[52px] md:pl-[46px] md:pr-12"
            />
            {ql ? (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-[10px] text-way-mute hover:text-way-ink md:right-2"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2.5 md:gap-3">
            {!ql ? (
              <div className="flex flex-wrap gap-1.5">
                {tabs.map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                    className={cx(
                      'flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors md:min-h-[38px] md:gap-[7px] md:px-4',
                      tab === key ? 'border-way-line3 bg-way-track text-way-ink' : 'border-way-line text-way-mute hover:text-way-ink'
                    )}
                  >
                    {key === 'cook' ? <CookingPot size={14} /> : null}
                    {label}
                    {count != null ? <span className="font-mono text-[10px] font-semibold opacity-60 md:text-[11px]">{count}</span> : null}
                  </button>
                ))}
                <Link
                  href="/log-food/recipe"
                  className="flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-way-ink bg-way-ink px-3.5 text-[13px] font-semibold text-way-page transition-colors hover:bg-white md:min-h-[38px] md:gap-[7px] md:px-4"
                >
                  <Plus size={14} />
                  Custom recipe
                </Link>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 flex-1 px-0.5 text-xs leading-normal text-way-mute [text-wrap:pretty] md:text-[13px]">{blurb}</span>
              <Segmented
                size="sm"
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'all', label: ql ? `All ${kindCounts.all > MAX_RESULTS ? `${MAX_RESULTS}+` : kindCounts.all}` : 'All' },
                  { value: 'recipes', label: ql ? `Recipes ${kindCounts.recipes}` : 'Recipes' },
                  { value: 'ingredients', label: ql ? `Ingredients ${kindCounts.ingredients}` : 'Ingredients' },
                ]}
              />
            </div>
          </div>

          {!ql && tab === 'cook' ? <IngredientPicker supabase={supabase} chosen={have} onChange={setHave} /> : null}

          <Card className="flex flex-col overflow-hidden rounded-[20px] md:rounded-[22px]">
            <div className="hidden grid-cols-[minmax(0,1fr)_64px_64px_64px_84px_168px] items-center gap-3 border-b border-way-line px-5 py-3 font-mono text-[10px] font-semibold tracking-[0.06em] text-way-dim md:grid">
              <span>FOOD · PORTION</span>
              <span className="text-right text-way-protein">PROTEIN</span>
              <span className="text-right text-way-carbs">CARBS</span>
              <span className="text-right text-way-fat">FAT</span>
              <span className="text-right text-way-kcal">KCAL</span>
              <span />
            </div>
            {foodsError ? <p className="px-5 py-6 text-[13px] text-rose-300">{foodsError}</p> : null}
            {!foods.length && !foodsError ? <p className="px-5 py-6 text-[13px] text-way-dim">Loading foods…</p> : null}
            {items.map(({ food, r, match }, i) => {
              const cnt = nOf(food.id);
              const shown = portionNutrition(food, cnt || 1);
              const one = portionNutrition(food, 1);
              const reason = !ql && tab === 'suggested' ? `+${fmt(one.protein)} g protein for ${fmt(one.calories)} kcal` : '';
              const when = !ql && tab === 'recent' ? whenLabel(r) : '';
              const uses = match
                ? `Uses ${match.matched} of ${match.total} ingredients${match.missing.length ? ` · needs ${match.missing.slice(0, 3).join(', ')}${match.missing.length > 3 ? '…' : ''}` : ' · you have everything'}`
                : '';
              const isMine = !!food.created_by && food.created_by === userId;
              const control = cnt ? (
                <Stepper
                  wide
                  qty={qty(food, cnt)}
                  onDec={() => setN(food, cnt <= 0.5 ? 0 : Math.max(0.5, Math.round((cnt - 0.5) * 2) / 2))}
                  onInc={() => setN(food, Math.round((cnt + 0.5) * 2) / 2)}
                  onEdit={() => openEditor(food)}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setN(food, 1)}
                    title={`Add ${food.name}`}
                    aria-label={`Add ${food.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-way-line2 text-way-ink2 md:hidden"
                  >
                    <Plus size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setN(food, 1)}
                    className="hidden h-[38px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-way-line2 px-3.5 text-[13px] font-semibold text-way-ink2 transition-colors hover:border-way-line3 hover:bg-way-hover md:flex"
                  >
                    <Plus size={14} />
                    Add {qty(food, 1)}
                  </button>
                </>
              );
              return (
                <div
                  key={food.id}
                  className={cx(
                    'flex items-center gap-2.5 py-[11px] pl-3.5 pr-3 transition-colors md:grid md:grid-cols-[minmax(0,1fr)_64px_64px_64px_84px_168px] md:gap-3 md:px-5 md:py-3 md:hover:bg-[#121927]',
                    i && 'border-t border-[#161d2b]',
                    cnt && 'bg-emerald-400/[.04]'
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
                      <span className="truncate text-sm font-medium md:text-[15px]">{food.name}</span>
                      {food.isIngredient ? (
                        <span className="shrink-0 rounded-[5px] border border-sky-400/35 px-1 py-px font-mono text-[10px] font-semibold text-way-carbs">INGREDIENT</span>
                      ) : null}
                      {isMine ? (
                        <span className="shrink-0 rounded-[5px] border border-emerald-400/35 px-1 py-px font-mono text-[10px] font-semibold text-way-protein">
                          <span className="md:hidden">MINE</span>
                          <span className="hidden md:inline">MY RECIPE</span>
                        </span>
                      ) : null}
                    </div>
                    <span className="truncate font-mono text-[11px] font-medium text-way-dim md:hidden">
                      {qty(food, cnt || 1)} · {fmt(shown.calories)} kcal · P {fmt(shown.protein)}
                    </span>
                    <div className="hidden min-w-0 items-baseline gap-2.5 md:flex">
                      <span className="whitespace-nowrap font-mono text-[11px] font-medium text-way-dim">
                        {qty(food, cnt || 1)}
                        {grams ? '' : ` · ${fmt(shown.g)} g`}
                      </span>
                      {reason ? <span className="truncate text-xs text-way-protein">{reason}</span> : null}
                      {when ? <span className="text-xs text-way-dim">{when}</span> : null}
                    </div>
                    {reason ? <span className="text-[11px] text-way-protein md:hidden">{reason}</span> : null}
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button type="button" onClick={() => openEditor(food)} className="text-left text-[11px] font-semibold text-way-mute underline decoration-dotted underline-offset-4 hover:text-way-ink md:text-xs">
                        Custom amount
                      </button>
                      {recipeIds.has(food.id) ? (
                        <button type="button" onClick={() => openEditor(food)} className="text-left text-[11px] font-semibold text-way-carbs underline decoration-dotted underline-offset-4 hover:text-sky-300 md:text-xs">
                          Ingredients
                        </button>
                      ) : null}
                    </span>
                    {uses ? (
                      <span className={cx('truncate text-[11px] md:text-xs', match.missing.length ? 'text-way-kcal' : 'text-way-protein')}>{uses}</span>
                    ) : null}
                  </div>
                  {[shown.protein, shown.carbs, shown.fat].map((v, j) => (
                    <span key={j} className="hidden text-right font-mono text-[13px] font-medium text-way-ink2 md:block">
                      {fmt(v)}
                      <span className="text-way-faint">g</span>
                    </span>
                  ))}
                  <span className="hidden text-right font-mono text-sm font-semibold md:block">{fmt(shown.calories)}</span>
                  <div className="flex justify-end">{control}</div>
                </div>
              );
            })}
            {!ql && !items.length && tab === 'suggested' && rec.loading ? (
              // Placeholder rows the size of real ones, so the list doesn't jump when suggestions arrive.
              <div aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className={cx('flex items-center gap-3 px-4 py-3.5 md:px-5', i && 'border-t border-way-line')}>
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="h-3.5 w-2/5 animate-pulse rounded bg-way-track" />
                      <div className="h-3 w-3/5 animate-pulse rounded bg-way-track/70" />
                    </div>
                    <div className="h-9 w-9 animate-pulse rounded-xl bg-way-track md:w-28" />
                  </div>
                ))}
              </div>
            ) : !ql && !items.length && foods.length ? (
              <p className="px-5 py-6 text-center text-[13px] text-way-dim">
                {tab === 'suggested' && rec.loading
                  ? 'Loading suggestions…'
                  : tab === 'cook'
                    ? !haveKey
                      ? 'Add a few ingredients above to see dishes.'
                      : dishLoading
                        ? 'Finding dishes…'
                        : 'No dishes use these yet.'
                    : 'Nothing here yet.'}
              </p>
            ) : null}
            {hiddenByKind ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="text-sm text-way-ink2">
                  No {kind === 'ingredients' ? 'ingredients' : 'recipes'} match “{q.trim()}”.
                </span>
                <button type="button" onClick={() => setKind('all')} className="rounded-[10px] border border-way-line2 px-3.5 py-2 text-[13px] font-semibold text-way-ink2 hover:bg-way-hover">
                  Show all {kindCounts.all} results
                </button>
              </div>
            ) : null}
            {empty ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-[22px] text-center md:gap-2 md:px-5 md:py-10">
                <SearchX size={22} className="hidden text-way-faint md:block" />
                <span className="text-sm text-way-ink2 md:text-[15px]">Nothing called “{q.trim()}” yet.</span>
                <span className="text-xs text-way-dim md:text-[13px]">Build it once from its ingredients and it shows up in search from then on.</span>
                <Link
                  href={recipeHref}
                  className="mt-1.5 hidden items-center gap-1.5 rounded-[10px] bg-way-ink px-4 py-2.5 text-[13px] font-semibold text-way-page md:flex"
                >
                  <ChefHat size={14} />
                  {recipeCta}
                </Link>
              </div>
            ) : null}
          </Card>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-way-dim">
            <span className="hidden md:inline">Values are for the portion shown · steps change by half a portion ·</span>
            <Segmented
              size="sm"
              value={units}
              onChange={setUnits}
              options={[
                { value: 'portions', label: 'Portions' },
                { value: 'grams', label: 'Grams' },
              ]}
            />
          </div>
        </section>

        {/* Desktop: this meal and your day after it */}
        <aside className="sticky top-6 hidden flex-col gap-4 lg:flex">
          <Card className="flex flex-col gap-4 border-way-line2 p-[22px]">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex flex-col gap-1">
                <Eyebrow>This meal</Eyebrow>
                <span className="font-heading text-2xl font-bold leading-none">
                  {mealLabel} · {day.short}
                </span>
              </div>
              <span className="pt-1 font-mono text-[11px] font-medium text-way-dim">{n} items</span>
            </div>
            {!n ? (
              <div className="rounded-[14px] border border-dashed border-way-line2 px-4 py-[22px] text-center text-[13px] text-way-dim [text-wrap:pretty]">
                Tap + on anything on the left to add it to {mealLabel.toLowerCase()}.
              </div>
            ) : (
              <div className="flex flex-col">{trayRows}</div>
            )}
            <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] border-t border-way-line pt-3.5">
              <div className="flex flex-col gap-1 pr-[18px]">
                <span className="text-[11px] text-way-mute">Calories</span>
                <span className="font-mono text-[26px] font-semibold leading-none text-way-kcal">{fmt(tot.k)}</span>
              </div>
              {[
                ['Protein', tot.p, 'text-way-protein'],
                ['Carbs', tot.c, 'text-way-carbs'],
                ['Fat', tot.f, 'text-way-fat'],
              ].map(([label, v, cls]) => (
                <div key={label} className="flex flex-col gap-1 border-l border-way-line pl-3.5">
                  <span className="text-[11px] text-way-mute">{label}</span>
                  <span className={cx('font-mono text-[17px] font-semibold leading-normal', cls)}>
                    {fmt(v)}
                    <span className="text-[11px] text-way-dim">g</span>
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={logIt}
              disabled={!n || saving}
              className={cx(
                'flex h-[50px] items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold transition-colors',
                n ? 'bg-way-protein text-way-page hover:bg-emerald-300' : 'bg-way-track text-way-faint'
              )}
            >
              <Check size={16} />
              {saving ? 'Logging…' : n ? `Log ${n} item${n > 1 ? 's' : ''} to ${mealLabel.toLowerCase()}` : 'Add something to log'}
            </button>
          </Card>

          <Card className="flex flex-col gap-3.5 p-[22px]">
            <div className="flex items-baseline justify-between gap-2">
              <Eyebrow>{date === today ? 'Your day after this meal' : `${day.whenShort} after this meal`}</Eyebrow>
              {legend}
            </div>
            {proj.map((p) => (
              <div key={p.label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="flex items-center gap-[7px] text-[13px] text-way-mute">
                    <Dot color={p.color} size={7} />
                    {p.label}
                  </span>
                  <span className="font-mono text-xs font-semibold">
                    {p.after}
                    <span className="text-way-dim">
                      {' '}
                      / {p.t}
                      {p.unit}
                    </span>
                    <span className="ml-2" style={{ color: p.statusColor }}>
                      {p.status}
                    </span>
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded bg-way-track">
                  <div className="h-full bg-way-line3 transition-[width] duration-500" style={{ width: `${p.beforePct}%` }} />
                  <div className="h-full transition-[width] duration-500" style={{ width: `${p.addPct}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </Card>
        </aside>
      </div>

      {/* Phones: the tray stays above the bottom bar */}
      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-40 flex md:bottom-0 md:left-[76px] md:pb-[env(safe-area-inset-bottom)] flex-col rounded-t-[20px] border-t border-way-line2 bg-[#0d1320] shadow-[0_-12px_30px_rgba(0,0,0,.4)] lg:hidden">
        {trayOpen && n ? (
          <div className="no-scrollbar flex max-h-[340px] flex-col gap-3 overflow-auto px-3.5 pb-1 pt-3.5">
            <div className="flex flex-col">{trayRows}</div>
            <div className="flex flex-col gap-[9px] border-t border-way-line pt-3">
              <div className="flex justify-between text-[11px] text-way-mute">
                <span>{date === today ? 'Your day after this meal' : `${day.whenShort} after this meal`}</span>
                {legend}
              </div>
              {proj.map((p) => (
                <div key={p.label} className="grid grid-cols-[50px_minmax(0,1fr)_72px] items-center gap-2">
                  <span className="text-[11px] text-way-mute">{p.label}</span>
                  <div className="flex h-2 overflow-hidden rounded bg-way-track">
                    <div className="h-full bg-way-line3 transition-[width] duration-500" style={{ width: `${p.beforePct}%` }} />
                    <div className="h-full transition-[width] duration-500" style={{ width: `${p.addPct}%`, background: p.color }} />
                  </div>
                  <span className="text-right font-mono text-[10px] font-semibold" style={{ color: p.statusColor }}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2.5 px-3.5 pb-3 pt-2.5">
          <button type="button" onClick={() => setTrayOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-way-track text-way-ink2">
              <Utensils size={17} />
              <span className="absolute -right-[5px] -top-[5px] h-[18px] min-w-[18px] rounded-[9px] bg-way-protein px-1 text-center font-mono text-[10px] font-semibold leading-[18px] text-way-page">
                {n}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="flex items-baseline gap-1.5">
                <span className="font-mono text-[17px] font-semibold leading-none text-way-kcal">{fmt(tot.k)}</span>
                <span className="font-mono text-[10px] font-medium text-way-dim">kcal</span>
                {trayOpen ? <ChevronDown size={13} className="ml-0.5 text-way-dim" /> : <ChevronUp size={13} className="ml-0.5 text-way-dim" />}
              </span>
              <span className="font-mono text-[10px] font-medium text-way-mute">
                <span className="text-way-protein">P {fmt(tot.p)}</span> · <span className="text-way-carbs">C {fmt(tot.c)}</span> ·{' '}
                <span className="text-way-fat">F {fmt(tot.f)}</span>
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={logIt}
            disabled={!n || saving}
            className={cx(
              'flex h-12 shrink-0 items-center gap-[7px] rounded-[14px] px-[18px] text-sm font-semibold transition-colors',
              n ? 'bg-way-protein text-way-page' : 'bg-way-track text-way-faint'
            )}
          >
            <Check size={15} />
            {saving ? 'Logging…' : n ? `Log ${mealLabel.toLowerCase()}` : 'Log'}
          </button>
        </div>
      </div>
      {editing ? (
        <AmountSheet
          open
          onClose={() => setEditing(null)}
          food={editing.food}
          grams={editing.grams}
          portion={pOf(editing.food)}
          defaultPortion={portionOf(editing.food)}
          loadRecipe={recipeIds.has(editing.food.id) ? loadRecipe : null}
          onApply={applyAmount}
        />
      ) : null}
      {toastNode}
    </main>
  );
}
