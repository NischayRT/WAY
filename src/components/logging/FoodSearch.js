'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Search } from 'lucide-react';
import { ui, authorTag } from '@/lib/ui';
import { getCachedFoods } from '@/lib/cache/foodCache';

export default function FoodSearch({ onAdd }) {
  const supabase = createClient();
  const [foods, setFoods] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantityG, setQuantityG] = useState(100);
  const [error, setError] = useState(null);

useEffect(() => {
  let isMounted = true;
  const loadFoods = async () => {
    const data = await getCachedFoods(supabase);
    if (isMounted) {
      setFoods(data);
      setLoadingFoods(false);
    }
  };
  loadFoods();
  return () => { isMounted = false; };
}, []);


  const filteredFoods =
    query.trim().length === 0
      ? foods
      : foods.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));

  const handleAdd = () => {
    if (!selectedFood) {
      setError('Pick a food first.');
      return;
    }
    if (!quantityG || Number(quantityG) <= 0) {
      setError('Enter a quantity greater than 0.');
      return;
    }
    onAdd(selectedFood, Number(quantityG));
    setSelectedFood(null);
    setQuery('');
    setQuantityG(100);
    setError(null);
  };

  if (loadingFoods) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading foods...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={ui.label}>
          Search food
          <div className="relative mt-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedFood(null);
              }}
              placeholder="e.g. dal, roti, dosa"
              className={`${ui.input} mt-0 pl-9`}
            />
          </div>
        </label>
        {query.trim().length > 0 && !selectedFood && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {filteredFoods.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches.</li>
            )}
            {filteredFoods.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFood(food);
                    setQuery(food.name);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
                >
                  <span className="font-semibold">{food.name}</span>
                  {food.region ? ` — ${food.region}` : ''}
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                    {authorTag(food)}
                  </span>
                  <span className="font-numeric text-slate-400 dark:text-slate-500 ml-1">
                    · {food.calories_kcal} kcal/100g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selectedFood && (
        <div className="space-y-3">
          <label className={ui.label}>
            Quantity (g)
            <input
              type="number"
              min="1"
              value={quantityG}
              onChange={(e) => setQuantityG(e.target.value)}
              className={ui.input}
            />
          </label>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <button type="button" onClick={handleAdd} className={`${ui.btnPrimary} w-full`}>
            Add {selectedFood.name} to cart
          </button>
        </div>
      )}
    </div>
  );
}