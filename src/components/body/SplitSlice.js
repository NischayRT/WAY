'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

// The goal/current cut: a flat, borderless slice through the body at the
// split height. It is much wider than the stage and fades out radially, so
// it reads as an endless plane with no visible edge.
const SIZE = 7;

function fadeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function SplitSlice({ y, x = 0 }) {
  const alphaMap = useMemo(() => fadeTexture(), []);
  return (
    <mesh position={[x, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[SIZE, SIZE]} />
      <meshBasicMaterial color="#34d399" alphaMap={alphaMap} transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
