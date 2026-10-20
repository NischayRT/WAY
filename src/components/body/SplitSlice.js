'use client';

import * as THREE from 'three';

// The goal/current cut: a thin flat slice through the body at the split
// height, a faint glass fill with a crisp border. Bodies are drawn 2.0 units
// tall; the slice is wide enough for outstretched arms, shallow front to back.
const PLANE = new THREE.PlaneGeometry(1.7, 0.62);
const EDGES = new THREE.EdgesGeometry(PLANE);

export default function SplitSlice({ y, x = 0 }) {
  return (
    <group position={[x, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={PLANE} renderOrder={2}>
        <meshBasicMaterial color="#34d399" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={EDGES} renderOrder={3}>
        <lineBasicMaterial color="#6ee7b7" transparent opacity={0.95} />
      </lineSegments>
    </group>
  );
}
