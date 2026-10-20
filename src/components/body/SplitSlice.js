'use client';

// The goal/current cut: one thin elliptical ring round the body at the split
// height, wide enough to clear the arms. Seen from the front it reads as a
// clean boundary line; the back half passes behind the body.
export default function SplitSlice({ y, x = 0 }) {
  return (
    <mesh position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.84, 0.36, 1]} renderOrder={2}>
      <torusGeometry args={[1, 0.007, 8, 160]} />
      <meshBasicMaterial color="#6ee7b7" transparent opacity={0.95} />
    </mesh>
  );
}
