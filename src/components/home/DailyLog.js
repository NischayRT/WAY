'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { MEAL_CATEGORIES } from '@/lib/mealCategories';
import { Trash2, Check, Edit2, X, Calendar, Clock } from 'lucide-react';
import { ui } from '@/lib/ui';

function todayLocalDate() {
  return new Date().toISOString().split('T')[0];
}

export default function DailyLog({ categories }) {
  const supabase = createClient();
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [editQty, setEditQty] = useState('');
  const [editMeal, setEditMeal] = useState('');
  const [editDate, setEditDate] = useState('');

  const startEditing = (log) => {
    setEditingId(log.id);
    setEditQty(log.quantity_g);
    setEditMeal(log.meal_type);
    setEditDate(log.logged_at);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSave = async (logId) => {
    const qty = Number(editQty);
    if (!qty || qty <= 0) return;
    setBusyId(logId);
    await supabase
      .from('food_logs')
      .update({
        quantity_g: qty,
        meal_type: editMeal,
        logged_at: editDate,
      })
      .eq('id', logId);
    setBusyId(null);
    setEditingId(null);
    router.refresh();
  };

  const handleDelete = async (logId) => {
    if (!confirm('Are you sure you want to remove this entry?')) return;
    setBusyId(logId);
    await supabase.from('food_logs').delete().eq('id', logId);
    setBusyId(null);
    setEditingId(null);
    router.refresh();
  };

  if (!categories || categories.length === 0) {
    return (
      <Link className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-8 text-center" href="/log-food">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No foods logged for this date.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Click to track your meals.</p>
      </Link>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.value} className={ui.card}>
          {/* Category Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-900 dark:bg-amber-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{cat.label}</h2>
            </div>
            <div className="flex items-center gap-1.5 font-numeric text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
              <span className="text-amber-600 dark:text-amber-400">{cat.totals.calories} kcal</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-emerald-600 dark:text-emerald-400">{cat.totals.protein}g P</span>
            </div>
          </div>

          {/* Item List */}
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {cat.items.map((log) => {
              const isEditing = editingId === log.id;
              const ratio = log.quantity_g / 100;
              const kcal = Math.round(log.foods.calories_kcal * ratio);
              const protein = Math.round(log.foods.protein_g * ratio * 10) / 10;
              const carbs = Math.round(log.foods.carbs_g * ratio * 10) / 10;
              const fat = Math.round(log.foods.fat_g * ratio * 10) / 10;

              return (
                <li key={log.id} className="py-3 transition-colors">
                  {!isEditing ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {log.foods.name}
                          </p>
                          <span className="font-numeric text-xs text-slate-400 dark:text-slate-400">
                            {log.quantity_g}g
                          </span>
                        </div>

                        {/* Macro badges */}
                        <div className="flex flex-wrap items-center gap-1.5 font-numeric text-[11px]">
                          <span className="rounded-md border px-1.5 py-0.5 font-medium border-amber-200/60 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                            {kcal} kcal
                          </span>
                          <span className="rounded-md border px-1.5 py-0.5 font-medium border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                            {protein}g P
                          </span>
                          <span className="rounded-md border px-1.5 py-0.5 font-medium border-blue-200/60 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                            {carbs}g C
                          </span>
                          <span className="rounded-md border px-1.5 py-0.5 font-medium border-violet-200/60 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300">
                            {fat}g F
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEditing(log)}
                        disabled={busyId === log.id}
                        className={ui.btnSmall}
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Edit Entry
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(log.id)}
                          disabled={busyId === log.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
                            Quantity (g)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            disabled={busyId === log.id}
                            className={ui.input}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                            <Clock size={10} /> Meal
                          </label>
                          <select
                            value={editMeal}
                            onChange={(e) => setEditMeal(e.target.value)}
                            disabled={busyId === log.id}
                            className={ui.select}
                          >
                            {MEAL_CATEGORIES.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                            <Calendar size={10} /> Date
                          </label>
                          <input
                            type="date"
                            value={editDate}
                            max={todayLocalDate()}
                            onChange={(e) => setEditDate(e.target.value)}
                            disabled={busyId === log.id}
                            className={ui.input}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={busyId === log.id}
                          className={ui.btnSecondary}
                        >
                          <X size={12} /> Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(log.id)}
                          disabled={busyId === log.id}
                          className={ui.btnPrimary}
                        >
                          <Check size={12} /> Save
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}