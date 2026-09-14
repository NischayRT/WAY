/**
 * lib/targetPhysiqueLogic.js
 * Strictly for the TARGET / DREAM model. Preserves original logic unaltered.
 */

export const TARGET_ARCHETYPES = [
  {
    index: 0,
    meshIndex: 1,
    meshKey: "guy.004",
    label: "Lean / Athletic",
    visualBoost: { waist: 0.95, chest: 1.05, arm: 1.0 },
  },
  {
    index: 1,
    meshIndex: 1,
    meshKey: "guy.005",
    label: "Overweight / Soft belly",
    visualBoost: { waist: 1.15, chest: 0.98, arm: 0.92 },
  },
  {
    index: 2,
    meshIndex: 3,
    meshKey: "guy.002",
    label: "Heavyset / Obese",
    visualBoost: { waist: 1.1, chest: 1.05, arm: 1.0 },
  },
  {
    index: 3,
    meshIndex: 1,
    meshKey: "guy.001",
    label: "Muscular / Bodybuilder",
    visualBoost: { waist: 0.92, chest: 1.22, arm: 1.2 },
  },
  {
    index: 4,
    meshIndex: 4,
    meshKey: "guy.003",
    label: "Slim / Skinny",
    visualBoost: { waist: 0.85, chest: 0.85, arm: 0.85 },
  },
];

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function resolveTargetPhysique({ bodyFatPct, weightKg, heightCm, chestCm, waistCm }) {
  const heightM = num(heightCm, 176) / 100;
  const weight = num(weightKg, 75);
  const bmi = weight / (heightM * heightM);
  const bf = num(bodyFatPct, Math.max(8, Math.min(35, bmi * 1.2 - 10)));

  if (bf >= 25 || bmi >= 32) {
    return TARGET_ARCHETYPES[2];
  }
  if (bf >= 18) {
    return TARGET_ARCHETYPES[1];
  }
  if (bf >= 13) {
    return TARGET_ARCHETYPES[0];
  }

  const vTaper = chestCm && waistCm ? num(chestCm, 0) / Math.max(1, num(waistCm, 1)) : null;
  const leanMassKg = weight * (1 - bf / 100);
  const ffmi = leanMassKg / (heightM * heightM);

  if (ffmi >= 20.5 || (vTaper !== null && vTaper >= 1.35)) {
    return TARGET_ARCHETYPES[3];
  }
  if (ffmi < 17) {
    return TARGET_ARCHETYPES[4];
  }
  return TARGET_ARCHETYPES[0];
}