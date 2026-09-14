'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { resolveCurrentPhysique } from '@/lib/currentPhysiqueLogic';
import { resolveTargetPhysique } from '@/lib/targetPhysiqueLogic';

export default function RealisticAvatar3D({
  heightCm = 176.5,
  weightKg = 78,
  chestCm = 99,
  waistCm = 86,
  hipCm = 93,
  bicepCm = 35,
  bodyFatPct = 16,
  color = '#94a3b8',
  roughness = 0.4,
  wireframe = false,
  isTarget = false, // false = Current model (uses new logic), true = Target model (unchanged)
}) {
  const { scene } = useGLTF('/models/stylized_male_base_mesh_free.glb');

  // Compute model profile using the respective separate logic file
  const physiqueConfig = useMemo(() => {
    if (isTarget) {
      return resolveTargetPhysique({ bodyFatPct, weightKg, heightCm, chestCm, waistCm });
    }
    return resolveCurrentPhysique({ chestCm, waistCm, heightCm, weightKg, bodyFatPct });
  }, [isTarget, chestCm, waistCm, heightCm, weightKg, bodyFatPct]);

  const singleMesh = useMemo(() => {
    const meshes = [];
    let matchedMesh = null;

    scene.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
        const nameLower = (child.name || '').toLowerCase();
        if (physiqueConfig.meshKey && nameLower.includes(physiqueConfig.meshKey)) {
          matchedMesh = child;
        }
      }
    });

    // Fallback if name-matching misses
    const targetMesh =
      matchedMesh ||
      (physiqueConfig.fallbackIndex != null ? meshes[physiqueConfig.fallbackIndex] : null) ||
      (physiqueConfig.meshIndex != null ? meshes[physiqueConfig.meshIndex] : null) ||
      meshes[0];

    if (!targetMesh) return null;

    const geom = targetMesh.geometry.clone();
    geom.center();
    geom.computeVertexNormals();
    geom.computeBoundingBox();

    const size = geom.boundingBox.getSize(new THREE.Vector3());
    const scaleFactor = 2.0 / (size.y || 1);

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.08,
      wireframe,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, material);

    if (isTarget) {
      // TARGET MODEL SCALING (Untouched original behavior)
      const idealWaist = Number(heightCm) * 0.44;
      const idealChest = Number(heightCm) * 0.55;
      const measuredWRatio = Math.max(0.88, Math.min(1.18, Number(waistCm) / idealWaist));
      const measuredCRatio = Math.max(0.88, Math.min(1.18, Number(chestCm) / idealChest));
      const boost = physiqueConfig.visualBoost;
      const wRatio = measuredWRatio * boost.waist;
      const cRatio = measuredCRatio * boost.chest;
      const armFactor = boost.arm;

      mesh.scale.set(
        scaleFactor * ((wRatio + cRatio) / 2) * armFactor,
        scaleFactor,
        scaleFactor * wRatio
      );
    } else {
      // CURRENT MODEL SCALING (Dynamically driven by chest & waist deltas)
      const boost = physiqueConfig.scaleBoost;
      const idealWaist = Number(heightCm) * 0.45;
      const idealChest = Number(heightCm) * 0.55;
      const userWRatio = Math.max(0.75, Math.min(1.40, Number(waistCm) / idealWaist));
      const userCRatio = Math.max(0.75, Math.min(1.40, Number(chestCm) / idealChest));

      const scaleX = scaleFactor * ((userCRatio * 0.6 + userWRatio * 0.4) * boost.x);
      const scaleY = scaleFactor;
      const scaleZ = scaleFactor * (userWRatio * boost.z);

      mesh.scale.set(scaleX, scaleY, scaleZ);
    }

    mesh.position.set(0, 1.0, 0);
    return mesh;
  }, [scene, physiqueConfig, color, roughness, wireframe, heightCm, waistCm, chestCm, isTarget]);

  if (!singleMesh) return null;

  return (
    <primitive
      object={singleMesh}
      key={`${isTarget ? 'target' : 'current'}-${physiqueConfig.meshKey}-${Math.round(waistCm)}-${Math.round(chestCm)}`}
    />
  );
}

if (typeof window !== 'undefined') {
  useGLTF.preload('/models/stylized_male_base_mesh_free.glb');
}