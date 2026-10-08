'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Canvas from '@/components/body/SafeCanvas';
import RealisticAvatar3D from '@/components/body/RealisticAvatar3D';

const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

function SpinningBody({ sex, archetypeKey, onReady }) {
  const group = useRef();
  const pop = useRef(1);

  // Restart the little "pop" whenever the body changes.
  useEffect(() => {
    pop.current = 0;
  }, [sex, archetypeKey]);

  // Rendering this component means the GLB has loaded (useGLTF suspends).
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.55;
    pop.current = Math.min(1, pop.current + dt * 2.6);
    group.current.scale.setScalar(0.86 + 0.14 * easeOutBack(pop.current));
  });

  return (
    <group ref={group}>
      <RealisticAvatar3D sex={sex} archetypeKey={archetypeKey} color="#eef2f8" roughness={0.42} />
    </group>
  );
}

export default function BodyShowcaseCanvas({ sex, archetypeKey, onReady }) {
  return (
    <Canvas camera={{ position: [0, 0.12, 3.35], fov: 40 }} gl={{ alpha: true, antialias: true }} dpr={[1, 1.75]}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 4]} intensity={1.55} />
      <directionalLight position={[-4, 1.5, -3]} intensity={0.9} color="#ffd59e" />
      <group position={[0, -1.02, 0]}>
        <Suspense fallback={null}>
          <SpinningBody sex={sex} archetypeKey={archetypeKey} onReady={onReady} />
        </Suspense>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
          <ringGeometry args={[0.36, 0.46, 64]} />
          <meshBasicMaterial color="#f6b40e" transparent opacity={0.9} />
        </mesh>
      </group>
    </Canvas>
  );
}
