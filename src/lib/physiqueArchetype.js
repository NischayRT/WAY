/**
 * lib/physiqueArchetype.js
 */

export const ARCHETYPES = [
  {
    index: 0,
    meshIndex: 1,
    meshKey: "normal-lean",
    label: "Lean / Athletic",
    visualBoost: { waist: 0.95, chest: 1.05, arm: 1.0 },
  },
  {
    index: 1,
    meshIndex: 1,
    meshKey: "normal-overweight",
    label: "Overweight / Soft belly",
    visualBoost: { waist: 1.15, chest: 0.98, arm: 0.92 },
  },
  {
    index: 2,
    meshIndex: 3,
    meshKey: "obese",
    label: "Heavyset / Obese",
    visualBoost: { waist: 1.25, chest: 1.05, arm: 1.0 },
  },
  {
    index: 3,
    meshIndex: 1,
    meshKey: "normal-muscular",
    label: "Muscular / Bodybuilder",
    visualBoost: { waist: 0.90, chest: 1.25, arm: 1.2 },
  },
  {
    index: 4,
    meshIndex: 4,
    meshKey: "skinny",
    label: "Slim / Skinny",
    visualBoost: { waist: 0.85, chest: 0.85, arm: 0.85 },
  },
];

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Dedicated classifier for the CURRENT model only.
 * Logic:
 * - Slim/Skinny if chest & waist are both small or BMI is very low (< 20.5)
 * - Waist > Chest:
 *     - If waist - chest >= 10 cm or severe waist size -> Obese
 *     - Otherwise -> Soft belly / Overweight (or Slim if low BMI)
 * - Chest > Waist:
 *     - If chest / waist >= 1.25 (or chest - waist >= 18 cm) -> Muscular
 *     - Otherwise -> Lean / Athletic
 */
export function resolveCurrentArchetypeIndex({
  bodyFatPct,
  weightKg,
  heightCm,
  chestCm,
  waistCm,
}) {
  const hM = num(heightCm, 175) / 100;
  const weight = num(weightKg, 75);
  const bmi = weight / (hM * hM);
  const chest = num(chestCm, 95);
  const waist = num(waistCm, 85);
  const bf = num(bodyFatPct, 18);

  // 1. Check if frame is globally small/underweight
  if (bmi < 20.0 || (chest < 86 && waist < 74)) {
    return 4; // Slim / Skinny
  }

  // 2. Waist is greater than chest
  if (waist >= chest) {
    const diff = waist - chest;
    // If waist significantly exceeds chest or body fat / BMI is high
    if (diff >= 8 || bf >= 28 || bmi >= 31) {
      return 2; // Obese / Heavyset
    }
    // If thin overall but waist slightly edges chest
    if (bmi < 22) {
      return 4; // Slim / Skinny
    }
    return 1; // Overweight / Soft belly
  }

  // 3. Chest is greater than waist
  const ratio = chest / Math.max(1, waist);
  const diff = chest - waist;

  // Significant V-taper
  if (ratio >= 1.22 || diff >= 16 || (ratio >= 1.16 && bf <= 15)) {
    return 3; // Muscular / Bodybuilder
  }

  // Moderate athletic ratio
  return 0; // Lean / Athletic
}

/**
 * Target / Dream model classifier — untouched to preserve target logic.
 */
export function resolveArchetypeIndex({ bodyFatPct, weightKg, heightCm, chestCm, waistCm }) {
  const heightM = num(heightCm, 176) / 100;
  const weight = num(weightKg, 75);
  const bmi = weight / (heightM * heightM);
  const bf = num(bodyFatPct, Math.max(8, Math.min(35, bmi * 1.2 - 10)));

  if (bf >= 25 || bmi >= 32) {
    return 2; // Heavyset / Obese
  }
  if (bf >= 18) {
    return 1; // Overweight / Soft belly (18-25%)
  }
  if (bf >= 13) {
    return 0; // Lean / Athletic (13-18%)
  }

  const vTaper = chestCm && waistCm ? num(chestCm, 0) / Math.max(1, num(waistCm, 1)) : null;
  const leanMassKg = weight * (1 - bf / 100);
  const ffmi = leanMassKg / (heightM * heightM);

  if (ffmi >= 20.5 || (vTaper !== null && vTaper >= 1.35)) {
    return 3; // Muscular / Bodybuilder
  }
  if (ffmi < 17) {
    return 4; // Slim / Skinny
  }
  return 0; // Lean / Athletic
}

export function getArchetypeInfo(index) {
  return ARCHETYPES[index] || ARCHETYPES[0];
}