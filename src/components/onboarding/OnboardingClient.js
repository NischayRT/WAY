'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Flame, Dumbbell, Scale, HeartPulse, Repeat, Info, AlertTriangle, Droplets, Wheat } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { getCurrentUserId } from '@/lib/currentUser';
import { todayLocalDate } from '@/lib/dateUtils';
import { ui } from '@/lib/ui';
import { buildPlan, bmiInfo, healthyWeightRange, PACES } from '@/lib/planner';
import { useUnits, UnitSwitch, WeightInput, HeightInput } from '@/components/way/units';
import { fmtHeight, fmtWeight, weightUnit } from '@/lib/units';
import BodyMeasurementsForm from '@/components/onboarding/BodyMeasurementsForm';
import GoogleHealthOnboardingStep from '@/components/onboarding/GoogleHealthOnboardingStep';

// While the Google OAuth app is in "Testing" mode only listed test users can
// connect, so the optional Google Health step is opt-in per environment.
const HEALTH_STEP_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_HEALTH_ENABLED === 'true';

/**
 * Onboarding, one decision per step, with Back on every step.
 * Nothing is saved until "Save my plan" (step 5), so going back and changing
 * anything is free; the draft is kept in sessionStorage so a refresh doesn't
 * lose it. Steps after the plan (measurements, Google Health) are optional.
 */
const STEPS = [
  { key: 'about', label: 'About you' },
  { key: 'body', label: 'Body' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'goal', label: 'Goal' },
  { key: 'plan', label: 'Your plan' },
  { key: 'measure', label: 'Measurements', optional: true },
  ...(HEALTH_STEP_ENABLED ? [{ key: 'connect', label: 'Connect', optional: true }] : []),
];

const ACTIVITY = [
  { value: 'sedentary', label: 'Mostly sitting', desc: 'Desk job, little exercise, under ~5,000 steps a day' },
  { value: 'light', label: 'Lightly active', desc: 'Walks or light exercise 1-3 days a week' },
  { value: 'moderate', label: 'Moderately active', desc: 'Exercise 3-5 days a week' },
  { value: 'active', label: 'Very active', desc: 'Hard exercise 6-7 days a week' },
  { value: 'very_active', label: 'Athlete / physical job', desc: 'Physical work plus training, or twice-a-day training' },
];

const GOALS = [
  { value: 'lose_weight', label: 'Lose fat', desc: 'Reach a lower weight', Icon: Flame, needsTarget: 'lower' },
  { value: 'maintain', label: 'Maintain', desc: 'Stay where you are, eat well', Icon: Scale },
  { value: 'gain_muscle', label: 'Build muscle', desc: 'Gain weight, mostly muscle', Icon: Dumbbell, needsTarget: 'higher' },
  { value: 'lean_mass', label: 'Recomposition', desc: 'Lose fat and build muscle at the same weight', Icon: Repeat },
  { value: 'improve_cardio', label: 'Improve fitness', desc: 'Fuel training at maintenance', Icon: HeartPulse },
];

const DRAFT_KEY = 'way.onboarding.draft.v1';
const EMPTY = {
  fullName: '',
  sex: '',
  age: '',
  heightCm: '',
  weightKg: '',
  activityLevel: '',
  goal: '',
  targetWeightKg: '',
  paceKey: 'standard',
};

const fmt = (n) => Math.round(n).toLocaleString('en-IN');
const fmtDate = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function OnboardingClient() {
  const router = useRouter();
  const { units } = useUnits();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Restore a draft after a refresh.
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
      if (d?.form) {
        setForm({ ...EMPTY, ...d.form });
        setStep(Math.min(d.step ?? 0, 4));
        setMaxStep(Math.min(d.maxStep ?? 0, 4));
      }
    } catch {
      /* no draft */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step, maxStep }));
    } catch {
      /* private mode */
    }
  }, [form, step, maxStep]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const goal = GOALS.find((g) => g.value === form.goal);

  // The plan, recalculated live from everything entered so far.
  const plan = useMemo(() => {
    const ok = form.sex && form.age && form.heightCm && form.weightKg && form.activityLevel && form.goal;
    if (!ok) return null;
    try {
      return buildPlan({
        ...form,
        age: Number(form.age),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        targetWeightKg: goal?.needsTarget ? Number(form.targetWeightKg) || null : null,
      });
    } catch {
      return null;
    }
  }, [form, goal]);

  /* ---------------- per-step validation ---------------- */
  const stepError = useMemo(() => {
    const n = (v) => Number(v);
    switch (STEPS[step]?.key) {
      case 'about':
        if (!form.sex) return 'Choose the option used for your calorie calculation.';
        if (!(n(form.age) >= 16 && n(form.age) <= 100)) return 'Enter an age between 16 and 100.';
        return null;
      case 'body':
        if (!(n(form.heightCm) >= 120 && n(form.heightCm) <= 230)) return `Enter a height between ${fmtHeight(120, units)} and ${fmtHeight(230, units)}.`;
        if (!(n(form.weightKg) >= 30 && n(form.weightKg) <= 300)) return `Enter a weight between ${fmtWeight(30, units, 0)} and ${fmtWeight(300, units, 0)}.`;
        return null;
      case 'lifestyle':
        return form.activityLevel ? null : 'Pick the option closest to a typical week.';
      case 'goal': {
        if (!form.goal) return 'Pick a goal.';
        if (goal?.needsTarget) {
          const t = n(form.targetWeightKg);
          const w = n(form.weightKg);
          if (!(t >= 30 && t <= 300)) return 'Enter your goal weight.';
          if (goal.needsTarget === 'lower' && t >= w) return `For fat loss, your goal should be below your current ${fmtWeight(w, units)}.`;
          if (goal.needsTarget === 'higher' && t <= w) return `To build muscle, your goal should be above your current ${fmtWeight(w, units)}.`;
        }
        return null;
      }
      default:
        return null;
    }
  }, [step, form, goal, units]);

  const next = () => {
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    const s = step + 1;
    setStep(s);
    setMaxStep((m) => Math.max(m, s));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const finish = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.push('/home');
  };

  /* ---------------- save (step 5) ---------------- */
  const savePlan = async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      const userId = await getCurrentUserId(supabase);
      const changing = plan.direction !== 'maintain';
      const { error: e1 } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: form.fullName.trim() || null,
        height_cm: Number(form.heightCm),
        weight_kg: Number(form.weightKg),
        age: Number(form.age),
        sex: form.sex,
        activity_level: form.activityLevel,
        goal: plan.goal,
        dream_target_weight_kg: changing ? Number(form.targetWeightKg) : null,
        dream_target_date: changing ? plan.targetDate : null,
        // Calories follow the chosen pace; protein, carbs and fat are worked
        // out from them by the same rules (overrides left empty on purpose).
        override_calories: changing ? plan.calories : null,
        override_protein_g: null,
        override_carbs_g: null,
        override_fat_g: null,
      });
      if (e1) throw e1;
      // Starting weigh-in, so progress has a first point.
      await supabase
        .from('weight_logs')
        .upsert({ user_id: userId, logged_at: todayLocalDate(), weight_kg: Number(form.weightKg) }, { onConflict: 'user_id,logged_at' });
      setSaved(true);
      setStep(5);
      setMaxStep((m) => Math.max(m, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const key = STEPS[step]?.key;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <nav aria-label="Onboarding steps">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span>
            Step {step + 1} of {STEPS.length}
            {STEPS[step]?.optional ? ' · optional' : ''}
          </span>
          <span className="text-slate-900 dark:text-white">{STEPS[step]?.label}</span>
        </div>
        <div className="mt-2 flex gap-1">
          {STEPS.map((s, i) => {
            // Steps already reached can be revisited (only up to the plan
            // before it's saved; only measurements/connect after).
            const reachable = saved ? i >= 5 && i <= maxStep : i <= maxStep && i <= 4;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!reachable || i === step}
                onClick={() => {
                  setError(null);
                  setStep(i);
                }}
                aria-label={`${s.label}${i < step ? ' (done)' : ''}`}
                aria-current={i === step ? 'step' : undefined}
                className={`h-1.5 flex-1 rounded-full transition ${
                  i < step ? 'bg-emerald-500' : i === step ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-800'
                } ${reachable && i !== step ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              />
            );
          })}
        </div>
      </nav>

      {/* ---------------- 1. About you ---------------- */}
      {key === 'about' && (
        <Card title="Let’s get to know you" subtitle="This sets your energy needs. Takes about a minute.">
          <label className={ui.fieldLabel}>
            Name (optional)
            <input className={ui.fieldInput} value={form.fullName} onChange={(e) => set('fullName')(e.target.value)} placeholder="What should we call you?" autoComplete="given-name" />
          </label>
          <fieldset>
            <legend className={ui.fieldLabel}>Sex for calorie calculation</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {[
                ['male', 'Male'],
                ['female', 'Female'],
              ].map(([v, l]) => (
                <Choice key={v} selected={form.sex === v} onClick={() => set('sex')(v)} title={l} />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Metabolism formulas differ by sex; this also picks your 3D body.</p>
          </fieldset>
          <label className={ui.fieldLabel}>
            Age
            <input className={ui.fieldInput} type="number" inputMode="numeric" min={16} max={100} value={form.age} onChange={(e) => set('age')(e.target.value)} placeholder="e.g. 28" />
          </label>
        </Card>
      )}

      {/* ---------------- 2. Body ---------------- */}
      {key === 'body' && (
        <Card title="Your body today" subtitle="Your current height and weight. Weigh yourself in the morning if you can.">
          {/* Typed in your units, kept in cm and kg. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={ui.fieldLabel}>
              <span className="flex items-center justify-between gap-2">
                Height
                <UnitSwitch kind="height" plain />
              </span>
              <HeightInput
                cm={form.heightCm === '' ? '' : Number(form.heightCm)}
                onChange={(v) => set('heightCm')(v === '' ? '' : String(v))}
                className={ui.fieldInput}
                suffixClassName="pt-1 text-xs font-semibold normal-case tracking-normal text-slate-400"
              />
            </div>
            <div className={ui.fieldLabel}>
              <span className="flex items-center justify-between gap-2">
                Weight
                <UnitSwitch kind="weight" plain />
              </span>
              <span className="flex items-center gap-1">
                <WeightInput kg={form.weightKg === '' ? '' : Number(form.weightKg)} onChange={(v) => set('weightKg')(v === '' ? '' : String(v))} placeholderKg={72} className={ui.fieldInput} />
                <span className="pt-1 text-xs font-semibold normal-case tracking-normal text-slate-400">{weightUnit(units)}</span>
              </span>
            </div>
          </div>
          {(() => {
            const b = bmiInfo(form.weightKg, form.heightCm);
            const r = healthyWeightRange(form.heightCm);
            if (!b || !r) return null;
            return (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                BMI <b className="font-numeric">{b.bmi}</b> · {b.label}. A healthy range for your height is{' '}
                <b className="font-numeric">
                  {fmtWeight(r.min, units, 1, false)}-{fmtWeight(r.max, units)}
                </b>
                .<span className="block pt-1 text-[11px] text-slate-400">Using the Asian BMI cut-offs used in India (healthy 18.5-22.9). BMI doesn&apos;t see muscle, so treat it as a rough guide.</span>
              </div>
            );
          })()}
        </Card>
      )}

      {/* ---------------- 3. Lifestyle ---------------- */}
      {key === 'lifestyle' && (
        <Card title="How active is a typical week?" subtitle="Pick what you actually do now, not what you plan to do. It’s easy to overestimate.">
          <div className="space-y-2">
            {ACTIVITY.map((a) => (
              <Choice key={a.value} selected={form.activityLevel === a.value} onClick={() => set('activityLevel')(a.value)} title={a.label} desc={a.desc} />
            ))}
          </div>
        </Card>
      )}

      {/* ---------------- 4. Goal ---------------- */}
      {key === 'goal' && (
        <Card title="What’s your goal?" subtitle="You can change this any time in Body Studio.">
          <div className="grid gap-2 sm:grid-cols-2">
            {GOALS.map((g) => (
              <Choice key={g.value} selected={form.goal === g.value} onClick={() => set('goal')(g.value)} title={g.label} desc={g.desc} Icon={g.Icon} />
            ))}
          </div>

          {goal?.needsTarget && (
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className={ui.fieldLabel}>
                <span className="flex items-center justify-between gap-2">
                  Goal weight
                  <UnitSwitch kind="weight" plain />
                </span>
                <span className="flex items-center gap-1">
                  <WeightInput
                    kg={form.targetWeightKg === '' ? '' : Number(form.targetWeightKg)}
                    onChange={(v) => set('targetWeightKg')(v === '' ? '' : String(v))}
                    className={ui.fieldInput}
                    placeholder={form.weightKg ? `${goal.needsTarget === 'lower' ? 'below' : 'above'} ${fmtWeight(form.weightKg, units, 1, false)}` : undefined}
                  />
                  <span className="pt-1 text-xs font-semibold normal-case tracking-normal text-slate-400">{weightUnit(units)}</span>
                </span>
              </div>
              {(() => {
                const r = healthyWeightRange(form.heightCm);
                const w = Number(form.weightKg);
                const sugg =
                  goal.needsTarget === 'lower'
                    ? [w - 3, w - 5, r && r.max < w ? r.max : null]
                    : [w + 2, w + 4];
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set(sugg.filter((x) => x && x > 30).map((x) => Math.round(x * 10) / 10))].map((x) => (
                      <button key={x} type="button" onClick={() => set('targetWeightKg')(String(x))} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        {fmtWeight(x, units)}
                        {r && x === r.max ? ' (healthy max)' : ''}
                      </button>
                    ))}
                  </div>
                );
              })()}

              <fieldset>
                <legend className={ui.fieldLabel}>Pace</legend>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                  {PACES[goal.needsTarget === 'lower' ? 'lose' : 'gain'].map((pc) => {
                    const preview =
                      Number(form.targetWeightKg) > 0 && form.sex && form.age && form.activityLevel
                        ? buildPlan({ ...form, age: Number(form.age), heightCm: Number(form.heightCm), weightKg: Number(form.weightKg), targetWeightKg: Number(form.targetWeightKg), paceKey: pc.key })
                        : null;
                    return (
                      <Choice
                        key={pc.key}
                        selected={form.paceKey === pc.key}
                        onClick={() => set('paceKey')(pc.key)}
                        title={pc.label}
                        desc={
                          preview?.weeks
                            ? `~${fmtWeight(preview.paceKgWeek, units, 2)}/week · ${preview.weeks} weeks · ${pc.note}`
                            : pc.note
                        }
                      />
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
        </Card>
      )}

      {/* ---------------- 5. Plan ---------------- */}
      {key === 'plan' && plan && <PlanReview plan={plan} form={form} />}

      {/* ---------------- 6. Measurements (optional) ---------------- */}
      {key === 'measure' && (
        <BodyMeasurementsForm
          heightCm={Number(form.heightCm)}
          weightKg={Number(form.weightKg)}
          sex={form.sex === 'female' ? 'female' : 'male'}
          onSaved={() => (HEALTH_STEP_ENABLED ? setStep(6) : finish())}
          onSkip={() => (HEALTH_STEP_ENABLED ? setStep(6) : finish())}
        />
      )}

      {/* ---------------- 7. Google Health (optional) ---------------- */}
      {key === 'connect' && <GoogleHealthOnboardingStep onSkip={finish} />}

      {error && (
        <p role="alert" className="text-sm font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      {/* Navigation */}
      {step <= 4 ? (
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button type="button" onClick={back} className={`${ui.btnSecondary} justify-center`}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {step < 4 ? (
            <button type="button" onClick={next} className={`${ui.btnPrimary} ml-auto flex-1 justify-center sm:flex-none`}>
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={savePlan} disabled={saving || !plan} className={`${ui.btnPrimary} ml-auto flex-1 justify-center sm:flex-none`}>
              {saving ? 'Saving…' : saved ? 'Save changes' : 'Save my plan'} <Check size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setStep((s) => (s === 5 ? 4 : s - 1))} className={`${ui.btnSecondary} justify-center`}>
            <ArrowLeft size={16} /> Back
          </button>
          <button type="button" onClick={finish} className="ml-auto text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
            Go to my dashboard
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Card({ title, subtitle, children }) {
  return (
    <section className={`${ui.card} space-y-4 p-4 sm:p-5`}>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice({ selected, onClick, title, desc, Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
        selected
          ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-950/40'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
      }`}
    >
      {Icon && <Icon size={18} className={`mt-0.5 shrink-0 ${selected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        {desc && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{desc}</span>}
      </span>
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
        {selected && <Check size={11} />}
      </span>
    </button>
  );
}

function PlanReview({ plan, form }) {
  const { units } = useUnits();
  const macros = [
    { k: 'Protein', g: plan.proteinG, pct: plan.split.protein, c: 'bg-emerald-500', t: 'text-emerald-600 dark:text-emerald-400' },
    { k: 'Carbs', g: plan.carbsG, pct: plan.split.carbs, c: 'bg-blue-500', t: 'text-blue-600 dark:text-blue-400' },
    { k: 'Fat', g: plan.fatG, pct: plan.split.fat, c: 'bg-violet-500', t: 'text-violet-600 dark:text-violet-400' },
  ];
  const activity = ACTIVITY.find((a) => a.value === form.activityLevel)?.label.toLowerCase();
  const why = [
    `Your body burns about ${fmt(plan.bmr)} kcal a day at rest. Being ${activity} brings that to about ${fmt(plan.tdee)} kcal (your maintenance).`,
    plan.direction === 'lose'
      ? `Eating ${fmt(Math.abs(plan.deltaKcal))} kcal below maintenance loses about ${fmtWeight(plan.paceKgWeek, units, 2)} a week.`
      : plan.direction === 'gain'
        ? `Eating ${fmt(plan.deltaKcal)} kcal above maintenance gains about ${fmtWeight(plan.paceKgWeek, units, 2)} a week, enough to build muscle without much extra fat.`
        : 'You eat at maintenance, so your weight stays steady.',
    `Protein: ${plan.proteinPerKgRule} g per kg of ${plan.referenceWeightKg} kg${units.weight === 'lb' ? ` (${fmtWeight(plan.referenceWeightKg, units, 0)})` : ''}${Number(form.weightKg) > plan.referenceWeightKg ? ' (a healthy reference weight for your height, since protein needs follow lean mass)' : ''}${['moderate', 'active', 'very_active'].includes(form.activityLevel) ? ', a little higher because you train most days' : ''}.`,
    'Fat: about 28% of calories, for hormones and vitamins. Carbs: the rest, your main fuel (at least 130 g).',
  ];

  return (
    <section className={`${ui.card} space-y-5 p-4 sm:p-5`}>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your daily plan</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {plan.direction === 'maintain'
            ? 'Built to keep your weight steady.'
            : `To reach ${form.targetWeightKg} kg${plan.targetDate ? ` around ${fmtDate(plan.targetDate)} (${plan.weeks} weeks)` : ''}.`}
        </p>
      </div>

      <div className="flex items-end gap-3">
        <p className="font-numeric text-4xl font-bold leading-none text-slate-900 dark:text-white">{fmt(plan.calories)}</p>
        <p className="pb-1 text-sm text-slate-500 dark:text-slate-400">
          kcal a day
          {plan.deltaKcal !== 0 && (
            <span className={plan.deltaKcal < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {' '}
              ({plan.deltaKcal > 0 ? '+' : '−'}
              {fmt(Math.abs(plan.deltaKcal))} vs maintenance)
            </span>
          )}
        </p>
      </div>

      {/* Macro split */}
      <div>
        <div className="flex h-3 overflow-hidden rounded-full">
          {macros.map((m) => (
            <span key={m.k} className={m.c} style={{ width: `${m.pct}%` }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {macros.map((m) => (
            <div key={m.k} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${m.t}`}>{m.k}</p>
              <p className="font-numeric text-lg font-bold text-slate-900 dark:text-white">{m.g} g</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{m.pct}% of calories</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <Wheat size={14} className="text-amber-500" /> Fibre ~{plan.fibreG} g
        </span>
        <span className="flex items-center gap-1.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <Droplets size={14} className="text-sky-500" /> Water ~{plan.waterL} L
        </span>
      </div>

      <div className="space-y-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">How we worked this out</p>
        {why.map((w) => (
          <p key={w} className="flex gap-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
            <Info size={13} className="mt-0.5 shrink-0 text-slate-400" /> {w}
          </p>
        ))}
        {[...plan.warnings, ...plan.notes].map((w) => (
          <p key={w} className="flex gap-2 rounded-lg bg-amber-50 p-2 text-xs leading-snug text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {w}
          </p>
        ))}
        <p className="pt-1 text-[11px] text-slate-400">
          Estimates, not medical advice. Your targets update as you log your weight, and you can adjust them in Settings.
        </p>
      </div>
    </section>
  );
}
