/**
 * lib/physiqueArchetype.js
 * ----------------------------------------------------------------
 * MAJOR REVISION based on direct empirical testing (not offline geometry
 * inspection, which turned out to give a different — and wrong — picture
 * of what the live runtime actually renders).
 *
 * The test: render the same handful of real body stats while manually
 * reassigning which raw index number each category returns, across three
 * variants, and record what mesh actually showed up at each index
 * position. Findings:
 *
 *   - meshIndex 3 is UNAMBIGUOUSLY the obese/heavyset sculpt (round belly,
 *     wide frame) — confirmed directly, not inferred.
 *   - meshIndex 4 is UNAMBIGUOUSLY the skinny/thin sculpt — same.
 *   - meshIndex 0, 1, and 2 do NOT read as three different body types.
 *     They all behave like the same "normal/athletic" build responding to
 *     input scaling (looks leaner at lower weight, more built at higher
 *     weight) — not three distinct sculpts.
 *
 * CONSEQUENCE: trying to make "Overweight/Soft belly," "Lean/Athletic,"
 * and "Muscular/Bodybuilder" each use a different one of {0,1,2} was
 * fighting an asset that doesn't actually have three different sculpts
 * there. Those three categories now all point at the SAME underlying mesh
 * (meshIndex 1) and are differentiated entirely through `visualBoost` (and
 * the existing measurement-based waist/chest scaling in
 * RealisticAvatar3D.js) — which is reliable, since that scaling is
 * demonstrably what was doing the real work in the test images anyway.
 * Obese and skinny keep their own distinct meshIndex, since those are the
 * two sculpturally real extremes this asset actually has.
 *
 * `index` below is the classifier's category id (unchanged from before —
 * resolveArchetypeIndex's threshold logic is untouched). `meshIndex` is
 * the SEPARATE, actual scene-position RealisticAvatar3D.js renders — the
 * two are no longer assumed to be the same number.
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
    visualBoost: { waist: 1.1, chest: 1.05, arm: 1.0 },
  },
  {
    index: 3,
    meshIndex: 1,
    meshKey: "normal-muscular",
    label: "Muscular / Bodybuilder",
    visualBoost: { waist: 0.92, chest: 1.22, arm: 1.2 },
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
 * Classification thresholds are unchanged from the previous revision —
 * only the archetype-to-mesh mapping above changed.
 * @param {{bodyFatPct?:number, weightKg:number, heightCm:number, chestCm?:number, waistCm?:number}} m
 * @returns {0|1|2|3|4}
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

  // bf < 13: three real outcomes — Muscular (low fat + high muscle),
  // Skinny (low fat + low muscle), or Lean (low fat + ordinary muscle).
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

/** Looks up full archetype metadata (label, meshIndex, visualBoost) for a category index. */
export function getArchetypeInfo(index) {
  return ARCHETYPES[index] || ARCHETYPES[0];
}