'use client';

import { useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Canvas, useFrame } from '@react-three/fiber';
import { createClient } from '@/lib/supabaseClient';
import { analyzeCurrentPhysique } from '@/lib/bodyProportions';
import { ui } from '@/lib/ui';
import { Sparkles } from 'lucide-react';
import { getCurrentUserId } from '@/lib/currentUser';

const RealisticAvatar3D = dynamic(() => import('@/components/body/RealisticAvatar3D'), {
  ssr: false,
});

// components/onboarding/BodyMeasurementsForm.js

function SpinningPreview({ heightCm, weightKg, chestCm, waistCm, hipCm, bicepCm, bodyFatPct }) {
  const rotationRef = useRef();
  useFrame((_, delta) => {
    if (rotationRef.current) rotationRef.current.rotation.y += delta * 0.4;
  });

  return (
    <group position={[0, -0.95, 0]}>
      <group ref={rotationRef}>
        <RealisticAvatar3D
          heightCm={heightCm}
          weightKg={weightKg}
          chestCm={chestCm}
          waistCm={waistCm}
          hipCm={hipCm}
          bicepCm={bicepCm}
          bodyFatPct={bodyFatPct}
          color="#94a3b8"
          roughness={0.45}
          isTarget={false}
        />
      </group>
    </group>
  );
}
export default function BodyMeasurementsForm({ heightCm, weightKg, sex = 'male', onSaved, onSkip }) {
  const supabase = createClient();

  const defaultWaistIn = useMemo(() => {
    const estWaistCm = (weightKg / (heightCm / 100) ** 2) * 1.55 + heightCm * 0.28;
    return Math.round((estWaistCm / 2.54) * 2) / 2;
  }, [weightKg, heightCm]);

  const defaultHipIn = useMemo(() => {
    const estHipCm = defaultWaistIn * 2.54 * (sex === 'male' ? 1.07 : 1.18);
    return Math.round((estHipCm / 2.54) * 2) / 2;
  }, [defaultWaistIn, sex]);

  const defaultChestIn = useMemo(() => {
    const estChestCm = heightCm * 0.54 + (weightKg - 70) * 0.2;
    return Math.round((estChestCm / 2.54) * 2) / 2;
  }, [heightCm, weightKg]);

  const defaultBicepIn = useMemo(() => {
    const estBicepCm = 28 + weightKg / 10;
    return Math.round((estBicepCm / 2.54) * 2) / 2;
  }, [weightKg]);

  const [waistIn, setWaistIn] = useState(defaultWaistIn);
  const [hipIn, setHipIn] = useState(defaultHipIn);
  const [chestIn, setChestIn] = useState(defaultChestIn);
  const [bicepIn, setBicepIn] = useState(defaultBicepIn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const waistCm = waistIn * 2.54;
  const hipCm = hipIn * 2.54;
  const chestCm = chestIn * 2.54;
  const bicepCm = bicepIn * 2.54;

  const stats = useMemo(
    () => analyzeCurrentPhysique({ heightCm, weightKg, sex, waistCm, hipCm, chestCm, bicepCm }),
    [heightCm, weightKg, sex, waistCm, hipCm, chestCm, bicepCm]
  );

  const sliders = [
    { key: 'waist', label: 'Waist', value: waistIn, set: setWaistIn, min: 26, max: 46, step: 0.5, cm: waistCm },
    { key: 'hip', label: 'Hips', value: hipIn, set: setHipIn, min: 30, max: 50, step: 0.5, cm: hipCm },
    { key: 'chest', label: 'Chest', value: chestIn, set: setChestIn, min: 32, max: 52, step: 0.5, cm: chestCm },
    { key: 'bicep', label: 'Arms', value: bicepIn, set: setBicepIn, min: 10, max: 20, step: 0.25, cm: bicepCm },
  ];

  const handleSave = async () => {
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
    const { error: upsertError } = await supabase
      .from('profiles')
      .update({
        waist_cm: Math.round(waistCm * 10) / 10,
        hip_cm: Math.round(hipCm * 10) / 10,
        chest_cm: Math.round(chestCm * 10) / 10,
        bicep_cm: Math.round(bicepCm * 10) / 10,
      })
      .eq('id', userId);

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    onSaved?.();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className={`${ui.heading}`}>Your body</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-slate-400">
          A rough estimate is fine — drag until it looks about right. You can fine-tune this later.
        </p>
      </div>

      <div className={`${ui.card} overflow-hidden p-0`}>
        <div className="h-64 w-full">
          <Canvas camera={{ position: [0, 0.1, 3], fov: 42 }} gl={{ alpha: true, antialias: true }}>
            <ambientLight intensity={0.95} />
            <directionalLight position={[4, 6, 4]} intensity={1.4} />
            <directionalLight position={[-4, 2, -2]} intensity={0.6} color="#ffffff" />
            <SpinningPreview
              heightCm={heightCm}
              weightKg={weightKg}
              chestCm={chestCm}
              waistCm={waistCm}
              hipCm={hipCm}
              bicepCm={bicepCm}
              bodyFatPct={stats.bodyFatPct}
            />
          </Canvas>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-xs font-numeric">
          <span className="text-slate-500 dark:text-slate-400">Estimated body fat</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.bodyFatPct}%</span>
        </div>
      </div>

      <div className={`${ui.card} space-y-5`}>
        {sliders.map((s) => (
          <div key={s.key} className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">{s.label}</span>
              <span className="font-numeric font-bold text-emerald-600 dark:text-emerald-400">
                {s.value}&quot; ({Math.round(s.cm)} cm)
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.value}
              onChange={(e) => s.set(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onSkip} className={`${ui.btnSecondary} flex-1`}>
          Skip for now
        </button>
        <button type="button" disabled={saving} onClick={handleSave} className={`${ui.btnPrimary} flex-1`}>
          {saving ? 'Saving...' : (
            <>
              <Sparkles size={15} /> Looks right
            </>
          )}
        </button>
      </div>
    </div>
  );
}