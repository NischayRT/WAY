'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { ui, authorTag } from '@/lib/ui';

export default function RecommendedFoods({ onAdd }) {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/recommendations');
        const data = await res.json();
        const list = data.recommendations ?? [];
        setRecommendations(list);
        const initialQty = {};
        list.forEach((r) => {
          initialQty[r.food.id] = 100;
        });
        setQuantities(initialQty);
      } catch {
        setRecommendations([]);
      }
      setLoading(false);
    };
    load();
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
      <div className="flex items-center gap-2 py-4 text-xs font-medium text-slate-400 dark:text-slate-500">
        <Sparkles size={14} className="animate-spin text-amber-500" />
        <span>Curating recommendations...</span>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          <Sparkles size={14} className="text-amber-500" /> Recommended For You
        </h2>
        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Per 100g</span>
      </div>
      <div className="space-y-3">
        {recommendations.map(({ food, reason }) => (
          <div
            key={food.id}
            className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-4 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-600"
          >
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {food.name}
                  {authorTag(food) && (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400 ml-1">
                      {authorTag(food)}
                    </span>
                  )}
                </h3>
                {food.region && (
                  <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 capitalize">
                    {food.region}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{reason}</p>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5 font-numeric text-center">
              <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 py-1.5 px-1">
                <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300 leading-none">
                  {Math.round(food.calories_kcal)}
                </div>
                <div className="text-[9px] font-medium uppercase text-amber-600 dark:text-amber-400 mt-0.5">
                  kcal
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 py-1.5 px-1">
                <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 leading-none">
                  {food.protein_g}g
                </div>
                <div className="text-[9px] font-medium uppercase text-emerald-600 dark:text-emerald-400 mt-0.5">
                  protein
                </div>
              </div>
              <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/40 py-1.5 px-1">
                <div className="text-[11px] font-bold text-blue-900 dark:text-blue-300 leading-none">
                  {food.carbs_g}g
                </div>
                <div className="text-[9px] font-medium uppercase text-blue-600 dark:text-blue-400 mt-0.5">
                  carbs
                </div>
              </div>
              <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/60 bg-violet-50/70 dark:bg-violet-950/40 py-1.5 px-1">
                <div className="text-[11px] font-bold text-violet-900 dark:text-violet-300 leading-none">
                  {food.fat_g}g
                </div>
                <div className="text-[9px] font-medium uppercase text-violet-600 dark:text-violet-400 mt-0.5">
                  fat
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  value={quantities[food.id] ?? 100}
                  onChange={(e) => handleQuantityChange(food.id, e.target.value)}
                  className="w-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-center font-numeric text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-slate-400"
                />
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">g</span>
              </div>
              <button
                type="button"
                onClick={() => handleAdd(food)}
                className={ui.btnPrimary}
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Add</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}