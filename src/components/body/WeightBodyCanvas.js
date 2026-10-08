'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import Canvas from '@/components/body/SafeCanvas';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCw } from 'lucide-react';
import RealisticAvatar3D from './RealisticAvatar3D';

// One body, two states, split top to bottom. The TARGET body fills the top
// `progress` share of the figure and the CURRENT body is the remainder below
// it, so the body itself reads as a progress bar toward the goal.
// The cut is a pair of horizontal world-space clipping planes, so it stays
// level while the body sways. With no target, only the current model is drawn.

const GROUP_Y = -0.95; // stage offset
const BODY_H = 2.0; // RealisticAvatar3D scales every body to 2.0 units tall, base at the stage origin
const BODY_BOTTOM = GROUP_Y;
const BODY_TOP = GROUP_Y + BODY_H;

/**
 * Label with a leader line. The <Html> anchor is the point on the body it
 * points at; the pill sits to the left and the line runs from the pill to a
 * dot on that point. Anchored in 3D, so it tracks the cut as progress moves.
 */
function BodyTag({ position, tone, children }) {
  const goal = tone === 'goal';
  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="flex -translate-x-full -translate-y-1/2 items-center whitespace-nowrap">
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ring-1 ${
            goal
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-300 dark:ring-emerald-800'
              : 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:ring-slate-700'
          }`}
        >
          {children}
        </span>
        <span className={`h-px w-10 sm:w-14 ${goal ? 'bg-emerald-400' : 'bg-slate-400'}`} />
        <span
          className={`h-2 w-2 rounded-full ring-2 ${
            goal ? 'bg-emerald-400 ring-emerald-400/30' : 'bg-slate-300 ring-slate-400/30'
          }`}
        />
      </div>
    </Html>
  );
}

function Stage({ currentData, targetData, progress, sway }) {
  const rotRef = useRef();
  const merged = !!targetData;

  // Shared plane objects: moving them needs no material rebuild.
  const keepAbove = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []); // target (top)
  const keepBelow = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []); // current (bottom)
  const abovePlanes = useMemo(() => [keepAbove], [keepAbove]);
  const belowPlanes = useMemo(() => [keepBelow], [keepBelow]);

  const p = merged ? Math.min(1, Math.max(0, progress)) : 0;
  const splitY = BODY_TOP - BODY_H * p; // world y; p=0 -> top (no target), p=1 -> bottom (all target)
  keepAbove.constant = -splitY; // keeps y >= splitY
  keepBelow.constant = splitY; // keeps y <= splitY

  // Where each label points: the middle of its part of the body (world y).
  // Goal points at the centre line; current points a little left so the dot
  // lands on the hip or thigh rather than in the gap between the legs.
  const goalMidY = (BODY_TOP + splitY) / 2;
  const currentMidY = (splitY + BODY_BOTTOM) / 2;
  const showGoalTag = merged && p > 0.03;
  const showCurrentTag = merged && p < 0.97;

  useFrame(({ clock }) => {
    if (!rotRef.current) return;
    rotRef.current.rotation.y = sway ? Math.sin(clock.elapsedTime * 0.7) * 0.55 : 0;
  });

  return (
    <>
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
      </group>

      {/* Boundary: a thin band wrapped round the body at exactly the cut
          height (world y = splitY). The old marker was a flat bar 0.3 units
          in front of the body, which perspective drew above the real
          colour change. Depth-tested, so its back half hides behind the body. */}
      {merged && p > 0.01 && p < 0.99 && (
        <mesh position={[0, splitY, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.78, 0.28, 1]}>
          <torusGeometry args={[1, 0.011, 8, 128]} />
          <meshBasicMaterial color="#6ee7b7" />
        </mesh>
      )}

      {showGoalTag && (
        <BodyTag position={[-0.02, goalMidY, 0.15]} tone="goal">
          Goal body
        </BodyTag>
      )}
      {showCurrentTag && (
        <BodyTag position={[-0.1, currentMidY, 0.12]} tone="current">
          Current body
        </BodyTag>
      )}
    </>
  );
}

export default function WeightBodyCanvas({ currentData, targetData = null, progress = 0, active = true }) {
  const [sway, setSway] = useState(true);

  return (
    <div className="relative h-[300px] w-full select-none sm:h-[360px]">
      <div className="absolute bottom-2 right-2 z-30 flex items-center gap-2">
        <a
          href="/settings?tab=body"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-lg active:scale-[0.98] dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
        >
          Change goal
        </a>
        <button
          type="button"
          onClick={() => setSway((s) => !s)}
          title="Toggle motion"
          aria-label="Toggle motion"
          aria-pressed={sway}
          className={`rounded-xl border p-2 text-xs shadow-xs transition ${
            sway
              ? 'border-slate-800 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
              : 'border-slate-200 bg-white/90 text-slate-500 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <RotateCw size={14} />
        </button>
      </div>
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
