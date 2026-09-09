'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function Avatar3D({
  chestCm = 99,
  waistCm = 86,
  hipCm = 93,
  bicepCm = 35,
  bodyFatPct = 15,
  isDream = false,
  autoRotate = true,
}) {
  const groupRef = useRef();

  // Slow ambient rotation
  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  // Convert real centimeters into 3D world scaling factors
  const chestScale = Math.max(0.75, chestCm / 98);
  const waistScale = Math.max(0.65, (waistCm / 86) * (1 + (bodyFatPct - 12) * 0.012));
  const hipScale = Math.max(0.70, (hipCm / 93) * (1 + (bodyFatPct - 12) * 0.008));
  const armScale = Math.max(0.70, bicepCm / 34);

  // High-tech shader palette
  const meshColor = isDream ? '#10b981' : '#38bdf8';
  const wireColor = isDream ? '#059669' : '#0284c7';

  return (
    <group ref={groupRef} position={[0, -1.8, 0]}>
      {/* --- HEAD & NECK --- */}
      <mesh position={[0, 3.8, 0]}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshStandardMaterial
          color={meshColor}
          metalness={0.4}
          roughness={0.3}
          wireframe={false}
        />
      </mesh>
      <mesh position={[0, 3.42, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.22, 20]} />
        <meshStandardMaterial color={meshColor} roughness={0.4} />
      </mesh>

      {/* --- UPPER TORSO / CHEST & LATS (V-TAPER DRIVER) --- */}
      <group position={[0, 2.95, 0]}>
        {/* Chest Plate / Rib Cage */}
        <mesh scale={[chestScale * 1.15, 1.0, chestScale * 0.85]}>
          <cylinderGeometry args={[0.48, 0.36, 0.72, 24]} />
          <meshStandardMaterial
            color={meshColor}
            metalness={0.3}
            roughness={0.25}
          />
        </mesh>
        {/* Shoulders / Clavicle Cross-Beam */}
        <mesh position={[0, 0.32, 0]} scale={[chestScale * 1.28, 0.8, 0.9]}>
          <boxGeometry args={[1.0, 0.16, 0.32]} />
          <meshStandardMaterial color={meshColor} roughness={0.3} />
        </mesh>
      </group>

      {/* --- MID-TORSO / WAIST (SHRINKS WITH FAT LOSS) --- */}
      <mesh
        position={[0, 2.32, 0]}
        scale={[waistScale * 0.85, 1.0, waistScale * 0.72]}
      >
        <cylinderGeometry args={[0.36, 0.33, 0.60, 24]} />
        <meshStandardMaterial
          color={meshColor}
          metalness={0.35}
          roughness={0.25}
        />
      </mesh>

      {/* --- PELVIS & HIPS --- */}
      <mesh
        position={[0, 1.84, 0]}
        scale={[hipScale * 0.92, 1.0, hipScale * 0.82]}
      >
        <cylinderGeometry args={[0.33, 0.39, 0.42, 24]} />
        <meshStandardMaterial color={meshColor} roughness={0.3} />
      </mesh>

      {/* --- LEFT ARM --- */}
      <group position={[-0.58 * chestScale, 3.2, 0]}>
        {/* Deltoid */}
        <mesh scale={[armScale, armScale, armScale]}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial color={meshColor} roughness={0.3} />
        </mesh>
        {/* Bicep / Tricep Upper Arm */}
        <mesh
          position={[-0.04, -0.42, 0]}
          rotation={[0, 0, 0.08]}
          scale={[armScale * 0.95, 1, armScale * 0.95]}
        >
          <capsuleGeometry args={[0.11, 0.42, 16, 16]} />
          <meshStandardMaterial color={meshColor} roughness={0.3} />
        </mesh>
        {/* Forearm */}
        <mesh position={[-0.08, -0.92, 0]} rotation={[0, 0, 0.05]}>
          <capsuleGeometry args={[0.09, 0.44, 16, 16]} />
          <meshStandardMaterial color={wireColor} roughness={0.4} />
        </mesh>
      </group>

      {/* --- RIGHT ARM --- */}
      <group position={[0.58 * chestScale, 3.2, 0]}>
        {/* Deltoid */}
        <mesh scale={[armScale, armScale, armScale]}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial color={meshColor} roughness={0.3} />
        </mesh>
        {/* Bicep / Tricep Upper Arm */}
        <mesh
          position={[0.04, -0.42, 0]}
          rotation={[0, 0, -0.08]}
          scale={[armScale * 0.95, 1, armScale * 0.95]}
        >
          <capsuleGeometry args={[0.11, 0.42, 16, 16]} />
          <meshStandardMaterial color={meshColor} roughness={0.3} />
        </mesh>
        {/* Forearm */}
        <mesh position={[0.08, -0.92, 0]} rotation={[0, 0, -0.05]}>
          <capsuleGeometry args={[0.09, 0.44, 16, 16]} />
          <meshStandardMaterial color={wireColor} roughness={0.4} />
        </mesh>
      </group>

      {/* --- LEGS --- */}
      {/* Left Thigh & Shin */}
      <group position={[-0.23 * hipScale, 1.6, 0]}>
        <mesh position={[0, -0.48, 0]}>
          <capsuleGeometry args={[0.16 * hipScale, 0.62, 16, 16]} />
          <meshStandardMaterial color={meshColor} roughness={0.3} />
        </mesh>
        <mesh position={[0, -1.22, 0]}>
          <capsuleGeometry args={[0.11, 0.65, 16, 16]} />
          <meshStandardMaterial color={wireColor} roughness={0.4} />
        </mesh>
      </group>

      {/* Right Thigh & Shin */}
      <group position={[0.23 * hipScale, 1.6, 0]}>
        <mesh position={[0, -0.48, 0]}>
          <capsuleGeometry args={[0.16 * hipScale, 0.62, 16, 16]} />
          <meshStandardMaterial color={meshColor} roughness={0.3} />
        </mesh>
        <mesh position={[0, -1.22, 0]}>
          <capsuleGeometry args={[0.11, 0.65, 16, 16]} />
          <meshStandardMaterial color={wireColor} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}