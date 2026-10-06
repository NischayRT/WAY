'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import RealisticAvatar3D from './RealisticAvatar3D';
import { RotateCw } from 'lucide-react';
import MyDishesPanel from './../logging/MyDishesPanel';

// One body, two states, split top to bottom. The TARGET body fills the top
// `progress` share of the figure and the CURRENT body is the remainder below it,
// so the body itself reads as a progress bar toward the goal.
// The cut is a pair of horizontal world-space clipping planes (no extra
// geometry, and rotation-proof because the cut is on the vertical axis).
// With no target, only the current model is drawn.

const GROUP_Y = -0.95; // stage offset
const BODY_H = 2.0; // RealisticAvatar3D scales every body to 2.0 units tall, base at the stage origin
const BODY_BOTTOM = GROUP_Y;
const BODY_TOP = GROUP_Y + BODY_H;

function Stage({ currentData, targetData, progress, sway }) {
  const rotRef = useRef();
  const merged = !!targetData;

  // Shared plane objects: moving them needs no material rebuild.
  const keepAbove = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []); // target (top)
  const keepBelow = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []); // current (bottom)
  const abovePlanes = useMemo(() => [keepAbove], [keepAbove]);
  const belowPlanes = useMemo(() => [keepBelow], [keepBelow]);

  const p = Math.min(1, Math.max(0, progress));
  const splitY = BODY_TOP - BODY_H * p; // world y; p=0 -> top (no target), p=1 -> bottom (all target)
  keepAbove.constant = -splitY; // keeps y >= splitY
  keepBelow.constant = splitY; // keeps y <= splitY

  useFrame(({ clock }) => {
    if (!rotRef.current) return;
    rotRef.current.rotation.y = sway ? Math.sin(clock.elapsedTime * 0.7) * 0.55 : 0;
  });

  return (
    <group position={[0, GROUP_Y, 0]}>
      <group ref={rotRef}>
        {merged && (
          <RealisticAvatar3D
            sex={targetData.sex}
            heightCm={targetData.heightCm}
            weightKg={targetData.weightKg}
            chestCm={targetData.chestCm}
            waistCm={targetData.waistCm}
            hipCm={targetData.hipCm}
            bicepCm={targetData.bicepCm}
            bodyFatPct={targetData.bodyFatPct}
            color="#10b981"
            roughness={0.32}
            isTarget
            clippingPlanes={abovePlanes}
          />
        )}
        <RealisticAvatar3D
          sex={currentData.sex}
          heightCm={currentData.heightCm}
          weightKg={currentData.weightKg}
          chestCm={currentData.chestCm}
          waistCm={currentData.waistCm}
          hipCm={currentData.hipCm}
          bicepCm={currentData.bicepCm}
          bodyFatPct={currentData.bodyFatPct}
          color="#94a3b8"
          roughness={0.45}
          isTarget={false}
          clippingPlanes={merged ? belowPlanes : null}
        />
      </group>

      {/* Floor ring */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.44, 48]} />
        <meshBasicMaterial color={merged ? '#6ee7b7' : '#cbd5e1'} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>

      {/* Progress cut line (horizontal) */}
      {merged && p > 0.01 && p < 0.99 && (
        <mesh position={[0, BODY_H * (1 - p), 0.3]}>
          <planeGeometry args={[1.5, 0.008]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

export default function WeightBodyCanvas({ currentData, targetData = null, progress = 0, active = true }) {
  const [sway, setSway] = useState(true);
  const merged = !!targetData;

  return (
    <div className="relative h-[270px] w-full select-none sm:h-[340px]">
      {merged && (
        <>
          <span className="pointer-events-none absolute left-1 top-1 z-10 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Goal body
          </span>
          <span className="pointer-events-none absolute bottom-2 left-1 z-10 rounded-md bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Current body
          </span>
        </>
      )}
      <span>
        <a className="absolute bottom-2 right-14 z-10 p-2 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#14305a] bg-white dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] px-4 py-2 text-xs MyDishesPanel:text-sm font-medium text-slate-700 dark:text-slate-200 shadow-2xs transition-shadow hover:shadow-lg hover:bg-slate-50 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] disabled:opacity-50" href="/settings?tab=body">Change Goal</a>
      <button
        type="button"
        onClick={() => setSway((s) => !s)}
        title="Toggle motion"
        aria-label="Toggle motion"
        className={`absolute bottom-2 right-2 z-10 rounded-xl border p-2 text-xs shadow-xs transition ${
          sway
            ? 'border-slate-800 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
            : 'border-slate-200 bg-white/90 text-slate-500 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:text-white'
        }`}
      >
        <RotateCw size={14} />
      </button>
        </span>
      <Canvas
        // Stop rendering while the panel is collapsed.
        frameloop={active ? 'always' : 'never'}
        camera={{ position: [0, 0.1, 3.1], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
        className="h-full w-full"
      >
        <ambientLight intensity={0.95} />
        <directionalLight position={[4, 6, 4]} intensity={1.4} />
        <directionalLight position={[-4, 2, -2]} intensity={0.6} color="#ffffff" />
        <Suspense fallback={null}>
          <Stage currentData={currentData} targetData={targetData} progress={progress} sway={sway} />
        </Suspense>
      </Canvas>
    </div>
  );
}