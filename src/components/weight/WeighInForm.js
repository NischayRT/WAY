'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { ui } from '@/lib/ui';
import { getCurrentUserId } from '@/lib/currentUser';

function todayLocalDate() {
  return new Date().toISOString().split('T')[0];
}

export default function WeighInForm() {
  const supabase = createClient();
  const router = useRouter();
  const [weightKg, setWeightKg] = useState('');
  const [loggedAt, setLoggedAt] = useState(todayLocalDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    const { error: upsertError } = await supabase.from('weight_logs').upsert(
      { user_id: userId, weight_kg: Number(weightKg), logged_at: loggedAt },
      { onConflict: 'user_id,logged_at' }
    );
    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setWeightKg('');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className={`${ui.label} flex-1`}>
          Date
          <input
            type="date"
            value={loggedAt}
            max={todayLocalDate()}
            onChange={(e) => setLoggedAt(e.target.value)}
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} flex-1`}>
          Weight (kg)
          <input
            type="number"
            step="0.1"
            required
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="e.g. 74.5"
            className={ui.input}
          />
        </label>
        <button type="submit" disabled={saving} className={`${ui.btnPrimary} sm:mb-0.5`}>
          {saving ? 'Saving...' : 'Log weight'}
        </button>
      </div>
      {error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </form>
  );
}