'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { ui, authorTag } from '@/lib/ui';

export default function ClosestMatchPicker({ onMatchSelected }) {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matchedName, setMatchedName] = useState(null);

  useEffect(() => {
    const search = async () => {
      if (query.trim().length === 0) {
        setFoods([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('foods')
        .select('id, name, region, created_by, author_name')
        .ilike('name', `%${query.trim()}%`)
        .limit(8);
      setFoods(data ?? []);
      setLoading(false);
    };
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handlePick = async (food) => {
    setMatchedName(food.name);
    setFoods([]);
    setQuery(food.name);
    const { data: recipeLines } = await supabase
      .from('dish_ingredients')
      .select('quantity_g, ingredients (id, name, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g)')
      .eq('food_id', food.id);

    if (recipeLines && recipeLines.length > 0) {
      const lines = recipeLines.map((rl) => ({
        ingredient: rl.ingredients,
        quantityG: rl.quantity_g,
      }));
      onMatchSelected(lines);
    } else {
      onMatchSelected([]);
    }
  };

  return (
    <div className="space-y-2">
      <label className={ui.label}>
        What&apos;s it closest to? (optional)
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMatchedName(null);
          }}
          placeholder="Search existing dishes to prefill ingredients"
          className={ui.input}
        />
      </label>

      {loading && <p className="text-xs text-slate-400 dark:text-slate-500">Searching...</p>}

      {foods.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-md">
          {foods.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => handlePick(f)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
              >
                <span className="font-semibold">{f.name}</span>
                {f.region ? ` — ${f.region}` : ''}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                  {authorTag(f)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {matchedName && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Loaded ingredients from &quot;{matchedName}&quot; — edit freely below.
        </p>
      )}
    </div>
  );
}