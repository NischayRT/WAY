/**
 * lib/physiqueArchetype.js
 * ----------------------------------------------------------------
 * Maps user metrics to the corresponding mesh index in
 * stylized_male_base_mesh_free.glb, confirmed by direct visual inspection:
 *   0: guy.004 -> Lean / Athletic
 *   1: guy.001 -> Overweight / Soft belly
 *   2: guy.002 -> Heavyset / Obese
 *   3: guy.003 -> Muscular / Bodybuilder
 *   4: guy.005 -> Slim / Skinny
 *
 * SELECTION: RealisticAvatar3D.js picks by ARRAY POSITION in scene-traversal
 * order, not by name matching (name matching was the real bug behind
 * "both avatars look the same" — likely a SkinnedMesh naming quirk in
 * GLTFLoader).
 *
 * CLASSIFICATION: uses clean, non-overlapping body-fat-% bands as the
 * PRIMARY axis, instead of an if/else chain evaluated by priority order.
 * The earlier version's ordering had a real bug: the "Overweight" check
 * ran before "Muscular" and its `bmi >= 24.5` condition is trivially easy
 * to hit, so genuinely lean/muscular people (low body fat, high BMI from
 * muscle mass) got shoved into "Overweight" before "Muscular" was ever
 * evaluated — which is why some archetypes rarely or never appeared.
 * Making body-fat % bands mutually exclusive and evaluated by magnitude
 * (not by which check happens to run first) guarantees every archetype is
 * reachable by construction. Only the leanest band gets split further —
 * by FFMI (fat-free mass index), the one place two different body types
 * genuinely share similar body fat %.
 */

export const ARCHETYPES = [
  {
    index: 0,
    meshKey: "guy.004",
    label: "Overweight / Soft belly",
    visualBoost: { waist: 0.97, chest: 1.05, arm: 1.02 },
  },
  {
    index: 1,
    meshKey: "guy.001",
    label: "Lean / Athletic",
    visualBoost: { waist: 1.08, chest: 1.0, arm: 0.98 },
  },
  {
    index: 2,
    meshKey: "guy.002",
    label: "Muscular / Bodybuilder",
    visualBoost: { waist: 1.12, chest: 1.05, arm: 1.0 },
  },
  {
    index: 3,
    meshKey: "guy.003",
    label: "Heavyset / Obese",
    visualBoost: { waist: 0.98, chest: 1.18, arm: 1.15 },
  },
  {
    index: 4,
    meshKey: "guy.005",
    label: "Slim / Skinny",
    visualBoost: { waist: 0.85, chest: 0.85, arm: 0.85 },
  },
];

/**
 * @param {{bodyFatPct?:number, weightKg:number, heightCm:number, chestCm?:number, waistCm?:number}} m
 * @returns {0|1|2|3|4}
 */
export function resolveArchetypeIndex({ bodyFatPct, weightKg, heightCm, chestCm, waistCm }) {
  const hM = Number(heightCm) / 100.0;
  const weight = Number(weightKg);
  const bmi = weight / (hM * hM);
  const bf = Number(bodyFatPct);

  // Severe-obesity safety net: only overrides at a genuinely extreme BMI,
  // in case a body-fat estimate is off for an unusual frame. Deliberately
  // NOT set near 29-30 (that band is common for plenty of non-obese heavy
  // builds and was swallowing "Muscular" candidates in the old logic).
  if (bf >= 25 || bmi >= 32) {
    return 3; // Obese
  }

  if (bf >= 18) {
    return 0; // Overweight / Soft belly (18-25%)
  }

  if (bf >= 13) {
    return 2; // Lean / Athletic (13-18%)
  }

  // bf < 13: split by muscularity (FFMI), the signal that actually
  // distinguishes "Muscular" from "Slim" at similarly low body fat.
  const leanMassKg = weight * (1 - bf / 100);
  const ffmi = leanMassKg / (hM * hM);

  return ffmi >= 20.5 ? 1 : 4; // Muscular/Bodybuilder vs Slim/Skinny
}

/** Looks up full archetype metadata (label, meshKey, visualBoost) for an index. */
export function getArchetypeInfo(index) {
  return ARCHETYPES[index] || ARCHETYPES[0];
}