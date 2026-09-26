'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { getCurrentUserId } from '@/lib/currentUser';
import { getCachedFoods, peekCachedFoods } from '@/lib/cache/foodCache';
import { UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react';
import { ui } from '@/lib/ui';

const PAGE_SIZE = 10;

export default function MyDishesPanel({ onAdd }) {
  const supabase = createClient();
  const [userId, setUserId] = useState(null);
  const [foods, setFoods] = useState(() => peekCachedFoods() ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [id, data] = await Promise.all([
          getCurrentUserId(supabase),
          getCachedFoods(supabase),
        ]);
        if (isMounted) {
          setUserId(id);
          setFoods(data);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Could not load your dishes.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const handleQuantityChange = (foodId, value) => {
    setQuantities((prev) => ({ ...prev, [foodId]: value }));
  };

  const handleAdd = (food) => {
    const qty = Number(quantities[food.id] ?? 100);
    if (!qty || qty <= 0) return;
    onAdd(food, qty);
  };

  if (loading) {
    return (
      <div className={`${ui.card} text-sm text-slate-500 dark:text-slate-400`}>
        Loading your dishes...
      </div>
    );
  }

  if (error) {
    return <div className={`${ui.card} text-sm text-rose-600 dark:text-rose-400`}>{error}</div>;
  }

  // The cache already comes ordered newest-first, so no client-side sort
  // is needed — just filter down to this user's own rows.
  const myDishes = foods.filter((f) => f.created_by === userId);

  if (myDishes.length === 0) {
    return (
      <div className={`${ui.card} text-sm text-slate-500 dark:text-slate-400`}>
        You haven&apos;t added any custom dishes yet — use{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">Build recipe</span>{' '}
        to create one.
      </div>
    );
  }

  const visible = showAll ? myDishes : myDishes.slice(0, PAGE_SIZE);
  const remaining = myDishes.length - PAGE_SIZE;

  return (
    <div className={`${ui.card} space-y-3`}>
      <h2 className={ui.subheading}>
        <UtensilsCrossed size={15} className="text-sky-500" /> Your Dishes
      </h2>

      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {visible.map((food) => (
          <li key={food.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 dark:text-white truncate">{food.name}</p>
              <p className="font-numeric text-xs text-slate-400 dark:text-slate-500">
                {Math.round(food.calories_kcal)} kcal/100g
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min="1"
                value={quantities[food.id] ?? 100}
                onChange={(e) => handleQuantityChange(food.id, e.target.value)}
                className={`${ui.inputCompact} w-16`}
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">g</span>
              <button type="button" onClick={() => handleAdd(food)} className={ui.btnSmall}>
                Add
              </button>
            </div>
          </li>
        ))}
      </ul>

      {myDishes.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white pt-1 transition"
        >
          {showAll ? (
            <>
              Show less <ChevronUp size={14} />
            </>
          ) : (
            <>
              View more ({remaining} more) <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </div>
  );
}
