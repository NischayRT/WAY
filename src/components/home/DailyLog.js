'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { MEAL_CATEGORIES } from '@/lib/mealCategories';
import { Trash2, Check, Edit2, X, Calendar, Clock, ChefHat, UtensilsCrossed, Plus, RefreshCw } from 'lucide-react';
import { ui } from '@/lib/ui';
import { syncToGoogleHealth, syncToGoogleHealthAndWait, describeSyncResult } from '@/lib/googleHealthSyncClient';

function todayLocalDate() {
  return new Date().toISOString().split('T')[0];
}

// These three always get a column. Any other category the user logs into
// (snacks, beverage, other) gets its own row underneath.
const CORE_MEALS = ['breakfast', 'lunch', 'dinner'];
const EMPTY_TOTALS = { calories: 0, protein: 0, carbs: 0, fat: 0 };

// Title on the left, quick actions pinned top-right. `ml-auto` keeps the
// buttons on the right even when a very narrow screen wraps them under
// the title. "Sync food" only appears when Google Health is connected.
function DailyLogHeader({ showSync, syncing, onSync, syncMsg, canSync }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={ui.subheading}>Daily log</h2>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {showSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing || !canSync}
              title={canSync ? "Send this day's meals and macros to Google Health" : 'Nothing logged on this day yet'}
              className={`${ui.btnSecondary} disabled:opacity-50`}
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync food'}
            </button>
          )}
          <Link href="/add-food" className={ui.btnSecondary}>
            <ChefHat size={15} /> Add recipe
          </Link>
          <Link href="/log-food" className={ui.btnPrimary}>
            <UtensilsCrossed size={15} /> Log food
          </Link>
        </div>
      </div>
      {syncMsg && (
        <p
          className={`text-right text-[11px] font-medium ${
            syncMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {syncMsg.text}
        </p>
      )}
    </div>
  );
}

export default function DailyLog({ categories, selectedDate, today, googleHealthConnected = false }) {
  const supabase = createClient();
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [editQty, setEditQty] = useState('');
  const [editMeal, setEditMeal] = useState('');
  const [editDate, setEditDate] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const startEditing = (log) => {
    setEditingId(log.id);
    setEditQty(log.quantity_g);
    setEditMeal(log.meal_type);
    setEditDate(log.logged_at);
  };

  // Every food_log id shown for the day being viewed.
  const dayLogIds = (categories ?? []).flatMap((c) => c.items.map((l) => l.id));

  const handleSyncFood = async () => {
    if (dayLogIds.length === 0) return;
    setSyncing(true);
    setSyncMsg(null);
    const res = await syncToGoogleHealthAndWait({ action: 'food_upsert', logIds: dayLogIds });
    setSyncMsg(describeSyncResult('Food', res));
    setSyncing(false);
    if (res?.ok) router.refresh();
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
    syncToGoogleHealth({ action: 'food_upsert', logIds: [logId] });
    setBusyId(null);
    setEditingId(null);
    router.refresh();
  };

  const handleDelete = async (logId) => {
    if (!confirm('Are you sure you want to remove this entry?')) return;
    setBusyId(logId);
    // Remove the Google Health copy first, while the row still knows its id.
    await syncToGoogleHealthAndWait({ action: 'food_delete', logIds: [logId] });
    await supabase.from('food_logs').delete().eq('id', logId);
    setBusyId(null);
    setEditingId(null);
    router.refresh();
  };

  // Carry the day being viewed (and the meal) over to the log-food page.
  const logHref = (meal) => {
    const qs = new URLSearchParams();
    if (selectedDate && selectedDate !== today) qs.set('date', selectedDate);
    qs.set('meal', meal);
    return `/log-food?${qs.toString()}`;
  };

  const safeCategories = categories ?? [];
  const coreColumns = CORE_MEALS.map((key) => {
    const found = safeCategories.find((c) => c.value === key);
    if (found) return found;
    const label = MEAL_CATEGORIES.find((c) => c.value === key)?.label ?? key;
    return { value: key, label, items: [], totals: EMPTY_TOTALS };
  });
  const extraRows = safeCategories.filter((c) => !CORE_MEALS.includes(c.value));

  const renderItem = (log, boxed) => {
    const isEditing = editingId === log.id;
    const ratio = log.quantity_g / 100;
    const kcal = Math.round(log.foods.calories_kcal * ratio);
    const protein = Math.round(log.foods.protein_g * ratio * 10) / 10;
    const carbs = Math.round(log.foods.carbs_g * ratio * 10) / 10;
    const fat = Math.round(log.foods.fat_g * ratio * 10) / 10;

    return (
      <li
        key={log.id}
        className={
          boxed
            ? 'rounded-xl border border-slate-100 dark:border-slate-800 p-3 transition-colors'
            : 'py-3 transition-colors'
        }
      >
        {!isEditing ? (
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                  {log.foods.name}
                </p>
                <span className="font-numeric text-xs text-slate-400 dark:text-slate-400 shrink-0">
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
              className={`${ui.btnSmall} shrink-0`}
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

            {/* Single column: each meal card is only a third of the row. */}
            <div className="grid grid-cols-1 gap-2">
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
                  className={`${ui.input} w-full`}
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
                  className={`${ui.select} w-full`}
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
                  className={`${ui.input} w-full`}
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
  };

  const renderHeader = (cat) => (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-900 dark:bg-amber-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{cat.label}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 font-numeric text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
        <span className="text-amber-600 dark:text-amber-400">{cat.totals.calories} kcal</span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span className="text-emerald-600 dark:text-emerald-400">{cat.totals.protein}g P</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <DailyLogHeader
        showSync={googleHealthConnected}
        canSync={dayLogIds.length > 0}
        syncing={syncing}
        onSync={handleSyncFood}
        syncMsg={syncMsg}
      />

      {/* Breakfast | Lunch | Dinner, always shown, side by side. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {coreColumns.map((cat) => (
          <div
            key={cat.value}
            id={`daily-log-${cat.value}`}
            tabIndex={-1}
            className={`${ui.card} scroll-mt-24 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/30`}
          >
            {renderHeader(cat)}
            {cat.items.length === 0 ? (
              <Link
                href={logHref(cat.value)}
                className="mt-3 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 px-3 py-6 text-center transition-colors hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <Plus size={13} /> Log {cat.label.toLowerCase()}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Nothing logged yet</span>
              </Link>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {cat.items.map((log) => renderItem(log, false))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Any other category the user logged into: one new row per category. */}
      {extraRows.map((cat) => (
        <div key={cat.value} id={`daily-log-${cat.value}`} className={ui.card}>
          {renderHeader(cat)}
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {cat.items.map((log) => renderItem(log, true))}
          </ul>
        </div>
      ))}
    </div>
  );
}