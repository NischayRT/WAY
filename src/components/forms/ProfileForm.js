'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { getDailyTargets } from '@/lib/bmrTdee';
import { ui } from '@/lib/ui';

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

export default function ProfileForm({ userId, onSaved, initialProfile }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    fullName: initialProfile?.full_name ?? '',
    heightCm: initialProfile?.height_cm ?? '',
    weightKg: initialProfile?.weight_kg ?? '',
    age: initialProfile?.age ?? '',
    sex: initialProfile?.sex ?? 'male',
    activityLevel: initialProfile?.activity_level ?? 'moderate',
    goal: initialProfile?.goal ?? 'maintain',
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
    setSaving(true);
    setError(null);
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
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className={ui.label}>
        Display name
        <input
          type="text"
          value={form.fullName}
          onChange={handleChange('fullName')}
          placeholder="Shown when you share a dish, e.g. Markaaaaaaaaaaaaa"
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
