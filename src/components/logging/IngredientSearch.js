'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { ui } from '@/lib/ui';

const CATEGORIES = [
  'grain', 'lentil', 'vegetable', 'dairy', 'oil_fat', 'meat', 'spice', 'sweetener', 'other',
];

export default function IngredientSearch({ userId, onAdd }) {
  const supabase = createClient();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [quantityG, setQuantityG] = useState(50);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    category: 'vegetable',
    caloriesKcal: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
  });
  const [savingNew, setSavingNew] = useState(false);
  const [newError, setNewError] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('ingredients')
        .select('id, name, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g')
        .order('name');
      setIngredients(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered =
    query.trim().length === 0
      ? []
      : ingredients.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));

  const handleAdd = () => {
    if (!selected) return;
    onAdd({ ingredient: selected, quantityG: Number(quantityG) });
    setSelected(null);
    setQuery('');
    setQuantityG(50);
  };

  const handleNewIngredientChange = (field) => (e) =>
    setNewIngredient((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSaveNewIngredient = async () => {
    if (!query.trim()) {
      setNewError('Enter a name above first.');
      return;
    }
    setSavingNew(true);
    setNewError(null);
    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        name: query.trim(),
        category: newIngredient.category,
        calories_kcal: Number(newIngredient.caloriesKcal),
        protein_g: Number(newIngredient.proteinG),
        carbs_g: Number(newIngredient.carbsG),
        fat_g: Number(newIngredient.fatG),
        fiber_g: newIngredient.fiberG ? Number(newIngredient.fiberG) : null,
        source: 'community_estimated',
        created_by: userId,
      })
      .select()
      .single();

    setSavingNew(false);
    if (error) {
      setNewError(error.message);
      return;
    }
    setIngredients((prev) => [...prev, data]);
    setSelected(data);
    setShowNewForm(false);
    setNewIngredient({
      category: 'vegetable',
      caloriesKcal: '',
      proteinG: '',
      carbsG: '',
      fatG: '',
      fiberG: '',
    });
  };

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading ingredients...</p>;

  return (
    <div className={`${ui.cardMuted} space-y-3`}>
      <label className={ui.label}>
        Add ingredient
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setShowNewForm(false);
          }}
          placeholder="e.g. onion, toor dal, ghee"
          className={ui.input}
        />
      </label>

      {query.trim().length > 0 && !selected && !showNewForm && (
        <ul className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-md">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">No matches found.</li>
          )}
          {filtered.map((ing) => (
            <li key={ing.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(ing);
                  setQuery(ing.name);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white"
              >
                <span className="font-semibold">{ing.name}</span>{' '}
                <span className="font-numeric text-slate-400 dark:text-slate-500 text-xs">
                  · {ing.calories_kcal} kcal/100g
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="w-full px-3 py-2 text-left text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              + Add &quot;{query.trim()}&quot; as a new ingredient
            </button>
          </li>
        </ul>
      )}

      {showNewForm && (
        <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-sm font-bold text-slate-900 dark:text-white">New ingredient: {query.trim()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Enter values per 100g, raw/uncooked form.</p>

          <label className={ui.label}>
            Category
            <select
              value={newIngredient.category}
              onChange={handleNewIngredientChange('category')}
              className={ui.select}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className={ui.label}>
              Calories (kcal)
              <input
                type="number"
                step="0.1"
                value={newIngredient.caloriesKcal}
                onChange={handleNewIngredientChange('caloriesKcal')}
                className={ui.input}
              />
            </label>
            <label className={ui.label}>
              Protein (g)
              <input
                type="number"
                step="0.1"
                value={newIngredient.proteinG}
                onChange={handleNewIngredientChange('proteinG')}
                className={ui.input}
              />
            </label>
            <label className={ui.label}>
              Carbs (g)
              <input
                type="number"
                step="0.1"
                value={newIngredient.carbsG}
                onChange={handleNewIngredientChange('carbsG')}
                className={ui.input}
              />
            </label>
            <label className={ui.label}>
              Fat (g)
              <input
                type="number"
                step="0.1"
                value={newIngredient.fatG}
                onChange={handleNewIngredientChange('fatG')}
                className={ui.input}
              />
            </label>
            <label className={`${ui.label} col-span-2`}>
              Fiber (g) — optional
              <input
                type="number"
                step="0.1"
                value={newIngredient.fiberG}
                onChange={handleNewIngredientChange('fiberG')}
                className={ui.input}
              />
            </label>
          </div>

          {newError && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{newError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveNewIngredient}
              disabled={savingNew}
              className={ui.btnPrimary}
            >
              {savingNew ? 'Saving...' : 'Save ingredient'}
            </button>
            <button type="button" onClick={() => setShowNewForm(false)} className={ui.btnSecondary}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="flex items-end gap-2 pt-1">
          <label className={`${ui.label} flex-1`}>
            Quantity (g)
            <input
              type="number"
              min="1"
              value={quantityG}
              onChange={(e) => setQuantityG(e.target.value)}
              className={ui.input}
            />
          </label>
          <button type="button" onClick={handleAdd} className={ui.btnPrimary}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}