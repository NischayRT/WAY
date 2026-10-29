'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Check, Footprints, Navigation, Flame } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { getCurrentUserId } from '@/lib/currentUser';
import { getDailyTargets, ACTIVITY_MULTIPLIERS } from '@/lib/bmrTdee';
import { Card, Eyebrow, Toggle, NumField, Dot, fmt, cx } from '@/components/way/ui';
import { invalidateJson } from '@/components/way/useJson';
import { useUnits, UnitSwitch, HeightField, WeightField } from '@/components/way/units';
import { fmtHeight, fmtWeight } from '@/lib/units';

export const GOALS = [
  ['lose_weight', 'Lose weight'],
  ['gain_muscle', 'Gain muscle'],
  ['lean_mass', 'Build lean mass'],
  ['improve_cardio', 'Improve cardio'],
  ['maintain', 'Maintain'],
];
export const ACTS = [
  ['sedentary', 'Sedentary'],
  ['light', 'Light'],
  ['moderate', 'Moderate'],
  ['active', 'Active'],
  ['very_active', 'Very active'],
];

const str = (v) => (v == null ? '' : String(v));

function Seg({ list, value, onChange, pills = false }) {
  if (pills) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {list.map(([v, label]) => {
          const on = v === value;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(v)}
              className={cx(
                'shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition-colors md:px-[13px] md:text-[13px]',
                on ? 'border-way-ink bg-way-ink text-way-page' : 'border-way-line2 text-way-ink2 hover:border-way-line3'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-way-line bg-way-rail p-1">
      {list.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={cx(
            'rounded-[10px] py-[9px] text-[13px] font-semibold transition-colors md:py-2.5',
            v === value ? 'bg-way-ink text-way-page' : 'text-way-ink2 hover:text-way-ink'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** About you, daily targets (calculated live, or your own) and activity goals. */
export default function ProfileSection({ profile, onSaved }) {
  const supabase = createClient();
  const router = useRouter();
  const { units } = useUnits();
  const [f, setF] = useState({
    name: profile.full_name ?? '',
    h: str(profile.height_cm),
    w: str(profile.weight_kg),
    age: str(profile.age),
    sex: profile.sex === 'female' ? 'female' : 'male',
    act: profile.activity_level || 'moderate',
    goal: profile.goal || 'maintain',
    steps: str(profile.step_goal),
    km: str(profile.distance_goal_km),
    burn: str(profile.burn_goal_kcal),
  });
  const hasOverride = ['override_calories', 'override_protein_g', 'override_carbs_g', 'override_fat_g'].some((k) => profile[k] != null);
  const [custom, setCustom] = useState(hasOverride);
  const [ov, setOv] = useState({
    kcal: str(profile.override_calories),
    p: str(profile.override_protein_g),
    c: str(profile.override_carbs_g),
    f: str(profile.override_fat_g),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (v) => {
    setF((s) => ({ ...s, [key]: v }));
    setSaved(false);
  };

  // Calculated targets, recomputed as the basics change (last valid input kept).
  const calc = useMemo(() => {
    const heightCm = Number(f.h);
    const weightKg = Number(f.w);
    const age = Number(f.age);
    if (!(heightCm > 90 && weightKg > 25 && age > 10)) return null;
    try {
      return getDailyTargets({ heightCm, weightKg, age, sex: f.sex, activityLevel: f.act, goal: f.goal });
    } catch {
      return null;
    }
  }, [f.h, f.w, f.age, f.sex, f.act, f.goal]);

  const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
  const T = calc
    ? custom
      ? { kcal: num(ov.kcal, calc.targetCalories), p: num(ov.p, calc.proteinG), c: num(ov.c, calc.carbsG), f: num(ov.f, calc.fatG) }
      : { kcal: calc.targetCalories, p: calc.proteinG, c: calc.carbsG, f: calc.fatG }
    : null;
  const mk = T
    ? [
        ['Protein', T.p, 4, '#34d399'],
        ['Carbs', T.c, 4, '#60a5fa'],
        ['Fat', T.f, 9, '#a78bfa'],
      ]
    : [];
  const mkTot = mk.reduce((a, m) => a + m[1] * m[2], 0) || 1;
  const actLabel = ACTS.find((a) => a[0] === f.act)?.[1] || f.act;
  const goalLabel = GOALS.find((g) => g[0] === f.goal)?.[1] || f.goal;
  const note = !calc
    ? 'Enter your height, weight and age to calculate targets.'
    : custom
      ? `Your own numbers. The calculated target would be ${fmt(calc.targetCalories)} kcal.`
      : `BMR ${fmt(calc.bmr)} × ${ACTIVITY_MULTIPLIERS[f.act] ?? '—'} for ${actLabel.toLowerCase()} activity, then set for “${goalLabel.toLowerCase()}”.`;

  const save = async () => {
    setError(null);
    const h = Number(f.h);
    const w = Number(f.w);
    const age = Number(f.age);
    if (!(h >= 100 && h <= 250)) return setError(`Height must be between ${fmtHeight(100, units)} and ${fmtHeight(250, units)}.`);
    if (!(w >= 25 && w <= 300)) return setError(`Weight must be between ${fmtWeight(25, units, 0)} and ${fmtWeight(300, units, 0)}.`);
    if (!(age >= 13 && age <= 100)) return setError('Age must be between 13 and 100.');
    const goalVal = (raw, label, min, max) => {
      if (raw === '' || raw == null) return { v: null };
      const n = Number(raw);
      return Number.isFinite(n) && n >= min && n <= max ? { v: n } : { e: `${label} must be between ${min} and ${max}.` };
    };
    const sg = goalVal(f.steps, 'Step goal', 1000, 100000);
    const dg = goalVal(f.km, 'Distance goal', 0.5, 100);
    const bg = goalVal(f.burn, 'Burn goal', 50, 5000);
    const goalErr = sg.e || dg.e || bg.e;
    if (goalErr) return setError(goalErr);

    setSaving(true);
    let userId;
    try {
      userId = await getCurrentUserId(supabase);
    } catch (e) {
      setSaving(false);
      return setError(e.message);
    }
    const o = (v) => (custom && Number(v) > 0 ? Number(v) : null);
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: f.name.trim() || null,
      height_cm: h,
      weight_kg: w,
      age,
      sex: f.sex,
      activity_level: f.act,
      goal: f.goal,
      step_goal: sg.v == null ? null : Math.round(sg.v),
      distance_goal_km: dg.v,
      burn_goal_kcal: bg.v == null ? null : Math.round(bg.v),
      override_calories: o(ov.kcal),
      override_protein_g: o(ov.p),
      override_carbs_g: o(ov.c),
      override_fat_g: o(ov.f),
    });
    setSaving(false);
    if (upsertError) return setError(upsertError.message);
    setSaved(true);
    invalidateJson('/api/');
    router.refresh();
    setTimeout(() => setSaved(false), 2200);
    // Next step after the basics and targets: the body (measurements, 3D, goal).
    if (onSaved) setTimeout(onSaved, 650);
  };


  const ovFields = [
    ['kcal', 'Calories', 'kcal', '#fbbf24', calc?.targetCalories],
    ['p', 'Protein', 'g', '#34d399', calc?.proteinG],
    ['c', 'Carbs', 'g', '#60a5fa', calc?.carbsG],
    ['f', 'Fat', 'g', '#a78bfa', calc?.fatG],
  ];
  const actFields = [
    ['steps', 'Steps', '', 500, Footprints, '#60a5fa'],
    ['km', 'Distance', 'km', 0.5, Navigation, '#34d399'],
    ['burn', 'Burn', 'kcal', 50, Flame, '#fbbf24'],
  ];

  const saveBtn = (
    <button
      type="button"
      onClick={save}
      disabled={saving}
      className={cx(
        'flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-[22px] text-sm font-semibold text-way-page transition-colors md:min-h-0 md:rounded-xl md:py-3',
        saved ? 'bg-emerald-500' : 'bg-way-ink hover:bg-white'
      )}
    >
      {saved ? <Check size={15} /> : <Save size={15} />}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
    </button>
  );

  return (
    <div className="flex flex-col gap-3.5 md:gap-5">
      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2 lg:gap-5">
        <Card className="flex flex-col gap-4 p-[18px] md:gap-5 md:p-[26px]">
          <Eyebrow>About you</Eyebrow>
          <label className="flex flex-col gap-1.5 text-xs text-way-mute">
            Display name
            <input
              type="text"
              value={f.name}
              onChange={(e) => set('name')(e.target.value)}
              placeholder="Shown when you share a dish"
              className="h-11 rounded-xl border border-way-line2 bg-way-rail px-3 text-[15px] text-way-ink outline-none placeholder:text-way-faint focus:border-way-faint md:h-[46px] md:px-3.5"
            />
          </label>
          {/* Stored in cm and kg; shown and typed in your units. */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.35fr_1fr_.7fr] md:gap-3">
            <HeightField cm={f.h === '' ? '' : Number(f.h)} onChange={(v) => set('h')(v === '' ? '' : String(v))} />
            <WeightField kg={f.w === '' ? '' : Number(f.w)} onChange={(v) => set('w')(v === '' ? '' : String(v))} />
            <div className="col-span-2 md:col-span-1">
              <NumField label="Age" unit="yrs" step={1} value={f.age} onChange={set('age')} />
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-way-rail px-3 py-2.5 text-xs text-way-mute">
            <span>Units everywhere in WAY</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {[
                ['height', 'Height'],
                ['weight', 'Weight'],
                ['length', 'Body'],
              ].map(([kind, label]) => (
                <span key={kind} className="flex items-center gap-1.5 text-[11px] text-way-dim">
                  {label}
                  <UnitSwitch kind={kind} />
                </span>
              ))}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-way-mute">Sex</span>
            <Seg
              list={[
                ['male', 'Male'],
                ['female', 'Female'],
              ]}
              value={f.sex}
              onChange={set('sex')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-way-mute">Activity level</span>
            <Seg pills list={ACTS} value={f.act} onChange={set('act')} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-way-mute">Goal</span>
            <Seg pills list={GOALS} value={f.goal} onChange={set('goal')} />
          </div>
        </Card>

        <div className="flex flex-col gap-3.5 lg:gap-5">
          <Card className="flex flex-col gap-4 p-[18px] md:gap-[18px] md:p-[26px]">
            <div className="flex items-center justify-between">
              <Eyebrow>Daily targets</Eyebrow>
              <span
                className="rounded-full border px-[7px] py-0.5 font-mono text-[10px] font-semibold"
                style={custom ? { color: '#fbbf24', borderColor: 'rgba(251,191,36,.35)' } : { color: '#34d399', borderColor: 'rgba(52,211,153,.35)' }}
              >
                {custom ? 'Custom' : 'Calculated'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 md:gap-2">
              <span className="font-brand text-[64px] leading-[.85] text-way-kcal md:text-[88px]">{T ? fmt(T.kcal) : '—'}</span>
              <span className="font-mono text-xs font-medium text-way-dim md:text-[13px]">kcal / day</span>
            </div>
            <div className="flex h-2 gap-0.5 overflow-hidden rounded md:h-2.5 md:rounded-[5px]">
              {mk.map(([label, g, kk, color]) => (
                <div key={label} className="transition-[flex] duration-[400ms]" style={{ flex: g * kk, background: color }} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {mk.map(([label, g, kk, color]) => (
                <div key={label} className="flex flex-col gap-1 md:gap-[5px]">
                  <div className="flex items-center gap-1.5 text-[11px] text-way-mute md:gap-[7px] md:text-xs">
                    <Dot color={color} />
                    {label}
                  </div>
                  <div className="flex items-baseline gap-[3px] md:gap-1">
                    <span className="font-mono text-lg font-semibold md:text-2xl">{fmt(g)}</span>
                    <span className="font-mono text-[11px] font-medium text-way-dim md:text-xs">g · {Math.round((g * kk * 100) / mkTot)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs leading-normal text-way-dim [text-wrap:pretty]">{note}</p>
            <div className="h-px bg-way-line" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">Set my own targets</span>
                <span className="text-[11px] text-way-dim md:text-xs">Starts from the calculated numbers</span>
              </div>
              <Toggle
                on={custom}
                onChange={(v) => {
                  setCustom(v);
                  setSaved(false);
                }}
                label="Set my own targets"
              />
            </div>
            {custom ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2.5">
                {ovFields.map(([key, label, unit, color, d]) => (
                  <NumField
                    key={key}
                    label={label}
                    unit={unit}
                    icon={<Dot color={color} />}
                    value={ov[key] === '' ? (d != null ? String(d) : '') : ov[key]}
                    onChange={(v) => {
                      setOv((s) => ({ ...s, [key]: v }));
                      setSaved(false);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="flex flex-col gap-3.5 p-[18px] md:gap-4 md:p-[26px]">
            <div className="flex flex-col gap-1">
              <Eyebrow>Activity goals</Eyebrow>
              <span className="text-xs leading-normal text-way-dim">
                Optional. Health tiles on Today track against these. Leave one empty to show the tile without a goal.
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {actFields.map(([key, label, unit, step, Icon, color]) => (
                <NumField
                  key={key}
                  label={label}
                  unit={unit}
                  step={step}
                  placeholder="—"
                  icon={<Icon size={12} style={{ color }} />}
                  value={f[key]}
                  onChange={set(key)}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
      {error ? <p className="text-[13px] text-rose-300">{error}</p> : null}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end md:gap-3.5">
        <span className="hidden text-xs text-way-dim md:inline">Targets on Today update when you save.</span>
        {saveBtn}
      </div>
    </div>
  );
}
