'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { Scale, Check, X } from 'lucide-react';
import { ui } from '@/lib/ui';
import { getCurrentUserId } from '@/lib/currentUser';

export default function QuickWeightLogModal({
  currentWeight,
  targetDate,
  today,
  isOpen,
  onClose,
}) {
  const supabase = createClient();
  const router = useRouter();

  const [weightKg, setWeightKg] = useState(currentWeight || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setWeightKg(currentWeight || '');
  }, [currentWeight, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedWeight = parseFloat(weightKg);
    if (!parsedWeight || parsedWeight <= 0) {
      setError('Please enter a valid weight.');
      return;
    }

    setSaving(true);
    setError(null);

    // Resolved from the session rather than taken as a prop — a prop that no
    // longer gets passed evaluates to undefined, Supabase drops the key, and
    // Postgres sees NULL. That is what broke the insert.
    let userId;
    try {
      userId = await getCurrentUserId(supabase);
    } catch (authError) {
      setSaving(false);
      setError(authError.message);
      return;
    }
    // 1. Log or update the weight entry specifically for targetDate
    const { error: weightLogError } = await supabase.from('weight_logs').upsert(
      {
        user_id: userId,
        weight_kg: parsedWeight,
        logged_at: targetDate,
      },
      { onConflict: 'user_id,logged_at' }
    );

    if (weightLogError) {
      setSaving(false);
      setError(weightLogError.message);
      return;
    }

    // 2. If the logged date is today, also synchronize the live profile weight
    if (targetDate === today) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ weight_kg: parsedWeight })
        .eq('id', userId);

      if (profileError) {
        setSaving(false);
        setError(profileError.message);
        return;
      }
    }

    setSaving(false);
    onClose();
    router.refresh();
  };

  const isToday = targetDate === today;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Scale size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isToday ? "Log Today's Weight" : `Log Weight for ${targetDate}`}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isToday
                  ? 'Updates trends & recalibrates diet targets'
                  : 'Updates trend logs & target basis for this date'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className={ui.label}>
            Weight (kg)
            <input
              type="number"
              step="0.1"
              required
              autoFocus
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="e.g. 74.5"
              className={ui.input}
            />
          </label>

          {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className={`${ui.btnSecondary} flex-1`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`${ui.btnPrimary} flex-1`}>
              {saving ? 'Saving...' : (
                <>
                  <Check size={14} /> Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}