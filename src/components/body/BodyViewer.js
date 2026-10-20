'use client';

import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import Canvas from '@/components/body/SafeCanvas';
import RealisticAvatar3D from './RealisticAvatar3D';
import SplitSlice from './SplitSlice';

// Bodies are 2 units tall standing on y = 0; the stage lifts them so the
// figure is centred on the origin (top at +1, feet at -1).
const STAGE_Y = -1;
const TOP = 1;
const H = 2;
// Side by side: each body's arms reach ~0.72 from its centre, so this leaves a clear gap.
const SIDE_X = 0.9;

function Tag({ y, tone, children }) {
  const goal = tone === 'goal';
  return (
    <Html position={[-0.08, y, 0.15]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="flex -translate-x-full -translate-y-1/2 items-center whitespace-nowrap">
        <span
          className="rounded-md border px-2 py-1 font-heading text-[10px] font-bold uppercase tracking-[0.1em] md:text-[11px]"
          style={
            goal
              ? { background: 'rgba(6,78,59,.9)', color: '#6ee7b7', borderColor: '#065f46' }
              : { background: 'rgba(15,23,42,.9)', color: '#cbd5e1', borderColor: '#334155' }
          }
        >
          {children}
        </span>
        <span className="h-px w-8 md:w-16" style={{ background: goal ? '#34d399' : '#94a3b8' }} />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: goal ? '#34d399' : '#94a3b8' }} />
      </div>
    </Html>
  );
}

function Stage({ currentData, targetData, mode, progress, sway, yaw, dragging }) {
  const goalRef = useRef();
  const curRef = useRef();
  const side = mode === 'side' && !!targetData;
  const p = targetData && !side ? Math.min(1, Math.max(0, progress)) : 0;
  const splitY = TOP - H * p;

  const keepAbove = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const keepBelow = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  const above = useMemo(() => [keepAbove], [keepAbove]);
  const below = useMemo(() => [keepBelow], [keepBelow]);

  // three.js objects are mutable by design: the cut planes and the bodies'
  // rotation are moved every frame, outside React's render.
  /* eslint-disable react-hooks/immutability */
  useFrame(({ clock, camera, size }) => {
    keepAbove.constant = side ? 1e3 : -splitY;
    keepBelow.constant = side ? 1e3 : splitY;
    const rot = yaw.current + (sway && !dragging.current ? Math.sin(clock.elapsedTime * 0.7) * 0.55 : 0);
    if (goalRef.current) goalRef.current.rotation.y = rot;
    if (curRef.current) curRef.current.rotation.y = rot;
    // Side by side: pull back until both bodies (about 3.4 units wide with
    // the gap) fit the canvas width, and never closer than a comfortable view.
    const fit = 1.75 / (Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.3, size.width / Math.max(1, size.height)));
    const z = side ? Math.max(6, fit) : 4.45;
    if (Math.abs(camera.position.z - z) > 0.001) {
      camera.position.z += (z - camera.position.z) * 0.15;
      camera.updateProjectionMatrix();
    }
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <group position={[0, STAGE_Y, 0]}>
        {targetData ? (
          <group position={[side ? SIDE_X : 0, 0, 0]}>
            <group ref={goalRef}>
              <RealisticAvatar3D {...targetData} color="#10b981" roughness={0.32} isTarget clippingPlanes={above} />
            </group>
            <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.36, 0.44, 48]} />
              <meshBasicMaterial color="#6ee7b7" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ) : null}
        <group position={[side ? -SIDE_X : 0, 0, 0]}>
          <group ref={curRef}>
            <RealisticAvatar3D {...currentData} color="#94a3b8" roughness={0.45} isTarget={false} clippingPlanes={targetData && !side ? below : null} />
          </group>
          {side || !targetData ? (
            <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.36, 0.44, 48]} />
              <meshBasicMaterial color={side ? '#94a3b8' : '#6ee7b7'} transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
          ) : null}
        </group>
      </group>
      {targetData && !side && p > 0.01 && p < 0.99 ? (
        <SplitSlice y={splitY} />
      ) : null}
      {targetData && !side && p > 0.03 ? <Tag y={(TOP + splitY) / 2} tone="goal">Goal body</Tag> : null}
      {targetData && !side && p < 0.97 ? <Tag y={(splitY - 1) / 2} tone="current">Current body</Tag> : null}
      {targetData && !side ? (
        <Html position={[0.42, splitY, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="block -translate-y-[130%] whitespace-nowrap font-mono text-[11px] font-semibold text-emerald-300 md:text-xs">
            {Math.round(p * 100)}% there
          </span>
        </Html>
      ) : null}
    </>
  );
}

/**
 * The current and goal bodies, split at your progress (goal on top) or side
 * by side. Drag to rotate; `sway` adds a gentle turn.
 */
export default function BodyViewer({ currentData, targetData, mode = 'split', progress = 0, sway = true }) {
  const yaw = useRef(0);
  const dragging = useRef(null);

  const onDown = (e) => {
    dragging.current = { x: e.clientX, yaw: yaw.current };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
  };
  const onMove = (e) => {
    if (dragging.current) yaw.current = dragging.current.yaw + (e.clientX - dragging.current.x) * 0.012;
  };
  const onUp = (e) => {
    dragging.current = null;
    e.currentTarget.style.cursor = '';
  };

  return (
    <div
      className="absolute inset-0 cursor-grab touch-none select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <Canvas
        camera={{ position: [0, 0.02, 4.45], fov: 32 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
        className="h-full w-full"
      >
        <ambientLight intensity={0.95} />
        <directionalLight position={[4, 6, 4]} intensity={1.4} />
        <directionalLight position={[-4, 2, -2]} intensity={0.6} />
        <Suspense
          fallback={
            <Html center>
              <span className="whitespace-nowrap font-mono text-[11px] text-way-dim">Loading 3D bodies…</span>
            </Html>
          }
        >
          <Stage
            currentData={currentData}
            targetData={targetData}
            mode={mode}
            progress={progress}
            sway={sway}
            yaw={yaw}
            dragging={dragging}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
