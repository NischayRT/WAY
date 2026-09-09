/**
 * Maps anthropometric measurements to the lineup mesh indices:
 * Index 0: guy.004 -> Fit & Decent Muscle
 * Index 1: guy.001 -> Bulked & Muscular
 * Index 2: guy.002 -> Obese
 * Index 3: guy.003 -> Thin
 * Index 4: guy.005 -> Normal to Fat
 *
 * This index -> mesh mapping was verified directly against
 * stylized_male_base_mesh_free.glb: the five meshes are named guy.001-guy.005,
 * and guy.002 was confirmed geometrically to have by far the largest waist
 * depth of the five (consistent with "Obese").
 */
export function resolveArchetypeIndex({
  bodyFatPct,
  weightKg,
  heightCm,
  chestCm,
  waistCm,
  bicepCm = 35,
}) {
  const hM = Number(heightCm) / 100.0;
  const bmi = Number(weightKg) / (hM * hM);
  const bf = Number(bodyFatPct);
  const vTaper = Number(chestCm) / Math.max(1, Number(waistCm));
  const armThickRatio = Number(bicepCm) / (Number(heightCm) * 0.2); // ~35cm / 35.3 = ~1.0

  // 1. Obese (Model 3 -> guy.002)
  // High body fat or high BMI with low/moderate V-taper
  if (bf >= 25.0 || bmi >= 29.0) {
    return 2;
  }

  // 2. Normal to Fat / Soft (Model 5 -> guy.005)
  // Mild to moderate excess fat around belly/waist (e.g., 78kg at 16-24% BF, waist > 33")
  if (bf >= 15.5 || (bmi >= 24.0 && vTaper < 1.18)) {
    return 4;
  }

  // 3. Bulked & Muscular (Model 2 -> guy.001)
  // High body mass, thick arms, and a strong chest-to-waist ratio
  if (bmi >= 23.5 && (vTaper >= 1.2 || armThickRatio >= 1.05) && bf <= 16.5) {
    return 1;
  }

  // 4. Thin (Model 4 -> guy.003)
  // Underweight or skinny-lean frame with low BMI and narrow chest
  if (bmi < 21.0 && bf <= 13.0) {
    return 3;
  }

  // 5. Fit & Decent Muscle (Model 1 -> guy.004)
  // Chiseled, athletic target state (e.g., 71kg at ~9-14% BF with V-taper)
  return 0;
}

// Bridges an index (0-4) to the REAL mesh name inside
// stylized_male_base_mesh_free.glb. RealisticAvatar3D.js matches meshes by
// name (child.name.toLowerCase().includes(meshKey)), not by index, so this
// mapping is what makes resolveArchetypeIndex's output actually select the
// right visible mesh.
export const ARCHETYPES = [
  { index: 0, meshKey: "guy.004", label: "Fit & Decent Muscle" },
  { index: 1, meshKey: "guy.001", label: "Bulked & Muscular" },
  { index: 2, meshKey: "guy.002", label: "Obese" },
  { index: 3, meshKey: "guy.003", label: "Thin" },
  { index: 4, meshKey: "guy.005", label: "Normal to Fat" },
];

/**
 * What RealisticAvatar3D.js actually imports and calls. Runs the proven
 * index classifier above, then resolves that index to the real mesh-name
 * fragment to match against the GLB's node names.
 */
export function resolveArchetypeNode(measurements) {
  const index = resolveArchetypeIndex(measurements);
  return ARCHETYPES[index].meshKey;
}

/** Looks up display metadata (label, meshKey) for a given archetype index. */
export function getArchetypeInfo(index) {
  return ARCHETYPES[index] || ARCHETYPES[0];
}