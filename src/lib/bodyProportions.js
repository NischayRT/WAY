/**
 * lib/bodyProportions.js
 * Validated Multi-Metric Body Composition & Transformation Engine
 */

export function estimateNeckCircumference(heightCm, weightKg, chestCm, sex = 'male') {
  if (sex === 'male') {
    return 0.20 * heightCm + 0.04 * weightKg + 0.04 * chestCm;
  }
  return 0.18 * heightCm + 0.04 * weightKg + 0.04 * chestCm;
}

/**
 * 1. Current Physique Analysis using Validated US Navy Logarithmic Model
 */
export function analyzeCurrentPhysique({
  heightCm,
  weightKg,
  sex = 'male',
  waistCm,
  hipCm,
  chestCm,
  bicepCm,
  neckCm = null,
}) {
  const hM = heightCm / 100;
  const actualNeck = neckCm || estimateNeckCircumference(heightCm, weightKg, chestCm, sex);

  let bodyFatPct;
  if (sex === 'male') {
    // US Navy formula for Men
    const diff = Math.max(1.0, waistCm - actualNeck);
    const density = 1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm);
    bodyFatPct = 495.0 / density - 450.0;
  } else {
    // US Navy formula for Women
    const diff = Math.max(1.0, waistCm + hipCm - actualNeck);
    const density = 1.29579 - 0.35004 * Math.log10(diff) + 0.22100 * Math.log10(heightCm);
    bodyFatPct = 495.0 / density - 450.0;
  }

  // Bound to natural living ranges. Floor matches ESSENTIAL_FAT_FLOOR_PCT
  // below (5% male / 12% female) so the "current" reading, the slider
  // limits, and the target-projection floor all agree on the same number.
  const floorPct = ESSENTIAL_FAT_FLOOR_PCT[sex] ?? ESSENTIAL_FAT_FLOOR_PCT.male;
  bodyFatPct = Math.max(floorPct, Math.min(48.0, bodyFatPct));

  const fatMassKg = weightKg * (bodyFatPct / 100.0);
  const leanMassKg = weightKg - fatMassKg;

  const ffmi = leanMassKg / (hM * hM);
  const normalizedFfmi = ffmi + 6.1 * (1.8 - hM);

  // Katch-McArdle BMR (strictly based on active lean tissue)
  const bmrKatch = Math.round(370.0 + 21.6 * leanMassKg);

  const vTaperRatio = chestCm / waistCm;
  const waistToHipRatio = waistCm / hipCm;
  const waistToHeightRatio = waistCm / heightCm;

  return {
    neckCm: Math.round(actualNeck * 10) / 10,
    bodyFatPct: Math.round(bodyFatPct * 10) / 10,
    leanMassKg: Math.round(leanMassKg * 10) / 10,
    fatMassKg: Math.round(fatMassKg * 10) / 10,
    ffmi: Math.round(ffmi * 10) / 10,
    normalizedFfmi: Math.round(normalizedFfmi * 10) / 10,
    bmr: bmrKatch,
    vTaperRatio: Math.round(vTaperRatio * 100) / 100,
    waistToHipRatio: Math.round(waistToHipRatio * 100) / 100,
    waistToHeightRatio: Math.round(waistToHeightRatio * 100) / 100,
  };
}

// Essential fat minimums are not the same for men and women — women
// physiologically require substantially more (roughly 10-13%, driven by
// reproductive biology) than men (roughly 3-5%). A single flat floor for
// both sexes can let a projection for a female user drop fat mass to a
// genuinely unsafe, physiologically implausible level.
export const ESSENTIAL_FAT_FLOOR_PCT = { male: 5, female: 12 };

/**
 * Inverts the US Navy body-fat formula to find the smallest waist
 * circumference (cm) that still keeps the *computed* body fat % at or
 * above the essential-fat floor, given the other measurements that feed
 * into the formula (height, neck-driving weight/chest, and — for women —
 * hip). This is what the waist slider's `min` should be clamped to, so a
 * user physically cannot drag the slider into a body-fat reading below
 * what's biologically plausible.
 */
export function minWaistCmForBfFloor({ heightCm, weightKg, chestCm, hipCm, sex = 'male' }) {
  const neck = estimateNeckCircumference(heightCm, weightKg, chestCm, sex);
  const floorPct = ESSENTIAL_FAT_FLOOR_PCT[sex] ?? ESSENTIAL_FAT_FLOOR_PCT.male;
  const targetDensity = 495.0 / (floorPct + 450.0);

  if (sex === 'male') {
    // density = 1.0324 - 0.19077*log10(waist - neck) + 0.15456*log10(height)
    const logDiff = (1.0324 + 0.15456 * Math.log10(heightCm) - targetDensity) / 0.19077;
    const diff = Math.pow(10, logDiff);
    return diff + neck;
  }

  // density = 1.29579 - 0.35004*log10(waist + hip - neck) + 0.22100*log10(height)
  const logSum = (1.29579 + 0.221 * Math.log10(heightCm) - targetDensity) / 0.35004;
  const sum = Math.pow(10, logSum);
  return Math.max(50, sum - Number(hipCm || 0) + neck);
}

// Fat distribution pattern differs by sex: men trend android (fat
// concentrated more centrally/abdominally), women trend gynoid (more at
// hips/thighs). Applying one set of circumference-per-kg coefficients to
// both sexes ignores this. These are approximate, not exact.
const REGIONAL_FAT_COEFFICIENTS = {
  male: { waistPerKgFat: 0.88, hipPerKgFat: 0.65 },
  female: { waistPerKgFat: 0.62, hipPerKgFat: 0.9 },
};

/**
 * How much of a weight change is fat vs. lean tissue depends heavily on
 * *pace*. A slow, sustainable rate preserves lean mass much better than an
 * aggressive one — this app's own goalFeasibility.js already flags fast
 * paces as unsafe, but that insight previously never fed back into what
 * the projected body actually looked like: the split was a flat constant
 * regardless of timeline. These bands fix that.
 *
 * @param {{direction:'loss'|'gain', weeklyRatePct: number|null}} p
 *   weeklyRatePct is % of starting bodyweight changing per week. null when
 *   no timeline is available yet, in which case this falls back to the
 *   original flat "moderate pace" assumption.
 */
function resolvePartitionRatios({ direction, weeklyRatePct }) {
  if (weeklyRatePct == null) {
    return direction === 'loss' ? { fat: 0.72, lean: 0.28 } : { lean: 0.45, fat: 0.55 };
  }

  if (direction === 'loss') {
    if (weeklyRatePct <= 0.5) return { fat: 0.85, lean: 0.15 }; // slow & sustainable
    if (weeklyRatePct <= 0.7) return { fat: 0.78, lean: 0.22 };
    if (weeklyRatePct <= 1.0) return { fat: 0.68, lean: 0.32 }; // moderate-aggressive
    return { fat: 0.55, lean: 0.45 }; // crash-diet pace — substantial muscle loss
  }

  // gain
  if (weeklyRatePct <= 0.15) return { lean: 0.6, fat: 0.4 }; // slow lean bulk
  if (weeklyRatePct <= 0.3) return { lean: 0.45, fat: 0.55 };
  if (weeklyRatePct <= 0.5) return { lean: 0.3, fat: 0.7 };
  return { lean: 0.15, fat: 0.85 }; // fast surplus — mostly fat gain
}

/**
 * 2. Dream Projection with Multi-Component Body Partitioning
 * (Accounts for water, glycogen, and supportive tissue during cuts)
 *
 * @param {object} p
 * @param {number} [p.daysAvailable] - days until the target date, if known.
 *   Drives pace-aware partitioning (see resolvePartitionRatios above). If
 *   omitted, falls back to the original flat moderate-pace assumption.
 */
export function projectScientificDream({
  currentSpecs,
  targetWeightKg,
  heightCm,
  sex = 'male',
  daysAvailable = null,
}) {
  const hM = heightCm / 100;
  const weightDelta = targetWeightKg - currentSpecs.weightKg;
  const absDelta = Math.abs(weightDelta);
  const direction = weightDelta < 0 ? 'loss' : 'gain';

  const weeklyRatePct =
    daysAvailable && daysAvailable > 0 && currentSpecs.weightKg > 0
      ? ((absDelta / currentSpecs.weightKg) * 100) / (daysAvailable / 7)
      : null;

  const { fat: fatShare, lean: leanShare } = resolvePartitionRatios({ direction, weeklyRatePct });

  let fatDelta = 0;
  let leanDelta = 0;
  if (weightDelta < 0) {
    fatDelta = -(absDelta * fatShare);
    leanDelta = -(absDelta * leanShare);
  } else {
    leanDelta = weightDelta * leanShare;
    fatDelta = weightDelta * fatShare;
  }

  const currentFatKg = currentSpecs.fatMassKg;
  const essentialFloorPct = ESSENTIAL_FAT_FLOOR_PCT[sex] ?? ESSENTIAL_FAT_FLOOR_PCT.male;
  // Floor is based on TARGET weight (the body actually being projected),
  // not current weight — using current weight here would let the floor
  // silently fail to track a large weight change.
  const targetFatKg = Math.max(targetWeightKg * (essentialFloorPct / 100), currentFatKg + fatDelta);
  const targetLbm = targetWeightKg - targetFatKg;
  const targetBfPct = Math.round((targetFatKg / targetWeightKg) * 1000) / 10;
  const targetFfmi = targetLbm / (hM * hM);

  const pureFatDropKg = Math.abs(fatDelta);
  const sign = weightDelta >= 0 ? 1 : -1;
  const coeffs = REGIONAL_FAT_COEFFICIENTS[sex] ?? REGIONAL_FAT_COEFFICIENTS.male;

  const waistDeltaCm = sign * (pureFatDropKg * coeffs.waistPerKgFat);
  const hipDeltaCm = sign * (pureFatDropKg * coeffs.hipPerKgFat);
  // Chest tracks LEAN mass change only, not fat — a pure fat-loss/gain
  // projection with unchanged lean mass now genuinely leaves chest
  // unchanged, matching the "Preserved" label shown in the UI for that
  // case, instead of quietly shifting it via a fat-linked term.
  const chestDeltaCm = leanDelta * 0.35;
  const bicepDeltaCm = sign * (pureFatDropKg * 0.06) + leanDelta * 0.25;

  const dreamWaistCm = Math.max(60, currentSpecs.waistCm + waistDeltaCm);
  const dreamHipCm = Math.max(70, currentSpecs.hipCm + hipDeltaCm);
  const dreamChestCm = currentSpecs.chestCm + chestDeltaCm;
  const dreamBicepCm = currentSpecs.bicepCm + bicepDeltaCm;

  const targetBmr = Math.round(370.0 + 21.6 * targetLbm);

  return {
    targetWeightKg: Math.round(targetWeightKg * 10) / 10,
    targetLbm: Math.round(targetLbm * 10) / 10,
    targetFatKg: Math.round(targetFatKg * 10) / 10,
    targetBfPct,
    targetFfmi: Math.round(targetFfmi * 10) / 10,
    weightDelta: Math.round(weightDelta * 10) / 10,
    muscleDelta: Math.round(leanDelta * 10) / 10,
    fatDelta: Math.round(fatDelta * 10) / 10,
    weeklyRatePct: weeklyRatePct != null ? Math.round(weeklyRatePct * 100) / 100 : null,
    targetBmr,
    dimensions: {
      waistCm: Math.round(dreamWaistCm * 10) / 10,
      waistIn: Math.round((dreamWaistCm / 2.54) * 10) / 10,
      hipCm: Math.round(dreamHipCm * 10) / 10,
      hipIn: Math.round((dreamHipCm / 2.54) * 10) / 10,
      chestCm: Math.round(dreamChestCm * 10) / 10,
      chestIn: Math.round((dreamChestCm / 2.54) * 10) / 10,
      bicepCm: Math.round(dreamBicepCm * 10) / 10,
      bicepIn: Math.round((dreamBicepCm / 2.54) * 10) / 10,
      vTaper: Math.round((dreamChestCm / dreamWaistCm) * 100) / 100,
      waistToHip: Math.round((dreamWaistCm / dreamHipCm) * 100) / 100,
    },
  };
}