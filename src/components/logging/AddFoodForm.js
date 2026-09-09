'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { computeDishNutrition } from '@/lib/recipeNutrition';
import { ui } from '@/lib/ui';
import IngredientSearch from './IngredientSearch';
import ClosestMatchPicker from './ClosestMatchPicker';

const COOKING_METHODS = [
  'curry', 'dry_curry', 'deep_fried', 'shallow_fried', 'baked', 'grilled',
  'steamed', 'boiled', 'roasted', 'stir_fried', 'raw', 'fermented', 'pickled',
];
const DISH_CLASSES = [
  'main', 'snack', 'dessert', 'beverage', 'bread', 'rice_dish',
  'soup_stew', 'dairy', 'condiment', 'leftover',
];
const label = (s) => s.replace(/_/g, ' ');

export default function AddFoodForm({ userId, authorName }) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [cookingMethod, setCookingMethod] = useState('');
  const [dishClass, setDishClass] = useState('');
  const [lines, setLines] = useState([]);
  const [finalWeightG, setFinalWeightG] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const rawWeightG = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.quantityG), 0),
    [lines]
  );

  const preview = useMemo(() => {
    if (lines.length === 0 || !finalWeightG || Number(finalWeightG) <= 0) return null;
    try {
      return computeDishNutrition(lines, Number(finalWeightG));
    } catch {
      return null;
    }
  }, [lines, finalWeightG]);

  const handleMatchSelected = (prefillLines) => {
    setLines(prefillLines);
  };

  const handleRemoveLine = (index) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index, value) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, quantityG: Number(value) } : l))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Give the dish a name.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one ingredient.');
      return;
    }
    let result;
    try {
      result = computeDishNutrition(lines, Number(finalWeightG));
    } catch (calcError) {
      setError(calcError.message);
      return;
    }

    setSaving(true);
    const { data: insertedFood, error: insertError } = await supabase
      .from('foods')
      .insert({
        name: name.trim(),
        region: region.trim() || null,
        category: 'custom',
        cooking_method: cookingMethod || null,
        dish_class: dishClass || null,
        calories_kcal: result.per100g.calories_kcal,
        protein_g: result.per100g.protein_g,
        carbs_g: result.per100g.carbs_g,
        fat_g: result.per100g.fat_g,
        fiber_g: result.per100g.fiber_g,
        raw_weight_g: result.rawWeightG,
        final_weight_g: result.finalWeightG,
        source: 'user_calculated',
        created_by: userId,
        author_name: authorName || null,
      })
      .select('id')
      .single();

    if (insertError) {
      setSaving(false);
      setError(insertError.message);
      return;
    }

    const recipeRows = lines.map((l) => ({
      food_id: insertedFood.id,
      ingredient_id: l.ingredient.id,
      quantity_g: l.quantityG,
    }));

    const { error: recipeError } = await supabase.from('dish_ingredients').insert(recipeRows);
    setSaving(false);
    if (recipeError) {
      setError(recipeError.message);
      return;
    }
    router.push('/log-food');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      <div className="space-y-4">
        <label className={ui.label}>
          Dish name
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amma's Chicken Chettinad"
            className={ui.input}
          />
        </label>

        <ClosestMatchPicker onMatchSelected={handleMatchSelected} />

        <label className={ui.label}>
          Region (optional)
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Home recipe, Tamil Nadu"
            className={ui.input}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className={ui.label}>
            Cooking method
            <select
              value={cookingMethod}
              onChange={(e) => setCookingMethod(e.target.value)}
              className={ui.select}
            >
              <option value="">Select...</option>
              {COOKING_METHODS.map((m) => (
                <option key={m} value={m}>
                  {label(m)}
                </option>
              ))}
            </select>
          </label>

          <label className={ui.label}>
            Dish class
            <select
              value={dishClass}
              onChange={(e) => setDishClass(e.target.value)}
              className={ui.select}
            >
              <option value="">Select...</option>
              {DISH_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className={ui.subheading}>Ingredients</h2>
        {lines.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-800 dark:text-white">
                <span className="flex-1">{l.ingredient.name}</span>
                <input
                  type="number"
                  min="1"
                  value={l.quantityG}
                  onChange={(e) => handleQuantityChange(i, e.target.value)}
                  className={`${ui.inputCompact} w-20`}
                />
                <span className="text-slate-400 dark:text-slate-500">g</span>
                <button
                  type="button"
                  onClick={() => handleRemoveLine(i)}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <IngredientSearch userId={userId} onAdd={(line) => setLines((prev) => [...prev, line])} />

        {lines.length > 0 && (
          <p className="font-numeric text-xs text-slate-400 dark:text-slate-500">
            Total raw weight: <strong className="text-slate-700 dark:text-slate-200">{rawWeightG}g</strong>
          </p>
        )}
      </div>

      <label className={ui.label}>
        Final weight after cooking (g)
        <input
          type="number"
          min="1"
          value={finalWeightG}
          onChange={(e) => setFinalWeightG(e.target.value)}
          placeholder="Weigh the finished dish"
          className={ui.input}
        />
        <span className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          This accounts for water lost or gained during cooking.
        </span>
      </label>

      {preview && (
        <div className={`${ui.cardMuted} text-sm space-y-1`}>
          <p className="font-semibold text-slate-800 dark:text-white">Per 100g of finished dish:</p>
          <p className="font-numeric text-slate-600 dark:text-slate-300">
            <span className={ui.macroText.calories}>{preview.per100g.calories_kcal} kcal</span> ·{' '}
            <span className={ui.macroText.protein}>{preview.per100g.protein_g}g protein</span> ·{' '}
            <span className={ui.macroText.carbs}>{preview.per100g.carbs_g}g carbs</span> ·{' '}
            <span className={ui.macroText.fat}>{preview.per100g.fat_g}g fat</span> ·{' '}
            {preview.per100g.fiber_g}g fiber
          </p>
        </div>
      )}

      {error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}

      <button type="submit" disabled={saving} className={`${ui.btnPrimary} w-full`}>
        {saving ? 'Saving...' : 'Save dish'}
      </button>
    </form>
  );
}