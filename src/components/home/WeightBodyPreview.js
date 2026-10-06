'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  analyzeCurrentPhysique,
  projectScientificDream,
  minWaistCmForBfFloor,
  estimateDefaultMeasurementsCm,
} from '@/lib/bodyProportions';

// three.js is only downloaded the first time the panel is opened.
export const prefetchWeightBody = () => {
  import('@/components/body/WeightBodyCanvas');
};

const WeightBodyCanvas = dynamic(() => import('@/components/body/WeightBodyCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[270px] w-full items-center justify-center text-xs font-medium text-slate-400 sm:h-[340px]">
      Loading 3D model...
    </div>
  ),
});

const half = (inches) => Math.round(inches * 2) / 2;

export default function WeightBodyPreview({ open, profile, weightKg: weightProp, weightLogs = [] }) {
  // Keep the canvas mounted after the first open so re-opening is instant.
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  const model = useMemo(() => {
    const heightCm = Number(profile?.height_cm) || 175;
    const weightKg = Number(weightProp) || Number(profile?.weight_kg) || 75;
    const sex = profile?.sex === 'female' ? 'female' : 'male';

    // Same sex-specific defaults the Body Measurements tab uses.
    const est = estimateDefaultMeasurementsCm({ heightCm, weightKg, sex });
    const waistIn0 = half(Number(profile?.waist_cm || est.waistCm) / 2.54);
    const hipIn = half(Number(profile?.hip_cm || est.hipCm) / 2.54);
    const chestIn = half(Number(profile?.chest_cm || est.chestCm) / 2.54);
    const bicepIn = half(Number(profile?.bicep_cm || est.bicepCm) / 2.54);

    const chestCm = chestIn * 2.54;
    const hipCm = hipIn * 2.54;
    const minWaistIn = Math.max(
      26,
      Math.ceil((minWaistCmForBfFloor({ heightCm, weightKg, chestCm, hipCm, sex }) / 2.54) * 2) / 2
    );
    const waistCm = Math.max(waistIn0, minWaistIn) * 2.54;
    const bicepCm = bicepIn * 2.54;

    const stats = analyzeCurrentPhysique({ heightCm, weightKg, sex, waistCm, hipCm, chestCm, bicepCm });
    const currentData = { sex, heightCm, weightKg, chestCm, waistCm, hipCm, bicepCm, bodyFatPct: stats.bodyFatPct };

    const targetKg = profile?.dream_target_weight_kg ? Number(profile.dream_target_weight_kg) : null;
    if (!targetKg) return { currentData, targetData: null, targetKg: null, bodyFatPct: stats.bodyFatPct };

    const dateStr = profile?.dream_target_date ? String(profile.dream_target_date).slice(0, 10) : null;
    const daysAvailable = dateStr
      ? Math.max(1, Math.ceil((new Date(`${dateStr}T00:00:00`) - new Date()) / 86400000))
      : Math.max(7, Math.round((Math.abs(weightKg - targetKg) / 0.85) * 7));

    const forecast = projectScientificDream({
      currentSpecs: { weightKg, waistCm, hipCm, chestCm, bicepCm, ...stats },
      targetWeightKg: targetKg,
      heightCm,
      sex,
      daysAvailable,
    });

    return {
      currentData,
      targetKg,
      bodyFatPct: stats.bodyFatPct,
      targetData: {
        sex,
        heightCm,
        weightKg: targetKg,
        chestCm: forecast.dimensions.chestCm,
        waistCm: forecast.dimensions.waistCm,
        hipCm: forecast.dimensions.hipCm,
        bicepCm: forecast.dimensions.bicepCm,
        bodyFatPct: forecast.targetBfPct,
      },
    };
  }, [profile, weightProp]);

  // How close are we? Measured from the first weight ever logged.
  const progress = useMemo(() => {
    const { targetKg, currentData } = model;
    if (!targetKg) return null;
    const now = currentData.weightKg;
    const oldest = weightLogs.length ? Number(weightLogs[weightLogs.length - 1].weight_kg) : now;
    const start = Number.isFinite(oldest) && oldest > 0 ? oldest : now;
    const total = start - targetKg;

    let p;
    if (Math.abs(total) < 0.05) p = Math.abs(now - targetKg) < 0.5 ? 1 : 0;
    else p = (start - now) / total;
    p = Math.min(1, Math.max(0, p));

    const losing = targetKg < start;
    const moved = Math.max(0, losing ? start - now : now - start);
    return {
      p,
      pct: Math.round(p * 100),
      start,
      moved,
      left: Math.abs(now - targetKg),
      verb: losing ? 'lost' : 'gained',
    };
  }, [model, weightLogs]);

  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/60 to-white px-3 pb-3 pt-3 dark:border-slate-800 dark:from-[#071530]/60 dark:to-slate-900 sm:px-4 sm:pb-4">
          {/* Labels */}
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-slate-400">Now</p>
              <p className="font-numeric mt-0.5 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                {model.currentData.weightKg} kg · {model.bodyFatPct}% fat
              </p>
            </div>
            {model.targetKg && (
              <div className="min-w-0 text-right">
                <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Goal
                </p>
                <p className="font-numeric mt-0.5 truncate text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {model.targetKg} kg · {model.targetData.bodyFatPct}% fat
                </p>
              </div>
            )}
          </div>

          {/* 3D window */}
          {everOpened ? (
            <WeightBodyCanvas
              currentData={model.currentData}
              targetData={model.targetData}
              progress={progress ? progress.p : 0}
              active={open}
            />
          ) : (
            <div className="h-[270px] sm:h-[340px]" />
          )}

          {/* Progress */}
          {progress ? (
            <div className="space-y-2">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-slate-400 to-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.max(progress.pct, progress.pct > 0 ? 3 : 0)}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-numeric text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {progress.pct}% closer to goal
                </span>
                <span className="font-numeric text-[11px] text-slate-500 dark:text-slate-400">
                  {progress.moved.toFixed(1)} kg {progress.verb} · {progress.left.toFixed(1)} kg to go
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Set a target weight to see how close you are to your goal.{' '}
              <Link href="/settings?tab=body" className="font-semibold text-emerald-600 underline underline-offset-2 dark:text-emerald-400">
                Set a goal
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
