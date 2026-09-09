'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import { analyzeCurrentPhysique, projectScientificDream } from '@/lib/bodyProportions';
import { calculateTimelineAndFeasibility } from '@/lib/goalFeasibility';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Sparkles,
  UserCheck,
  Target,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { ui } from '@/lib/ui';

const BodyStudioCanvas = dynamic(() => import('./BodyStudioCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 w-full items-center justify-center text-xs font-medium text-slate-400">
      Loading 3D Visualizer...
    </div>
  ),
});

export default function BodyStudio({ profile }) {
  const supabase = createClient();
  const router = useRouter();

  const heightCm = Number(profile?.height_cm) || 175.0;
  const currentWeightKg = Number(profile?.weight_kg) || 75.0;
  const userSex = profile?.sex || 'male';

  const [activeTab, setActiveTab] = useState('dream');

  const defaultWaistIn = useMemo(() => {
    const estWaistCm = (currentWeightKg / (heightCm / 100) ** 2) * 1.55 + heightCm * 0.28;
    return Math.round((estWaistCm / 2.54) * 2) / 2;
  }, [currentWeightKg, heightCm]);

  const defaultHipIn = useMemo(() => {
    const estHipCm = defaultWaistIn * 2.54 * (userSex === 'male' ? 1.07 : 1.18);
    return Math.round((estHipCm / 2.54) * 2) / 2;
  }, [defaultWaistIn, userSex]);

  const defaultChestIn = useMemo(() => {
    const estChestCm = heightCm * 0.54 + (currentWeightKg - 70) * 0.2;
    return Math.round((estChestCm / 2.54) * 2) / 2;
  }, [heightCm, currentWeightKg]);

  const defaultBicepIn = useMemo(() => {
    const estBicepCm = 28 + currentWeightKg / 10;
    return Math.round((estBicepCm / 2.54) * 2) / 2;
  }, [currentWeightKg]);

  const [waistIn, setWaistIn] = useState(defaultWaistIn);
  const [hipIn, setHipIn] = useState(defaultHipIn);
  const [chestIn, setChestIn] = useState(defaultChestIn);
  const [bicepIn, setBicepIn] = useState(defaultBicepIn);

  useEffect(() => {
    setWaistIn(defaultWaistIn);
    setHipIn(defaultHipIn);
    setChestIn(defaultChestIn);
    setBicepIn(defaultBicepIn);
  }, [defaultWaistIn, defaultHipIn, defaultChestIn, defaultBicepIn]);

  const waistCm = waistIn * 2.54;
  const hipCm = hipIn * 2.54;
  const chestCm = chestIn * 2.54;
  const bicepCm = bicepIn * 2.54;

  const currentStats = useMemo(() => {
    return analyzeCurrentPhysique({
      heightCm,
      weightKg: currentWeightKg,
      sex: userSex,
      waistCm,
      hipCm,
      chestCm,
      bicepCm,
    });
  }, [heightCm, currentWeightKg, userSex, waistCm, hipCm, chestCm, bicepCm]);

  const defaultTargetWeight = useMemo(() => {
    if (profile?.dream_target_weight_kg) return Number(profile.dream_target_weight_kg);
    const idealWeight = Math.round(22.2 * (heightCm / 100) ** 2 * 10) / 10;
    return currentWeightKg > idealWeight ? idealWeight : currentWeightKg;
  }, [profile?.dream_target_weight_kg, heightCm, currentWeightKg]);

  const [targetWeight, setTargetWeight] = useState(defaultTargetWeight);

  useEffect(() => {
    if (profile?.dream_target_weight_kg) {
      setTargetWeight(Number(profile.dream_target_weight_kg));
    }
  }, [profile?.dream_target_weight_kg]);

  const [targetDate, setTargetDate] = useState(() => {
    const absDiff = Math.abs(currentWeightKg - defaultTargetWeight);
    const weeksNeeded = Math.max(1, Math.round(absDiff / 0.85));
    const d = new Date();
    d.setDate(d.getDate() + weeksNeeded * 7);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    const absDiff = Math.abs(currentWeightKg - targetWeight);
    const weeksNeeded = Math.max(1, Math.round(absDiff / 0.85));
    const d = new Date();
    d.setDate(d.getDate() + weeksNeeded * 7);
    setTargetDate(d.toISOString().split('T')[0]);
  }, [targetWeight, currentWeightKg]);

  const dreamForecast = useMemo(() => {
    return projectScientificDream({
      currentSpecs: {
        weightKg: currentWeightKg,
        waistCm,
        hipCm,
        chestCm,
        bicepCm,
        ...currentStats,
      },
      targetWeightKg: targetWeight,
      heightCm,
      sex: userSex,
    });
  }, [currentWeightKg, waistCm, hipCm, chestCm, bicepCm, currentStats, targetWeight, heightCm, userSex]);

  const feasibility = useMemo(() => {
    const tdee = Math.round(currentStats.bmr * 1.5);
    return calculateTimelineAndFeasibility({
      currentWeightKg,
      targetWeightKg: targetWeight,
      targetDateStr: targetDate,
      currentBmr: currentStats.bmr,
      tdee,
      sex: userSex,
      targetBfPct: dreamForecast.targetBfPct,
    });
  }, [currentWeightKg, targetWeight, targetDate, currentStats.bmr, userSex, dreamForecast.targetBfPct]);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSetGoal = async () => {
    if (!feasibility.isFeasible) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        dream_target_weight_kg: targetWeight,
        override_calories: feasibility.calculatedDailyCalories,
        override_protein_g: Math.round(currentWeightKg * 2.0),
        goal: targetWeight < currentWeightKg ? 'lose_weight' : 'gain_muscle',
      })
      .eq('id', profile.id);

    setSaving(false);
    if (!error) {
      setSavedSuccess(true);
      router.refresh();
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* 3D Side-by-Side Dual Figure Stage */}
      <div className={`${ui.card} relative overflow-hidden bg-gradient-to-b from-slate-50/50 dark:from-slate-900/60 to-white dark:to-slate-900 pt-3 pb-2`}>
        <BodyStudioCanvas
          currentData={{
            heightCm,
            weightKg: currentWeightKg,
            chestCm,
            waistCm,
            hipCm,
            bicepCm,
            bodyFatPct: currentStats.bodyFatPct,
          }}
          targetData={{
            heightCm,
            weightKg: targetWeight,
            chestCm: dreamForecast.dimensions.chestCm,
            waistCm: dreamForecast.dimensions.waistCm,
            hipCm: dreamForecast.dimensions.hipCm,
            bicepCm: dreamForecast.dimensions.bicepCm,
            bodyFatPct: dreamForecast.targetBfPct,
          }}
        />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <button
          type="button"
          onClick={() => setActiveTab('current')}
          className={`py-2 rounded-lg transition ${
            activeTab === 'current'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          1. Current Measurements
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dream')}
          className={`py-2 rounded-lg transition ${
            activeTab === 'dream'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          2. Target Transformation
        </button>
      </div>

      <div className={ui.card}>
        {activeTab === 'current' ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sliders size={16} /> Baseline Dimensions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Adjust measurements to match your personal body structure.
                </p>
              </div>
              <span className="text-xs font-numeric font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                {currentWeightKg} kg · {heightCm} cm
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Waist</span>
                  <span className="font-numeric font-bold text-sky-600 dark:text-sky-400">
                    {waistIn}&quot; ({Math.round(waistCm)} cm)
                  </span>
                </div>
                <input
                  type="range"
                  min="26"
                  max="46"
                  step="0.5"
                  value={waistIn}
                  onChange={(e) => setWaistIn(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Hips</span>
                  <span className="font-numeric font-bold text-sky-600 dark:text-sky-400">
                    {hipIn}&quot; ({Math.round(hipCm)} cm)
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="50"
                  step="0.5"
                  value={hipIn}
                  onChange={(e) => setHipIn(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Chest</span>
                  <span className="font-numeric font-bold text-sky-600 dark:text-sky-400">
                    {chestIn}&quot; ({Math.round(chestCm)} cm)
                  </span>
                </div>
                <input
                  type="range"
                  min="32"
                  max="52"
                  step="0.5"
                  value={chestIn}
                  onChange={(e) => setChestIn(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Arms (Biceps)</span>
                  <span className="font-numeric font-bold text-sky-600 dark:text-sky-400">
                    {bicepIn}&quot; ({Math.round(bicepCm)} cm)
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="20"
                  step="0.25"
                  value={bicepIn}
                  onChange={(e) => setBicepIn(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            <div className="rounded-xl border border-sky-200/70 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-sky-950 dark:text-sky-300">
                <span className="flex items-center gap-1.5">
                  <Activity size={14} /> Current Composition Analysis
                </span>
                <span className="font-numeric text-sky-800 dark:text-sky-400 text-sm font-extrabold">
                  {currentStats.bodyFatPct}% Body Fat
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 font-numeric text-center text-xs">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-sky-100 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-sans">Lean Mass</span>
                  <span className="font-bold text-slate-800 dark:text-white text-sm">{currentStats.leanMassKg} kg</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-sky-100 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-sans">BMR (Katch)</span>
                  <span className="font-bold text-slate-800 dark:text-white text-sm">{currentStats.bmr} kcal</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-sky-100 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-sans">FFMI</span>
                  <span className="font-bold text-slate-800 dark:text-white text-sm">{currentStats.ffmi}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('dream')}
                className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 dark:bg-sky-500 text-white font-semibold py-2.5 text-xs hover:bg-sky-700 shadow-xs transition cursor-pointer"
              >
                Proceed to Target Goal <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Target size={16} className="text-emerald-500" /> Target Configuration & Timeline
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Adjust target weight to evaluate physiological feasibility.
                </p>
              </div>
              <span className="text-xs font-numeric font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                ~0.85 kg / week pace
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Target Weight</span>
                  <span className="font-numeric text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    {targetWeight} kg{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({dreamForecast.weightDelta > 0 ? `+${dreamForecast.weightDelta}` : dreamForecast.weightDelta} kg)
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={Math.max(45, Math.round(currentWeightKg - 25))}
                  max={Math.round(currentWeightKg + 20)}
                  step="0.5"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Calendar size={13} /> Target Deadline
                  </span>
                  <span className="font-numeric text-slate-600 dark:text-slate-300 text-xs font-bold">
                    {feasibility.weeks} wks ({feasibility.days} days)
                  </span>
                </div>
                <input
                  type="date"
                  value={targetDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className={ui.input}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Projected Sizing at {targetWeight} kg
              </span>

              <div className="grid grid-cols-4 gap-2 text-center font-numeric">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">Waist</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
                    {dreamForecast.dimensions.waistIn}&quot;
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-semibold">
                    {(dreamForecast.dimensions.waistIn - waistIn).toFixed(1)}&quot;
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">Hips</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
                    {dreamForecast.dimensions.hipIn}&quot;
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-semibold">
                    {(dreamForecast.dimensions.hipIn - hipIn).toFixed(1)}&quot;
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">Chest</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
                    {dreamForecast.dimensions.chestIn}&quot;
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium">Preserved</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">V-Taper</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    {dreamForecast.dimensions.vTaper}x
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium">Ratio</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs font-numeric">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="font-sans text-slate-400 dark:text-slate-500 text-[11px]">Fat Loss:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {Math.abs(dreamForecast.fatDelta)} kg
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="font-sans text-slate-400 dark:text-slate-500 text-[11px]">Water/Glycogen:</span>
                  <strong className="text-slate-800 dark:text-white">
                    {Math.abs(dreamForecast.muscleDelta)} kg
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="font-sans text-slate-400 dark:text-slate-500 text-[11px]">Target BF:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {dreamForecast.targetBfPct}%
                  </strong>
                </div>
              </div>
            </div>

            {feasibility.isFeasible ? (
              <div className="space-y-3 pt-1">
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <Sparkles size={15} className="text-emerald-500" /> Plan Achievable & Clinically Sound
                    </span>
                    <span className="font-numeric font-bold text-emerald-800 dark:text-emerald-400 text-sm">
                      {feasibility.weeklyRate} kg / wk
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-numeric mt-1">
                    Recommended Daily Target:{' '}
                    <strong>{feasibility.calculatedDailyCalories} kcal/day</strong> (with ~{Math.round(currentWeightKg * 2)}g protein)
                  </p>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSetGoal}
                  className={`${ui.btnPrimary} w-full py-3 cursor-pointer`}
                >
                  {saving ? (
                    'Applying Plan...'
                  ) : savedSuccess ? (
                    <>
                      <CheckCircle2 size={16} /> Plan Activated!
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} /> Adopt Plan to Reach {targetWeight}kg by {targetDate}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300 mt-0.5">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-rose-950 dark:text-white">
                      Goal Beyond Safe Physiological Boundaries
                    </h4>
                    <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                      This target requires an extreme deficit rate that falls outside this app&apos;s safe capabilities.
                    </p>
                  </div>
                </div>

                <ul className="space-y-1 pl-4 list-disc text-xs text-rose-800/90 dark:text-rose-300/90 leading-normal font-numeric">
                  {feasibility.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>

                <div className="pt-2 border-t border-rose-200/70 dark:border-rose-800/60 text-xs text-rose-900 dark:text-rose-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <UserCheck size={14} /> Please seek a physician or registered dietitian for guidance.
                  </span>
                  <button
                    type="button"
                    onClick={() => setTargetDate(feasibility.recommendedDateStr)}
                    className="underline font-bold text-rose-950 dark:text-white hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer"
                  >
                    Adjust to safe date ({feasibility.recommendedDateStr})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}