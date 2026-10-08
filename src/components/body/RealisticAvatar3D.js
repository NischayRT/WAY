'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { resolveCurrentPhysique, CURRENT_ARCHETYPES } from '@/lib/currentPhysiqueLogic';
import { resolveTargetPhysique } from '@/lib/targetPhysiqueLogic';
import { bodyUrl, selectBody, showcaseBody } from '@/lib/bodyLibrary';
import { analyzeBody, measurementFactors, deformBody } from '@/lib/bodyDeform';

// Each body mesh is measured once (its own chest, waist, hips and upper arm),
// then reused for every reshape. Keyed by the source geometry.
const analysisCache = new WeakMap();

function readPositions(geometry) {
  const attr = geometry.attributes.position;
  const out = new Float32Array(attr.count * 3);
  for (let i = 0; i < attr.count; i += 1) {
    out[i * 3] = attr.getX(i);
    out[i * 3 + 1] = attr.getY(i);
    out[i * 3 + 2] = attr.getZ(i);
  }
  return out;
}

function getAnalysis(geometry, sex) {
  let entry = analysisCache.get(geometry);
  if (!entry || entry.sex !== sex) {
    const base = readPositions(geometry);
    entry = { sex, base, analysis: analyzeBody(base, { sex }) };
    analysisCache.set(geometry, entry);
  }
  return entry;
}

/**
 * One body, chosen and lightly shaped from the person's numbers:
 *  1. Body TYPE from body fat, FFMI and waist-to-height
 *     (lib/physiqueClassifier.js via current/targetPhysiqueLogic).
 *  2. Which BODY: the library body (lib/bodyLibrary.js, 7 male / 13 female)
 *     whose own chest, waist, hip and upper-arm proportions are closest to
 *     the person's, preferring bodies tagged for their type.
 *  3. A light FINE-TUNE from the same four measurements (lib/bodyDeform.js),
 *     limited to +/-6% per region so the body stays true to its source model.
 */
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
  archetypeKey = null, // optional: show this body type as modelled ('SLIM', 'LEAN', ...), no reshaping (landing page showcase)
}) {
  const physiqueConfig = useMemo(() => {
    if (archetypeKey && CURRENT_ARCHETYPES[archetypeKey]) return CURRENT_ARCHETYPES[archetypeKey];
    const input = { sex, bodyFatPct, weightKg, heightCm, chestCm, waistCm, hipCm };
    return isTarget ? resolveTargetPhysique(input) : resolveCurrentPhysique(input);
  }, [archetypeKey, isTarget, sex, chestCm, waistCm, hipCm, heightCm, weightKg, bodyFatPct]);

  const body = useMemo(
    () =>
      archetypeKey
        ? showcaseBody(sex, archetypeKey)
        : selectBody({ sex, typeKey: physiqueConfig.key, heightCm, chestCm, waistCm, hipCm, bicepCm }),
    [archetypeKey, sex, physiqueConfig.key, heightCm, chestCm, waistCm, hipCm, bicepCm]
  );

  // Each body is its own small file; only the one on screen is downloaded.
  const { scene } = useGLTF(bodyUrl(body.id));

  const sourceGeometry = useMemo(() => {
    let geometry = null;
    scene.traverse((child) => {
      if (!geometry && child.isMesh) geometry = child.geometry;
    });
    return geometry;
  }, [scene]);

  const geometry = useMemo(() => {
    if (!sourceGeometry) return null;
    const geom = sourceGeometry.clone();

    if (!archetypeKey) {
      const { base, analysis } = getAnalysis(sourceGeometry, sex);
      const factors = measurementFactors(
        analysis,
        { heightCm, chestCm, waistCm, hipCm, bicepCm },
        undefined,
        body.refs
      );
      const shaped = deformBody(base, analysis, factors);
      geom.setAttribute('position', new THREE.BufferAttribute(shaped, 3));
    }

    geom.center();
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    return geom;
  }, [sourceGeometry, archetypeKey, sex, body, heightCm, chestCm, waistCm, hipCm, bicepCm]);

  // Free GPU memory for reshaped copies as they are replaced.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: 0.08,
        wireframe,
        side: THREE.DoubleSide,
        clippingPlanes: clippingPlanes || null,
      }),
    [color, roughness, wireframe, clippingPlanes]
  );
  useEffect(() => () => material.dispose(), [material]);

  if (!geometry) return null;

  // Every body is drawn 2.0 units tall, standing on y = 0.
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const scaleFactor = 2.0 / (size.y || 1);

  return (
    <mesh geometry={geometry} material={material} scale={scaleFactor} position={[0, 1.0, 0]} />
  );
}

// No module-level preload: only the chosen body's ~280 KB file is fetched.
