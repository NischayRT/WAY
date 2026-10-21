'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { RotateCw, Save, Check, Target, CircleCheck, TriangleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import {
  analyzeCurrentPhysique,
  projectScientificDream,
  minWaistCmForBfFloor,
  estimateDefaultMeasurementsCm,
} from '@/lib/bodyProportions';
import { calculateTimelineAndFeasibility } from '@/lib/goalFeasibility';
import { ACTIVITY_MULTIPLIERS, proteinTargetG, splitCarbsFat } from '@/lib/bmrTdee';
import { resolveCurrentPhysique } from '@/lib/currentPhysiqueLogic';
import { resolveTargetPhysique } from '@/lib/targetPhysiqueLogic';
import { BODY_LIBRARY, selectBody } from '@/lib/bodyLibrary';
import { weightProgress } from '@/lib/goalState';
import { addDays } from '@/lib/dateUtils';
import { Card, Eyebrow, Segmented, fmt, useLocalPref, cx } from '@/components/way/ui';
import { invalidateJson } from '@/components/way/useJson';

// three.js loads only when this section opens.
const BodyViewer = dynamic(() => import('@/components/body/BodyViewer'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-way-dim">Loading 3D bodies…</div>
  ),
});

const IN = 2.54;
const half = (x) => Math.round(x * 2) / 2;

function Slider({ label, valStr, min, max, step, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[13px] text-way-ink2">
        <span>{label}</span>
        <span className="font-mono text-xs font-semibold text-emerald-300">{valStr}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="m-0 h-[22px] w-full cursor-pointer accent-emerald-400"
      />
    </div>
  );
}

/**
 * Your body in 3D (current and goal, split at your progress or side by side),
 * the measurements that shape it, and the goal that shapes the goal body.
 */
export default function BodySection({ profile, currentWeightKg, startKg, today, initialTab = 'measure' }) {
  const supabase = createClient();
  const router = useRouter();
  const sex = profile.sex === 'female' ? 'female' : 'male';
  const male = sex === 'male';
  const heightCm = Number(profile.height_cm) || 175;
  const w = Number(currentWeightKg) || Number(profile.weight_kg) || 75;
  const [units, setUnits] = useLocalPref('way.units', 'in');
  const cmOnly = units === 'cm';

  const est = useMemo(() => estimateDefaultMeasurementsCm({ heightCm, weightKg: w, sex }), [heightCm, w, sex]);
  const [m, setM] = useState(() => ({
    waist: half((Number(profile.waist_cm) || est.waistCm) / IN),
    hip: half((Number(profile.hip_cm) || est.hipCm) / IN),
    chest: half((Number(profile.chest_cm) || est.chestCm) / IN),
    arm: Math.round(((Number(profile.bicep_cm) || est.bicepCm) / IN) * 4) / 4,
  }));
  const [tab, setTab] = useState(initialTab === 'goal' ? 'goal' : 'measure');
  const [mode, setMode] = useState('split');
  const [sway, setSway] = useState(true);
  const [flash, setFlash] = useState(null);
  const [err, setErr] = useState(null);

  // The tape can't go below the waist that would mean essential fat only.
  const minWaistIn = useMemo(
    () => Math.max(26, Math.ceil((minWaistCmForBfFloor({ heightCm, weightKg: w, chestCm: m.chest * IN, hipCm: m.hip * IN, sex }) / IN) * 2) / 2),
    [heightCm, w, m.chest, m.hip, sex]
  );
  const waistIn = Math.max(m.waist, minWaistIn);
  const cm = { waist: waistIn * IN, hip: m.hip * IN, chest: m.chest * IN, bicep: m.arm * IN };

  const stats = useMemo(
    () => analyzeCurrentPhysique({ heightCm, weightKg: w, sex, waistCm: cm.waist, hipCm: cm.hip, chestCm: cm.chest, bicepCm: cm.bicep }),
    [heightCm, w, sex, cm.waist, cm.hip, cm.chest, cm.bicep]
  );
  const currentData = { sex, heightCm, weightKg: w, chestCm: cm.chest, waistCm: cm.waist, hipCm: cm.hip, bicepCm: cm.bicep, bodyFatPct: stats.bodyFatPct };

  /* ---------- goal ---------- */
  const idealKg = Math.round(22.2 * (heightCm / 100) ** 2 * 10) / 10;
  const [target, setTarget] = useState(() => (profile.dream_target_weight_kg ? Number(profile.dream_target_weight_kg) : w > idealKg ? idealKg : w));
  const [weeks, setWeeks] = useState(() => {
    if (profile.dream_target_date) {
      const d = Math.round((new Date(`${String(profile.dream_target_date).slice(0, 10)}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000 / 7);
      if (d >= 4) return Math.min(78, d);
    }
    return Math.min(78, Math.max(4, Math.round(Math.abs(w - target) / 0.5)));
  });
  const targetDate = addDays(today, weeks * 7);
  const forecast = useMemo(
    () =>
      projectScientificDream({
        currentSpecs: { weightKg: w, waistCm: cm.waist, hipCm: cm.hip, chestCm: cm.chest, bicepCm: cm.bicep, ...stats },
        targetWeightKg: target,
        heightCm,
        sex,
        daysAvailable: weeks * 7,
      }),
    [w, cm.waist, cm.hip, cm.chest, cm.bicep, stats, target, heightCm, sex, weeks]
  );
  const tdee = Math.round(stats.bmr * (ACTIVITY_MULTIPLIERS[profile.activity_level] ?? 1.375));
  const feas = useMemo(
    () =>
      calculateTimelineAndFeasibility({
        currentWeightKg: w,
        targetWeightKg: target,
        targetDateStr: targetDate,
        currentBmr: stats.bmr,
        tdee,
        sex,
        targetBfPct: forecast.targetBfPct,
      }),
    [w, target, targetDate, stats.bmr, tdee, sex, forecast.targetBfPct]
  );
  const goalKind = target < w ? 'lose_weight' : target > w ? 'gain_muscle' : 'maintain';
  const goalProtein = proteinTargetG({ weightKg: w, heightCm, goal: goalKind, activityLevel: profile.activity_level, calories: feas.calculatedDailyCalories });
  const targetData = {
    sex,
    heightCm,
    weightKg: target,
    chestCm: forecast.dimensions.chestCm,
    waistCm: forecast.dimensions.waistCm,
    hipCm: forecast.dimensions.hipCm,
    bicepCm: forecast.dimensions.bicepCm,
    bodyFatPct: forecast.targetBfPct,
  };
  const p = weightProgress({ weightLogs: startKg ? [{ weight_kg: startKg }] : [], currentKg: w, targetKg: target }) ?? 0;

  // Which library bodies were matched (same rules RealisticAvatar3D uses).
  const curBody = selectBody({ sex, typeKey: resolveCurrentPhysique(currentData).key, heightCm, chestCm: cm.chest, waistCm: cm.waist, hipCm: cm.hip, bicepCm: cm.bicep });
  const goalBody = selectBody({
    sex,
    typeKey: resolveTargetPhysique(targetData).key,
    heightCm,
    chestCm: targetData.chestCm,
    waistCm: targetData.waistCm,
    hipCm: targetData.hipCm,
    bicepCm: targetData.bicepCm,
  });
  const lib = BODY_LIBRARY.filter((b) => b.sex === sex);

  const len = (inch) => (cmOnly ? `${Math.round(inch * IN)} cm` : `${inch}″ · ${Math.round(inch * IN)} cm`);
  const lenCm = (c) => (cmOnly ? `${Math.round(c)} cm` : `${(Math.round((c / IN) * 2) / 2).toFixed(1)}″`);
  const dlt = (a, b) => {
    const d = (a - b) / (cmOnly ? 1 : IN);
    if (Math.abs(d) < 0.05) return { d: 'kept', dColor: '#7c8aa0' };
    return { d: `${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(1)}${cmOnly ? ' cm' : '″'}`, dColor: d <= 0 ? '#6ee7b7' : '#fbbf24' };
  };
  const dims = [
    { label: 'Waist', v: lenCm(targetData.waistCm), ...dlt(targetData.waistCm, cm.waist) },
    { label: 'Hips', v: lenCm(targetData.hipCm), ...dlt(targetData.hipCm, cm.hip) },
    { label: male ? 'Chest' : 'Bust', v: lenCm(targetData.chestCm), ...dlt(targetData.chestCm, cm.chest) },
    male
      ? { label: 'V-taper', v: `${(targetData.chestCm / targetData.waistCm).toFixed(2)}×`, d: `was ${(cm.chest / cm.waist).toFixed(2)}×`, dColor: '#7c8aa0' }
      : { label: 'Waist / hip', v: (targetData.waistCm / targetData.hipCm).toFixed(2), d: `was ${(cm.waist / cm.hip).toFixed(2)}`, dColor: '#7c8aa0' },
  ];

  const dw = w - target;
  const rate = Math.abs(dw) / weeks;
  let title;
  let body;
  if (Math.abs(dw) < 0.05) {
    title = 'Maintain';
    body = `Hold ${target.toFixed(1)} kg at about ${fmt(tdee)} kcal a day.`;
  } else if (!feas.isFeasible) {
    title = feas.reasons?.[0]?.startsWith('Rate') || feas.reasons?.[0]?.startsWith('A surplus') ? 'Too fast' : 'Not safe as set';
    body = `${feas.reasons?.[0] || 'This goal is outside safe limits.'}${feas.recommendedWeeks ? ` Give it at least ${feas.recommendedWeeks} weeks.` : ''}`;
  } else {
    const { carbsG, fatG } = splitCarbsFat(feas.calculatedDailyCalories, goalProtein);
    title = 'Safe pace';
    body = `Confirming sets your daily target to ${fmt(feas.calculatedDailyCalories)} kcal and protein to ${goalProtein} g, with ${carbsG} g carbs and ${fatG} g fat from what's left.`;
  }
  const feasible = Math.abs(dw) < 0.05 || feas.isFeasible;
  const byStr = new Date(`${targetDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const flashFor = (key) => {
    setFlash(key);
    setTimeout(() => setFlash((f) => (f === key ? null : f)), 2200);
  };
  const saveMeasurements = async () => {
    setErr(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        waist_cm: Math.round(cm.waist * 10) / 10,
        hip_cm: Math.round(cm.hip * 10) / 10,
        chest_cm: Math.round(cm.chest * 10) / 10,
        bicep_cm: Math.round(cm.bicep * 10) / 10,
      })
      .eq('id', profile.id);
    if (error) return setErr(error.message);
    flashFor('meas');
    invalidateJson('/api/');
    router.refresh();
  };
  const confirmGoal = async () => {
    if (!feasible) return;
    setErr(null);
    const kcal = Math.abs(dw) < 0.05 ? tdee : feas.calculatedDailyCalories;
    const { error } = await supabase
      .from('profiles')
      .update({
        dream_target_weight_kg: target,
        dream_target_date: targetDate,
        override_calories: kcal,
        override_protein_g: goalProtein,
        // Cleared so carbs and fat re-split from the calories and protein above.
        override_carbs_g: null,
        override_fat_g: null,
        goal: goalKind,
      })
      .eq('id', profile.id);
    if (error) return setErr(error.message);
    flashFor('goal');
    invalidateJson('/api/');
    router.refresh();
  };

  const comp = [
    { label: 'Body fat', v: `${stats.bodyFatPct.toFixed(1)}%`, color: '#fbbf24' },
    { label: 'Lean mass', v: stats.leanMassKg.toFixed(1), color: '#f1f5f9' },
    { label: 'BMR', v: fmt(stats.bmr), color: '#f1f5f9' },
    { label: 'FFMI', v: stats.ffmi.toFixed(1), color: '#f1f5f9' },
  ];
  const nowStr = `${w.toFixed(1)} kg · ${stats.bodyFatPct.toFixed(1)}% fat`;
  const goalStr = `${target.toFixed(1)} kg · ${forecast.targetBfPct.toFixed(1)}% fat`;
  const side = mode === 'side';

  const viewerCard = (
    <Card className="flex flex-col gap-3 p-3.5 lg:sticky lg:top-8 lg:gap-3.5 lg:p-[18px]">
      <div className="flex items-center justify-between gap-2 px-1 pt-0.5 lg:px-1.5 lg:pt-1">
        <Eyebrow>Your body</Eyebrow>
        <div className="flex items-center gap-1.5 lg:gap-2">
          <Segmented
            size="sm"
            className="rounded-[10px] bg-way-rail p-[3px]"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'split', label: 'Split' },
              { value: 'side', label: 'Side by side' },
            ]}
          />
          <button
            type="button"
            onClick={() => setSway((s) => !s)}
            title="Toggle motion"
            aria-label="Toggle motion"
            aria-pressed={sway}
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors lg:h-[34px] lg:w-[34px]',
              sway ? 'border-way-ink bg-way-ink text-way-page' : 'border-way-line2 text-way-mute'
            )}
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>
      <div className="relative h-[380px] overflow-hidden rounded-2xl border border-way-line bg-way-rail lg:h-[600px]">
        <BodyViewer currentData={currentData} targetData={targetData} mode={mode} progress={p} sway={sway} />
        {side ? (
          <>
            <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-0.5 lg:left-4 lg:top-4">
              <span className="font-heading text-[10px] font-bold tracking-[0.12em] text-way-mute lg:text-[11px]">NOW · {curBody.label.toUpperCase()}</span>
              <span className="font-mono text-xs font-semibold text-way-ink2 lg:text-[13px]">{nowStr}</span>
            </div>
            <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-0.5 text-right lg:right-4 lg:top-4">
              <span className="font-heading text-[10px] font-bold tracking-[0.12em] text-way-protein lg:text-[11px]">GOAL · {goalBody.label.toUpperCase()}</span>
              <span className="font-mono text-xs font-semibold text-emerald-300 lg:text-[13px]">{goalStr}</span>
            </div>
          </>
        ) : null}
        <div className="pointer-events-none absolute bottom-2.5 left-3 font-mono text-[10px] font-medium text-way-faint lg:bottom-3.5 lg:left-4 lg:text-[11px]">Drag to rotate</div>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:gap-2.5">
        <div className="flex min-w-0 flex-col gap-[3px] rounded-xl border border-way-line bg-way-rail px-3 py-2.5 lg:px-3.5 lg:py-3">
          <span className="truncate font-heading text-[10px] font-bold tracking-[0.12em] text-way-dim">NOW · {curBody.label.toUpperCase()}</span>
          <span className="whitespace-nowrap font-mono text-xs font-semibold text-way-ink2 lg:text-sm">{nowStr}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-[3px] rounded-xl border border-emerald-400/25 bg-emerald-500/6 px-3 py-2.5 lg:px-3.5 lg:py-3">
          <span className="truncate font-heading text-[10px] font-bold tracking-[0.12em] text-way-protein">GOAL · {goalBody.label.toUpperCase()}</span>
          <span className="whitespace-nowrap font-mono text-xs font-semibold text-emerald-300 lg:text-sm">{goalStr}</span>
        </div>
      </div>
    </Card>
  );

  const actionBtn = (on, onClick, label, doneLabel, Icon, disabled) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex shrink-0 items-center justify-center gap-2 rounded-xl px-[18px] py-[13px] text-[13px] font-semibold text-way-page transition-[background,opacity] lg:py-3',
        on ? 'bg-emerald-500' : 'bg-way-ink hover:bg-white',
        disabled && 'opacity-35'
      )}
    >
      {on ? <Check size={14} /> : <Icon size={14} />}
      {on ? doneLabel : label}
    </button>
  );

  const measureCard = (
    <Card className="flex flex-col gap-[18px] p-[18px] lg:gap-5 lg:p-[26px]">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Measurements</Eyebrow>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs font-medium text-way-dim sm:inline">
            {w.toFixed(1)} kg · {Math.round(heightCm)} cm
          </span>
          <Segmented
            size="sm"
            className="rounded-[10px] bg-way-rail p-[3px]"
            value={units}
            onChange={setUnits}
            options={[
              { value: 'in', label: 'in' },
              { value: 'cm', label: 'cm' },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2 lg:gap-x-7 lg:gap-y-5">
        <Slider label="Waist" valStr={len(waistIn)} min={minWaistIn} max={50} step={0.5} value={waistIn} onChange={(v) => setM((s) => ({ ...s, waist: v }))} />
        <Slider label="Hips" valStr={len(m.hip)} min={30} max={52} step={0.5} value={m.hip} onChange={(v) => setM((s) => ({ ...s, hip: v }))} />
        <Slider label={male ? 'Chest' : 'Bust'} valStr={len(m.chest)} min={30} max={54} step={0.5} value={m.chest} onChange={(v) => setM((s) => ({ ...s, chest: v }))} />
        <Slider label="Upper arm" valStr={len(m.arm)} min={9} max={20} step={0.25} value={m.arm} onChange={(v) => setM((s) => ({ ...s, arm: v }))} />
      </div>
      <div className="grid grid-cols-4 border-t border-way-line pt-3.5 lg:pt-[18px]">
        {comp.map((c) => (
          <div key={c.label} className="flex flex-col items-center gap-[3px] lg:gap-1">
            <span className="font-mono text-[15px] font-semibold lg:text-xl" style={{ color: c.color }}>
              {c.v}
            </span>
            <span className="text-[10px] text-way-dim lg:text-xs">{c.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:border-t lg:border-way-line lg:pt-[18px]">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-[11px] text-way-dim lg:text-xs">
            Matched from {lib.length} {sex} bodies by your measurements
          </span>
          <div className="flex flex-wrap gap-1.5">
            {lib.map((b) => {
              const isC = curBody.id === b.id;
              const isG = goalBody.id === b.id;
              return (
                <span
                  key={b.id}
                  className="rounded-full border px-[9px] py-1 font-mono text-[10px] font-semibold transition-colors duration-300 lg:text-[11px]"
                  style={{
                    background: isC ? '#cbd5e1' : isG ? 'rgba(16,185,129,.14)' : 'transparent',
                    color: isC ? '#090d16' : isG ? '#6ee7b7' : '#7c8aa0',
                    borderColor: isC ? '#cbd5e1' : isG ? 'rgba(52,211,153,.5)' : '#1c2433',
                  }}
                >
                  {b.label}
                  {isC && isG ? ' · now & goal' : isC ? ' · now' : isG ? ' · goal' : ''}
                </span>
              );
            })}
          </div>
        </div>
        {actionBtn(flash === 'meas', saveMeasurements, 'Save measurements', 'Measurements saved', Save, false)}
      </div>
    </Card>
  );

  const goalCard = (
    <Card className="flex flex-col gap-[18px] p-[18px] lg:gap-5 lg:p-[26px]">
      <div className="flex items-center justify-between">
        <Eyebrow>Your goal</Eyebrow>
        <span className="font-mono text-[11px] font-medium text-way-dim lg:text-xs">by {byStr}</span>
      </div>
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2 lg:gap-x-7 lg:gap-y-5">
        <Slider
          label="Goal weight"
          valStr={`${target.toFixed(1)} kg (${dw > 0 ? '−' : '+'}${Math.abs(dw).toFixed(1)})`}
          min={Math.max(35, Math.round(w - 25))}
          max={Math.round(w + 20)}
          step={0.5}
          value={target}
          onChange={setTarget}
        />
        <Slider label="By when" valStr={`${weeks} weeks`} min={4} max={78} step={1} value={weeks} onChange={setWeeks} />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-2.5">
        {dims.map((d) => (
          <div key={d.label} className="flex flex-col gap-[3px] rounded-xl border border-way-line bg-way-rail px-3 py-2.5 lg:px-3.5 lg:py-3">
            <span className="text-[11px] text-way-dim">{d.label}</span>
            <span className="font-mono text-[15px] font-semibold lg:text-base">{d.v}</span>
            <span className="font-mono text-[10px] font-medium lg:text-[11px]" style={{ color: d.dColor }}>
              {d.d}
            </span>
          </div>
        ))}
      </div>
      <div
        className="flex flex-col gap-3 rounded-[14px] border px-3.5 py-3 lg:flex-row lg:items-center lg:gap-4 lg:px-[18px] lg:py-4"
        style={feasible ? { background: 'rgba(16,185,129,.06)', borderColor: 'rgba(52,211,153,.3)' } : { background: 'rgba(251,113,133,.07)', borderColor: 'rgba(251,113,133,.35)' }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:gap-[5px]">
          <div className="flex items-center justify-between gap-2 lg:justify-start lg:gap-2.5">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold lg:text-sm" style={{ color: feasible ? '#6ee7b7' : '#fda4af' }}>
              {feasible ? <CircleCheck size={14} /> : <TriangleAlert size={14} />}
              {title}
            </span>
            <span className="font-mono text-xs font-semibold" style={{ color: feasible ? '#6ee7b7' : '#fda4af' }}>
              {Math.abs(dw) < 0.05 ? '0 kg / wk' : `${dw > 0 ? '−' : '+'}${rate.toFixed(2)} kg / wk`}
            </span>
          </div>
          <span className="text-xs leading-normal text-way-ink2 [text-wrap:pretty] lg:text-[13px]">{body}</span>
        </div>
        {actionBtn(flash === 'goal', confirmGoal, 'Confirm goal', 'Goal set', Target, !feasible)}
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-5">
      {viewerCard}
      <div className="flex flex-col gap-3.5 lg:gap-5">
        <Segmented
          stretch
          className="lg:hidden"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'measure', label: 'Measurements' },
            { value: 'goal', label: 'Goal' },
          ]}
        />
        <div className={cx(tab === 'measure' ? 'block' : 'hidden', 'lg:block')}>{measureCard}</div>
        <div className={cx(tab === 'goal' ? 'block' : 'hidden', 'lg:block')}>{goalCard}</div>
        {err ? <p className="text-[13px] text-rose-300">{err}</p> : null}
      </div>
    </div>
  );
}
