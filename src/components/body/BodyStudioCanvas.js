'use client';

import { Suspense, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import RealisticAvatar3D from './RealisticAvatar3D';
import { RotateCw, Eye } from 'lucide-react';

// Each avatar gets its own fixed-position wrapper containing its own
// independent rotation group, so they spin in place on their own base
// rather than orbiting a shared midpoint.
// components/body/BodyStudioCanvas.js

function StageModels({ currentData, targetData, autoRotate, wireframe }) {
  return (
    <group position={[0, -0.95, 0]}>
      {/* Current Model - Uses currentPhysiqueLogic.js */}
      <SingleAvatarStage
        data={currentData}
        color="#94a3b8"
        roughness={0.45}
        wireframe={wireframe}
        positionX={-0.85}
        autoRotate={autoRotate}
        ringColor="#cbd5e1"
        ringOpacity={0.5}
        isTarget={false}
      />
      {/* Target Model - Absolute & unchanged (uses targetPhysiqueLogic.js) */}
      <SingleAvatarStage
        data={targetData}
        color="#10b981"
        roughness={0.32}
        wireframe={wireframe}
        positionX={0.85}
        autoRotate={autoRotate}
        ringColor="#6ee7b7"
        ringOpacity={0.65}
        isTarget={true}
      />
    </group>
  );
}

function SingleAvatarStage({
  data,
  color,
  roughness,
  wireframe,
  positionX,
  autoRotate,
  ringColor,
  ringOpacity,
  isTarget,
}) {
  const rotationRef = useRef();
  useFrame((_, delta) => {
    if (autoRotate && rotationRef.current) {
      rotationRef.current.rotation.y += delta * 0.35;
    }
  });

  return (
    <group position={[positionX, 0, 0]}>
      <group ref={rotationRef}>
        <RealisticAvatar3D
          heightCm={data.heightCm}
          weightKg={data.weightKg}
          chestCm={data.chestCm}
          waistCm={data.waistCm}
          hipCm={data.hipCm}
          bicepCm={data.bicepCm}
          bodyFatPct={data.bodyFatPct}
          color={color}
          roughness={roughness}
          wireframe={wireframe}
          isTarget={isTarget}
        />
      </group>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.44, 48]} />
        <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
export default function BodyStudioCanvas({ currentData, targetData }) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  return (
    <div className="relative w-full overflow-hidden select-none">
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setWireframe((w) => !w)}
          className={`p-2 rounded-xl border text-xs shadow-xs transition ${
            wireframe
              ? 'border-sky-400 dark:border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
              : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Toggle wireframe"
        >
          <Eye size={14} />
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((r) => !r)}
          className={`p-2 rounded-xl border text-xs shadow-xs transition ${
            autoRotate
              ? 'border-slate-800 dark:border-slate-200 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
              : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Toggle rotation"
        >
          <RotateCw size={14} />
        </button>
      </div>

      <div className="w-full grid grid-cols-2 px-4 pt-2 z-10 gap-2">
        <div className="flex flex-col text-left min-w-0">
          <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Now
          </span>
          <span className="font-numeric text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 truncate">
            {currentData.weightKg} kg · {currentData.bodyFatPct}% fat
          </span>
        </div>

        <div className="flex flex-col text-right min-w-0 pr-16 sm:pr-20">
          <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Goal
          </span>
          <span className="font-numeric text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
            {targetData.weightKg} kg · {targetData.bodyFatPct}% fat
          </span>
        </div>
      </div>

      <div className="w-full h-[320px] sm:h-[420px] cursor-grab active:cursor-grabbing">
        <Canvas
          camera={{ position: [0, 0.1, 3.4], fov: 42 }}
          gl={{ alpha: true, antialias: true }}
          className="w-full h-full"
        >
          <ambientLight intensity={0.95} />
          <directionalLight position={[4, 6, 4]} intensity={1.4} />
          <directionalLight position={[-4, 2, -2]} intensity={0.6} color="#ffffff" />

          <Suspense fallback={null}>
            <StageModels
              currentData={currentData}
              targetData={targetData}
              autoRotate={autoRotate}
              wireframe={wireframe}
            />
          </Suspense>

          <OrbitControls
            target={[0, 0, 0]}
            enablePan={false}
            enableZoom={true}
            minDistance={2.0}
            maxDistance={5.2}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.7}
          />
        </Canvas>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-2.5 pb-1 text-center font-numeric text-xs">
        <div className="text-slate-500 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">{Math.round(currentData.waistCm / 2.54)}&quot;</span> waist ·{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">{Math.round(currentData.hipCm / 2.54)}&quot;</span> hips
        </div>
        <div className="text-emerald-600 dark:text-emerald-400">
          <span className="font-bold text-emerald-700 dark:text-emerald-300">{Math.round(targetData.waistCm / 2.54)}&quot;</span> waist ·{' '}
          <span className="font-bold text-emerald-700 dark:text-emerald-300">{Math.round(targetData.hipCm / 2.54)}&quot;</span> hips
        </div>
      </div>
    </div>
  );
}