'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { resolveArchetypeIndex, getArchetypeInfo } from '@/lib/physiqueArchetype';

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
}) {
  const { scene } = useGLTF('/models/stylized_male_base_mesh_free.glb');

  const archetype = useMemo(() => {
    const index = resolveArchetypeIndex({ bodyFatPct, weightKg, heightCm, chestCm, waistCm });
    return getArchetypeInfo(index);
  }, [bodyFatPct, weightKg, heightCm, chestCm, waistCm]);

  // SELECT BY ARRAY POSITION, not by name matching — this is the proven fix.
  // Name-based matching against child.name was silently failing (likely a
  // SkinnedMesh naming quirk in GLTFLoader); positional indexing into the
  // scene-traversal order reliably picks a mesh.
  //
  // Uses archetype.meshIndex (NOT archetype.index) — empirical testing
  // showed positions 0/1/2 don't actually read as three different body
  // types, only positions 3 (obese) and 4 (skinny) are sculpturally
  // distinct. meshIndex is the decoupled "which mesh to actually render"
  // value; index is just the category id. See physiqueArchetype.js.
  const singleMesh = useMemo(() => {
    const meshes = [];
    scene.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });

    const targetMesh = meshes[archetype.meshIndex] || meshes[0];
    if (!targetMesh) return null;

    const geom = targetMesh.geometry.clone();
    geom.center();
    geom.computeVertexNormals();
    geom.computeBoundingBox();

    const size = geom.boundingBox.getSize(new THREE.Vector3());
    const scaleFactor = 2.0 / (size.y || 1);

    // Modest measurement-based fine-tuning on top of correct archetype selection.
    const idealWaist = Number(heightCm) * 0.44;
    const idealChest = Number(heightCm) * 0.55;
    const measuredWRatio = Math.max(0.88, Math.min(1.18, Number(waistCm) / idealWaist));
    const measuredCRatio = Math.max(0.88, Math.min(1.18, Number(chestCm) / idealChest));

    // Deliberate per-archetype exaggeration so all 5 categories stay
    // visually distinguishable (see physiqueArchetype.js for why).
    const boost = archetype.visualBoost;
    const wRatio = measuredWRatio * boost.waist;
    const cRatio = measuredCRatio * boost.chest;
    const armFactor = boost.arm;

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.08,
      wireframe,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, material);
    mesh.scale.set(
      scaleFactor * ((wRatio + cRatio) / 2) * armFactor,
      scaleFactor,
      scaleFactor * wRatio
    );
    mesh.position.set(0, 1.0, 0);

    return mesh;
  }, [scene, archetype, color, roughness, wireframe, heightCm, waistCm, chestCm]);

  if (!singleMesh) return null;

  // key={archetype.meshKey} forces a clean remount when the archetype
  // changes, instead of React trying to diff/reuse the old geometry.
  return <primitive object={singleMesh} key={archetype.meshKey} />;
}

// Wrap or remove at the bottom of RealisticAvatar3D.js:
if (typeof window !== 'undefined') {
  useGLTF.preload('/models/stylized_male_base_mesh_free.glb');
}