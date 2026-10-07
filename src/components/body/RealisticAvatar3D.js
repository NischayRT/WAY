'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { resolveCurrentPhysique, CURRENT_ARCHETYPES } from '@/lib/currentPhysiqueLogic';
import { resolveTargetPhysique } from '@/lib/targetPhysiqueLogic';
import { bodyModelUrl, FEMALE_MESH_PROPORTIONS } from '@/lib/bodyModels';

export default function RealisticAvatar3D({
  sex = 'male',
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
  isTarget = false, // false = Current model, true = Target model
  clippingPlanes = null, // optional stable array of THREE.Plane (used by the home progress preview)
  archetypeKey = null, // optional: show this body type as modelled ('SLIM', 'LEAN', ...), no measurement scaling (landing page showcase)
}) {
  // Male and female files have the same five bodies in the same slots,
  // so everything below works the same for both.
  const modelUrl = bodyModelUrl(sex);
  const { scene } = useGLTF(modelUrl);

  const physiqueConfig = useMemo(() => {
    if (archetypeKey && CURRENT_ARCHETYPES[archetypeKey]) return CURRENT_ARCHETYPES[archetypeKey];
    const input = { sex, bodyFatPct, weightKg, heightCm, chestCm, waistCm, hipCm };
    return isTarget ? resolveTargetPhysique(input) : resolveCurrentPhysique(input);
  }, [archetypeKey, isTarget, sex, chestCm, waistCm, hipCm, heightCm, weightKg, bodyFatPct]);

  const slot = archetypeKey ? physiqueConfig.fallbackIndex : isTarget ? physiqueConfig.meshIndex : physiqueConfig.fallbackIndex;

  const singleMesh = useMemo(() => {
    // Picked by position: GLTFLoader strips dots from node names, so the
    // old name match ('guy.004') never worked. See lib/bodyModels.js.
    const meshes = [];
    scene.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
    const targetMesh = meshes[slot] || meshes[0];
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
      clippingPlanes: clippingPlanes || null,
    });

    const mesh = new THREE.Mesh(geom, material);

    if (archetypeKey) {
      // Showcase: the body exactly as modelled.
      mesh.scale.setScalar(scaleFactor);
      mesh.position.set(0, 1.0, 0);
      return mesh;
    }

    if (sex === 'female') {
      // The female bodies already carry their shape (bust, waist, hips,
      // belly), so they are only nudged by how far the user's own waist and
      // hips differ from that body's measured proportions. Kept within
      // ±10–12% so a body never stops looking like its type.
      const ref = FEMALE_MESH_PROPORTIONS[slot] || FEMALE_MESH_PROPORTIONS[0];
      const h = Number(heightCm) || 162;
      const clampF = (v) => Math.max(0.9, Math.min(1.12, Number.isFinite(v) ? v : 1));
      const fWaist = clampF(Number(waistCm) / h / ref.waistToHeight);
      const fHip = clampF(Number(hipCm) / h / ref.hipToHeight);
      mesh.scale.set(scaleFactor * ((fWaist + fHip) / 2), scaleFactor, scaleFactor * (0.6 * fWaist + 0.4 * fHip));
      mesh.position.set(0, 1.0, 0);
      return mesh;
    }

    // Reference circumferences as a fraction of height. Waist ~0.45 h and
    // chest/bust ~0.55 h are typical adult values for both sexes (women's
    // bust measurement sits close to men's chest relative to height; the
    // female mesh itself already carries the narrower waist and wider hips).
    const idealWaist = Number(heightCm) * (isTarget ? 0.44 : 0.45);
    const idealChest = Number(heightCm) * 0.55;

    if (isTarget) {
      const measuredWRatio = Math.max(0.88, Math.min(1.18, Number(waistCm) / idealWaist));
      const measuredCRatio = Math.max(0.88, Math.min(1.18, Number(chestCm) / idealChest));
      const boost = physiqueConfig.visualBoost;
      const wRatio = measuredWRatio * boost.waist;
      const cRatio = measuredCRatio * boost.chest;
      mesh.scale.set(scaleFactor * ((wRatio + cRatio) / 2) * boost.arm, scaleFactor, scaleFactor * wRatio);
    } else {
      const boost = physiqueConfig.scaleBoost;
      const userWRatio = Math.max(0.75, Math.min(1.4, Number(waistCm) / idealWaist));
      const userCRatio = Math.max(0.75, Math.min(1.4, Number(chestCm) / idealChest));
      mesh.scale.set(
        scaleFactor * ((userCRatio * 0.6 + userWRatio * 0.4) * boost.x),
        scaleFactor,
        scaleFactor * (userWRatio * boost.z)
      );
    }

    mesh.position.set(0, 1.0, 0);
    return mesh;
  }, [scene, slot, sex, archetypeKey, physiqueConfig, color, roughness, wireframe, heightCm, waistCm, chestCm, hipCm, isTarget, clippingPlanes]);

  if (!singleMesh) return null;

  return (
    <primitive
      object={singleMesh}
      key={`${modelUrl}-${isTarget ? 'target' : 'current'}-${physiqueConfig.key}-${Math.round(waistCm)}-${Math.round(chestCm)}-${Math.round(hipCm)}`}
    />
  );
}

// No module-level preload: each user only downloads the model for their
// own sex. Callers warm it with prefetchBodyModel(sex) from lib/bodyModels.
