'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import Canvas from '@/components/body/SafeCanvas';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCw } from 'lucide-react';
import RealisticAvatar3D from './RealisticAvatar3D';

// One body, two states, split top to bottom. The GOAL body fills the top
// `progress` share of the figure and the CURRENT body is the remainder below
// it, so the body itself reads as a progress bar toward the goal.
// The cut is a pair of horizontal world-space clipping planes, so it stays
// level while the body sways. With no target, only the current model is drawn.

const GROUP_Y = -0.95; // stage offset
const BODY_H = 2.0; // RealisticAvatar3D scales every body to 2.0 units tall, base at the stage origin
const BODY_BOTTOM = GROUP_Y;
const BODY_TOP = GROUP_Y + BODY_H;

/** Pill label with a leader line to a dot on the body; anchored in 3D so it tracks the cut. */
function BodyTag({ position, tone, children }) {
  const goal = tone === 'goal';
  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="flex -translate-x-full -translate-y-1/2 items-center whitespace-nowrap">
        <span
          className="rounded-md border px-[7px] py-[3px] font-heading text-[10px] font-bold uppercase tracking-[0.1em]"
          style={
            goal
              ? { background: 'rgba(6,78,59,.9)', color: '#6ee7b7', borderColor: '#065f46' }
              : { background: 'rgba(15,23,42,.9)', color: '#cbd5e1', borderColor: '#334155' }
          }
        >
          {children}
        </span>
        <span className="h-px w-7 sm:w-9" style={{ background: goal ? '#34d399' : '#94a3b8' }} />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: goal ? '#34d399' : '#94a3b8' }} />
      </div>
    </Html>
  );
}

function Stage({ currentData, targetData, progress, sway, pctLabel }) {
  const rotRef = useRef();
  const merged = !!targetData;

  // Shared plane objects: moving them needs no material rebuild.
  const keepAbove = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []); // goal (top)
  const keepBelow = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []); // current (bottom)
  const abovePlanes = useMemo(() => [keepAbove], [keepAbove]);
  const belowPlanes = useMemo(() => [keepBelow], [keepBelow]);

  const p = merged ? Math.min(1, Math.max(0, progress)) : 0;
  const splitY = BODY_TOP - BODY_H * p; // p=0 -> top (no goal yet), p=1 -> bottom (all goal)

  const goalMidY = (BODY_TOP + splitY) / 2;
  const currentMidY = (splitY + BODY_BOTTOM) / 2;
  const showGoalTag = merged && p > 0.03;
  const showCurrentTag = merged && p < 0.97;

  // three.js objects are mutable by design: the planes and the body's rotation
  // are moved every frame, outside React's render.
  /* eslint-disable react-hooks/immutability */
  useFrame(({ clock }) => {
    keepAbove.constant = -splitY;
    keepBelow.constant = splitY;
    if (!rotRef.current) return;
    rotRef.current.rotation.y = sway ? Math.sin(clock.elapsedTime * 0.7) * 0.55 : 0;
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <group position={[0, GROUP_Y, 0]}>
        <group ref={rotRef}>
          {merged && (
            <RealisticAvatar3D {...targetData} color="#10b981" roughness={0.32} isTarget clippingPlanes={abovePlanes} />
          )}
          <RealisticAvatar3D
            {...currentData}
            color="#94a3b8"
            roughness={0.45}
            isTarget={false}
            clippingPlanes={merged ? belowPlanes : null}
          />
        </group>
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.36, 0.44, 48]} />
          <meshBasicMaterial color="#6ee7b7" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* The cut: a thin band wrapped round the body at exactly the split height. */}
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
      {merged && pctLabel ? (
        <Html position={[0.55, splitY, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="block -translate-y-[130%] whitespace-nowrap font-mono text-[11px] font-semibold text-emerald-300">{pctLabel}</span>
        </Html>
      ) : null}
    </>
  );
}

export default function WeightBodyCanvas({ currentData, targetData = null, progress = 0, active = true, height = 300, pctLabel = null }) {
  const [sway, setSway] = useState(true);

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <button
        type="button"
        onClick={() => setSway((s) => !s)}
        title="Toggle motion"
        aria-label="Toggle motion"
        aria-pressed={sway}
        className={`absolute bottom-2.5 right-2.5 z-30 flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors ${
          sway ? 'border-way-ink bg-way-ink text-way-page' : 'border-way-line2 bg-transparent text-way-mute hover:text-way-ink'
        }`}
      >
        <RotateCw size={14} />
      </button>
      <Canvas
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
          <Stage currentData={currentData} targetData={targetData} progress={progress} sway={sway} pctLabel={pctLabel} />
        </Suspense>
      </Canvas>
    </div>
  );
}
