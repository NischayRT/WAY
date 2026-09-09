'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { ChefHat, Search } from 'lucide-react';
import { ui, authorTag } from '@/lib/ui';

export default function DishBuilder({ onAdd }) {
  const supabase = createClient();
  const [allIngredients, setAllIngredients] = useState([]);
  const [query, setQuery] = useState('');
  const [haveList, setHaveList] = useState([]);
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('ingredients').select('id, name').order('name');
      setAllIngredients(data ?? []);
    };
    load();
  }, []);

  const filtered =
    query.trim().length === 0
      ? []
      : allIngredients
          .filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
          .filter((i) => !haveList.some((h) => h.id === i.id));

  const addHave = (ing) => {
    setHaveList((prev) => [...prev, ing]);
    setQuery('');
    setMatches(null);
  };

  const removeHave = (id) => {
    setHaveList((prev) => prev.filter((h) => h.id !== id));
    setMatches(null);
  };

  const handleFind = async () => {
    if (haveList.length === 0) return;
    setLoading(true);
    const res = await fetch('/api/dish-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientIds: haveList.map((h) => h.id) }),
    });
    const data = await res.json();
    const found = data.matches ?? [];
    setMatches(found);
    const initialQty = {};
    found.forEach((m) => {
      initialQty[m.food.id] = 100;
    });
    setQuantities(initialQty);
    setLoading(false);
  };

  const handleAdd = (food) => {
    const qty = Number(quantities[food.id] ?? 100);
    if (!qty || qty <= 0) return;
    onAdd(food, qty);
  };

  return (
    <div className={`${ui.card} space-y-3`}>
      <div>
        <h2 className={ui.subheading}>
          <ChefHat size={15} className="text-amber-500" /> What can I cook?
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Add what you have on hand and we&apos;ll suggest dishes that use it.
        </p>
      </div>
      <label className={ui.label}>
        Your ingredients
        <div className="relative mt-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. onion, paneer, rice"
            className={`${ui.input} mt-0 pl-9`}
          />
        </div>
      </label>
      {query.trim().length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches.</li>
          )}
          {filtered.map((ing) => (
            <li key={ing.id}>
              <button
                type="button"
                onClick={() => addHave(ing)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-medium"
              >
                {ing.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {haveList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {haveList.map((h) => (
            <span
              key={h.id}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs text-slate-800 dark:text-white"
            >
              {h.name}
              <button
                type="button"
                onClick={() => removeHave(h.id)}
                className="font-bold text-rose-500 hover:text-rose-600 ml-0.5"
                aria-label={`Remove ${h.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={handleFind}
        disabled={haveList.length === 0 || loading}
        className={`${ui.btnPrimary} w-full`}
      >
        {loading ? 'Finding dishes...' : 'Find dishes I can make'}
      </button>
      {matches && matches.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No dishes matched yet — try adding more ingredients.
        </p>
      )}
      {matches && matches.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          {matches.map(({ food, matched, total, missing }) => (
            <li
              key={food.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {food.name}
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                    {authorTag(food)}
                  </span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-numeric font-bold text-slate-700 dark:text-slate-300">
                    {matched}/{total}
                  </span>{' '}
                  ingredients you have
                  {missing.length > 0 && ` · missing: ${missing.join(', ')}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={quantities[food.id] ?? 100}
                  onChange={(e) =>
                    setQuantities((prev) => ({ ...prev, [food.id]: e.target.value }))
                  }
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
      )}
    </div>
  );
}