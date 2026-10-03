'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { getDailyTargets } from '@/lib/bmrTdee';
import { ui } from '@/lib/ui';
import { getCurrentUserId } from '@/lib/currentUser';
import { User, Footprints, Target, Save } from 'lucide-react';

const GOALS = [
  { value: 'lose_weight', label: 'Lose weight' },
  { value: 'gain_muscle', label: 'Gain muscle' },
  { value: 'lean_mass', label: 'Build lean mass' },
  { value: 'improve_cardio', label: 'Improve cardio' },
  { value: 'maintain', label: 'Maintain' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light exercise' },
  { value: 'moderate', label: 'Moderate exercise' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

export default function ProfileForm({ onSaved, initialProfile, variant = 'default' }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    fullName: initialProfile?.full_name ?? '',
    heightCm: initialProfile?.height_cm ?? '',
    weightKg: initialProfile?.weight_kg ?? '',
    age: initialProfile?.age ?? '',
    sex: initialProfile?.sex ?? 'male',
    activityLevel: initialProfile?.activity_level ?? 'moderate',
    goal: initialProfile?.goal ?? 'maintain',
    stepGoal: initialProfile?.step_goal ?? '',
    distanceGoalKm: initialProfile?.distance_goal_km ?? '',
    burnGoalKcal: initialProfile?.burn_goal_kcal ?? '',
  });

  const [customizeTargets, setCustomizeTargets] = useState(
    initialProfile?.override_calories != null
  );
  const [overrides, setOverrides] = useState({
    calories: initialProfile?.override_calories ?? '',
    protein: initialProfile?.override_protein_g ?? '',
    carbs: initialProfile?.override_carbs_g ?? '',
    fat: initialProfile?.override_fat_g ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleOverrideChange = (field) => (e) =>
    setOverrides((prev) => ({ ...prev, [field]: e.target.value }));

  // Live preview — recalculates on every change to height/weight/age/
  // sex/activity/goal, using the same pure function the app uses
  // everywhere else, so this always matches what actually gets used.
  const computedTargets = useMemo(() => {
    if (!form.heightCm || !form.weightKg || !form.age) return null;
    try {
      return getDailyTargets({
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        age: Number(form.age),
        sex: form.sex,
        activityLevel: form.activityLevel,
        goal: form.goal,
      });
    } catch {
      return null;
    }
  }, [form.heightCm, form.weightKg, form.age, form.sex, form.activityLevel, form.goal]);

  const handleToggleCustomize = (e) => {
    const checked = e.target.checked;
    setCustomizeTargets(checked);
    // Seed the override fields with the calculated values the first
    // time it's turned on, so the user is editing from a sane starting
    // point rather than blank inputs.
    if (checked && !overrides.calories && computedTargets) {
      setOverrides({
        calories: computedTargets.targetCalories,
        protein: computedTargets.proteinG,
        carbs: computedTargets.carbsG,
        fat: computedTargets.fatG,
      });
    }
  };

const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Activity goals are optional: blank = no goal. If filled they must be sane.
    const parseGoal = (raw, label, min, max) => {
      if (raw === '' || raw == null) return { value: null };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < min || n > max) {
        return { error: `${label} must be between ${min} and ${max}.` };
      }
      return { value: n };
    };
    const stepGoal = parseGoal(form.stepGoal, 'Daily step goal', 1000, 100000);
    const distanceGoal = parseGoal(form.distanceGoalKm, 'Daily distance goal', 0.5, 100);
    const burnGoal = parseGoal(form.burnGoalKcal, 'Daily burn goal', 50, 5000);
    const goalError = stepGoal.error || distanceGoal.error || burnGoal.error;
    if (goalError) {
      setError(goalError);
      return;
    }

    setSaving(true);
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
    const { data: { session } } = await supabase.auth.getSession();
console.log('session user:', session?.user?.id, 'token present:', !!session?.access_token);
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: form.fullName.trim() || null,
      height_cm: Number(form.heightCm),
      weight_kg: Number(form.weightKg),
      age: Number(form.age),
      sex: form.sex,
      activity_level: form.activityLevel,
      goal: form.goal,
      step_goal: stepGoal.value == null ? null : Math.round(stepGoal.value),
      distance_goal_km: distanceGoal.value,
      burn_goal_kcal: burnGoal.value == null ? null : Math.round(burnGoal.value),
      override_calories: customizeTargets && overrides.calories ? Number(overrides.calories) : null,
      override_protein_g: customizeTargets && overrides.protein ? Number(overrides.protein) : null,
      override_carbs_g: customizeTargets && overrides.carbs ? Number(overrides.carbs) : null,
      override_fat_g: customizeTargets && overrides.fat ? Number(overrides.fat) : null,
    });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    onSaved?.();
  };
  // Compact two-column workspace used on the Settings page. Same state and
  // submit handler as the default layout — only the markup differs.
  if (variant === 'settings') {
    const numInput = 'font-numeric';
    return (
      <form onSubmit={handleSubmit} className={`${ui.panel} p-4 sm:p-5 space-y-4`}>
        <div className="flex items-center gap-2.5">
          <User size={20} className="text-emerald-500 dark:text-emerald-400" />
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Profile &amp; Targets
          </h2>
        </div>

        <div className={`${ui.panelInner} p-3 sm:p-4 space-y-4`}>
          <label className={ui.fieldLabel}>
            Display name
            <input
              type="text"
              value={form.fullName}
              onChange={handleChange('fullName')}
              placeholder="Shown when you share a dish, e.g. Mark"
              className={ui.fieldInput}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <label className={ui.fieldLabel}>
              Height (cm)
              <input type="number" required value={form.heightCm} onChange={handleChange('heightCm')} className={ui.fieldInput} />
            </label>
            <label className={ui.fieldLabel}>
              Weight (kg)
              <input type="number" required value={form.weightKg} onChange={handleChange('weightKg')} className={ui.fieldInput} />
            </label>
            <label className={ui.fieldLabel}>
              Age
              <input type="number" required value={form.age} onChange={handleChange('age')} className={ui.fieldInput} />
            </label>
            <label className={ui.fieldLabel}>
              Sex
              <select value={form.sex} onChange={handleChange('sex')} className={ui.fieldInput}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label className={ui.fieldLabel}>
              Activity level
              <select value={form.activityLevel} onChange={handleChange('activityLevel')} className={ui.fieldInput}>
                {ACTIVITY_LEVELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className={ui.fieldLabel}>
              Goal
              <select value={form.goal} onChange={handleChange('goal')} className={ui.fieldInput}>
                {GOALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Daily activity goals — one horizontal sub-card */}
          <div className={`${ui.panelInner} p-3 sm:p-4`}>
            <div className="flex items-start gap-3">
              <Footprints size={20} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-300" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Daily activity goals</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-sky-300/70">
                  Optional: Your steps, distance and burn cards on the dashboard track activity against
                  these. Leave a field empty to show that card without a goal.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={ui.fieldLabel}>
                Steps
                <input type="number" inputMode="numeric" min="1000" max="100000" step="500"
                  value={form.stepGoal} onChange={handleChange('stepGoal')} placeholder="e.g. 8000"
                  className={`${ui.fieldInput} ${numInput}`} />
              </label>
              <label className={ui.fieldLabel}>
                Distance (km)
                <input type="number" inputMode="decimal" min="0.5" max="100" step="0.5"
                  value={form.distanceGoalKm} onChange={handleChange('distanceGoalKm')} placeholder="e.g. 6.5"
                  className={`${ui.fieldInput} ${numInput}`} />
              </label>
              <label className={ui.fieldLabel}>
                Burn (kcal)
                <input type="number" inputMode="numeric" min="50" max="5000" step="50"
                  value={form.burnGoalKcal} onChange={handleChange('burnGoalKcal')} placeholder="e.g. 400"
                  className={`${ui.fieldInput} ${numInput}`} />
              </label>
            </div>
          </div>

          {/* Daily targets — macro summary row + 2x2 overrides */}
          {computedTargets && (
            <div className={`${ui.panelInner} p-3 sm:p-4`}>
              <div className="flex items-start gap-3">
                <Target size={20} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-300" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Your daily targets</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold">
                    <span className={ui.macroText.calories}>{computedTargets.targetCalories} kcal</span>
                    <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">•</span>
                    <span className={ui.macroText.protein}>{computedTargets.proteinG}g protein</span>
                    <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">•</span>
                    <span className={ui.macroText.carbs}>{computedTargets.carbsG}g carbs</span>
                    <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">•</span>
                    <span className={ui.macroText.fat}>{computedTargets.fatG}g fat</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-sky-300/70">
                    Calculated from height, weight, age, activity, and goal above.
                  </p>
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={customizeTargets}
                  onChange={handleToggleCustomize}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                Set my own targets instead
              </label>

              {customizeTargets && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={ui.fieldLabel}>
                    Calories (kcal)
                    <input type="number" value={overrides.calories} onChange={handleOverrideChange('calories')} className={`${ui.fieldInput} ${numInput}`} />
                  </label>
                  <label className={ui.fieldLabel}>
                    Protein (g)
                    <input type="number" value={overrides.protein} onChange={handleOverrideChange('protein')} className={`${ui.fieldInput} ${numInput}`} />
                  </label>
                  <label className={ui.fieldLabel}>
                    Carbs (g)
                    <input type="number" value={overrides.carbs} onChange={handleOverrideChange('carbs')} className={`${ui.fieldInput} ${numInput}`} />
                  </label>
                  <label className={ui.fieldLabel}>
                    Fat (g)
                    <input type="number" value={overrides.fat} onChange={handleOverrideChange('fat')} className={`${ui.fieldInput} ${numInput}`} />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <button type="submit" disabled={saving} className={`${ui.btnPrimary} w-full py-3`}>
          <Save size={16} />
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className={ui.label}>
        Display name
        <input
          type="text"
          value={form.fullName}
          onChange={handleChange('fullName')}
          placeholder="Shown when you share a dish, e.g. Mark"
          className={ui.input}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={ui.label}>
          Height (cm)
          <input
            type="number"
            required
            value={form.heightCm}
            onChange={handleChange('heightCm')}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          Weight (kg)
          <input
            type="number"
            required
            value={form.weightKg}
            onChange={handleChange('weightKg')}
            className={ui.input}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={ui.label}>
          Age
          <input
            type="number"
            required
            value={form.age}
            onChange={handleChange('age')}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          Sex
          <select value={form.sex} onChange={handleChange('sex')} className={ui.select}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
      </div>

      <label className={ui.label}>
        Activity level
        <select
          value={form.activityLevel}
          onChange={handleChange('activityLevel')}
          className={ui.select}
        >
          {ACTIVITY_LEVELS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className={ui.label}>
        Goal
        <select value={form.goal} onChange={handleChange('goal')} className={ui.select}>
          {GOALS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className={`${ui.cardMuted} space-y-3`}>
        <div>
          <p className="text-sm font-medium text-ink dark:text-slate-400">Daily activity goals</p>
          <p className="mt-1 text-xs text-ink/50 dark:text-slate-400">
            Optional. Your Steps, Distance and Burn cards on the dashboard track activity against
            these. Leave a field empty to show that card without a goal.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className={ui.label}>
            Steps
            <input
              type="number"
              inputMode="numeric"
              min="1000"
              max="100000"
              step="500"
              value={form.stepGoal}
              onChange={handleChange('stepGoal')}
              placeholder="e.g. 8000"
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Distance (km)
            <input
              type="number"
              inputMode="decimal"
              min="0.5"
              max="100"
              step="0.5"
              value={form.distanceGoalKm}
              onChange={handleChange('distanceGoalKm')}
              placeholder="e.g. 5"
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Burn (kcal)
            <input
              type="number"
              inputMode="numeric"
              min="50"
              max="5000"
              step="50"
              value={form.burnGoalKcal}
              onChange={handleChange('burnGoalKcal')}
              placeholder="e.g. 400"
              className={ui.input}
            />
          </label>
        </div>
      </div>

      {computedTargets && (
        <div className={`${ui.cardMuted} space-y-3`}>
          <div>
            <p className="text-sm font-medium text-ink   dark:text-slate-400">Your daily targets</p>
            <p className="mt-1 font-numeric text-sm text-ink/70  dark:text-slate-400">
              <span className={ui.macroText.calories}>{computedTargets.targetCalories} kcal</span> ·{' '}
              <span className={ui.macroText.protein}>{computedTargets.proteinG}g protein</span> ·{' '}
              <span className={ui.macroText.carbs}>{computedTargets.carbsG}g carbs</span> ·{' '}
              <span className={ui.macroText.fat}>{computedTargets.fatG}g fat</span>
            </p>
            <p className="mt-1 text-xs text-ink/50  dark:text-slate-400">
              Calculated from height, weight, age, activity, and goal above.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink/80  dark:text-slate-400">
            <input type="checkbox" checked={customizeTargets} onChange={handleToggleCustomize} />
            Set my own targets instead
          </label>

          {customizeTargets && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className={ui.label}>
                Calories
                <input
                  type="number"
                  value={overrides.calories}
                  onChange={handleOverrideChange('calories')}
                  className={ui.input}
                />
              </label>
              <label className={ui.label}>
                Protein (g)
                <input
                  type="number"
                  value={overrides.protein}
                  onChange={handleOverrideChange('protein')}
                  className={ui.input}
                />
              </label>
              <label className={ui.label}>
                Carbs (g)
                <input
                  type="number"
                  value={overrides.carbs}
                  onChange={handleOverrideChange('carbs')}
                  className={ui.input}
                />
              </label>
              <label className={ui.label}>
                Fat (g)
                <input
                  type="number"
                  value={overrides.fat}
                  onChange={handleOverrideChange('fat')}
                  className={ui.input}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-brick">{error}</p>}

      <button type="submit" disabled={saving} className={`${ui.btnPrimary} w-full`}>
        {saving ? 'Saving...' : 'Save profile'}
      </button>
    </form>
  );
}
