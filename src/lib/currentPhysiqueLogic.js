/**
 * lib/currentPhysiqueLogic.js
 * Dedicated logic engine strictly for the CURRENT avatar model.
 * 
 * Lineup mesh names inside stylized_male_base_mesh_free.glb:
 * - guy.001: Muscular / Built
 * - guy.002: Obese / Heavyset
 * - guy.003: Thin / Slim
 * - guy.004: Lean / Athletic
 * - guy.005: Soft Belly / Overweight
 */

export const CURRENT_ARCHETYPES = {
  SLIM: {
    meshKey: 'guy.003',
    fallbackIndex: 4,
    label: 'Slim / Skinny',
    scaleBoost: { x: 0.86, z: 0.86, waist: 0.85, chest: 0.85, arm: 0.88 },
  },
  SOFT_BELLY: {
    meshKey: 'guy.005',
    fallbackIndex: 1,
    label: 'Overweight / Soft Belly',
    scaleBoost: { x: 1.08, z: 1.14, waist: 1.16, chest: 0.98, arm: 0.95 },
  },
  OBESE: {
    meshKey: 'guy.002',
    fallbackIndex: 2,
    label: 'Heavyset / Obese',
    scaleBoost: { x: 1.22, z: 1.28, waist: 1.30, chest: 1.05, arm: 1.05 },
  },
  LEAN: {
    meshKey: 'guy.004',
    fallbackIndex: 0,
    label: 'Lean / Athletic',
    scaleBoost: { x: 0.98, z: 0.96, waist: 0.94, chest: 1.06, arm: 1.02 },
  },
  MUSCULAR: {
    meshKey: 'guy.001',
    fallbackIndex: 3,
    label: 'Muscular / Bodybuilder',
    scaleBoost: { x: 1.15, z: 1.02, waist: 0.92, chest: 1.25, arm: 1.22 },
  },
};

export function resolveCurrentPhysique({
  chestCm,
  waistCm,
  heightCm = 175,
  weightKg = 75,
  bodyFatPct = 18,
}) {
  const c = Number(chestCm) || 95;
  const w = Number(waistCm) || 85;
  const hM = (Number(heightCm) || 175) / 100;
  const wt = Number(weightKg) || 75;
  const bmi = wt / (hM * hM);
  const bf = Number(bodyFatPct) || 18;

  // Case A: Overall slim/skinny (low BMI or small frame in both chest and waist)
  if (bmi < 20.0 || (c < 88 && w < 75)) {
    return CURRENT_ARCHETYPES.SLIM;
  }

  // Case B: Waist is greater than or equal to Chest
  if (w >= c) {
    const diff = w - c;
    // Extreme difference or high body fat/BMI -> Obese
    if (diff >= 7 || bf >= 27 || bmi >= 30) {
      return CURRENT_ARCHETYPES.OBESE;
    }
    // Moderate waist prominence: if user has a very low BMI, treat as slim, else soft belly
    if (bmi < 21.5) {
      return CURRENT_ARCHETYPES.SLIM;
    }
    return CURRENT_ARCHETYPES.SOFT_BELLY;
  }

  // Case C: Chest is greater than Waist
  const diff = c - w;
  const ratio = c / Math.max(1, w);

  // Chest significantly greater than waist -> Muscular
  if (ratio >= 1.22 || diff >= 16 || (ratio >= 1.15 && bf <= 14)) {
    return CURRENT_ARCHETYPES.MUSCULAR;
  }

  // Chest moderately greater than waist -> Lean / Athletic
  return CURRENT_ARCHETYPES.LEAN;
}