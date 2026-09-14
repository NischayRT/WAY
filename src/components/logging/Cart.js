'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { MEAL_CATEGORIES } from '@/lib/mealCategories';
import { ShoppingBag } from 'lucide-react';
import { ui } from '@/lib/ui';

export default function Cart({ userId, items, onUpdateQuantity, onRemove, onLogged }) {
  const supabase = createClient();
  const router = useRouter();
  const [mealType, setMealType] = useState('lunch');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const totals = items.reduce(
    (acc, item) => {
      const ratio = item.quantityG / 100;
      return {
        calories: acc.calories + item.food.calories_kcal * ratio,
        protein: acc.protein + item.food.protein_g * ratio,
        carbs: acc.carbs + item.food.carbs_g * ratio,
        fat: acc.fat + item.food.fat_g * ratio,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const handleLog = async () => {
    if (items.length === 0) return;
    setSaving(true);
    setError(null);

    const rows = items.map((item) => ({
      user_id: userId,
      food_id: item.food.id,
      quantity_g: item.quantityG,
      meal_type: mealType,
    }));

    const { error: insertError } = await supabase.from('food_logs').insert(rows);
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onLogged();
    router.refresh();
  };

  return (
    <div id="cart-section" className={`${ui.card} space-y-3 scroll-mt-20`}>
      <h2 className={ui.subheading}>
        <ShoppingBag size={15} className="text-emerald-500" /> Your meal
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nothing added yet — search or pick a recommendation to build your meal.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="flex-1 text-slate-900 dark:text-white font-medium">{item.food.name}</span>
                <input
                  type="number"
                  min="1"
                  value={item.quantityG}
                  onChange={(e) => onUpdateQuantity(i, Number(e.target.value))}
                  className={`${ui.inputCompact} w-16`}
                />
                <span className="text-slate-400 dark:text-slate-500 text-xs">g</span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className="font-numeric text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span className={ui.macroText.calories}>{Math.round(totals.calories)} kcal</span> ·{' '}
            <span className={ui.macroText.protein}>{Math.round(totals.protein)}g protein</span> ·{' '}
            <span className={ui.macroText.carbs}>{Math.round(totals.carbs)}g carbs</span> ·{' '}
            <span className={ui.macroText.fat}>{Math.round(totals.fat)}g fat</span>
          </p>
          <label className={ui.label}>
            When did you eat this?
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className={ui.select}
            >
              {MEAL_CATEGORIES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <button
            type="button"
            onClick={handleLog}
            disabled={saving}
            className={`${ui.btnPrimary} w-full`}
          >
            {saving ? 'Logging...' : `Log ${items.length} item${items.length > 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </div>
  );
}