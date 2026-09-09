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

  // Bound to natural living ranges
  bodyFatPct = Math.max(sex === 'male' ? 7.0 : 13.0, Math.min(48.0, bodyFatPct));

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

/**
 * 2. Dream Projection with Multi-Component Body Partitioning
 * (Accounts for water, glycogen, and supportive tissue during cuts)
 */
export function projectScientificDream({
  currentSpecs,
  targetWeightKg,
  heightCm,
  sex = 'male',
}) {
  const hM = heightCm / 100;
  const weightDelta = targetWeightKg - currentSpecs.weightKg;
  const absDelta = Math.abs(weightDelta);

  let fatDelta = 0;
  let leanDelta = 0;

  if (weightDelta < 0) {
    // Realistic Partitioning:
    // ~72% adipose fat tissue
    // ~28% non-fat (glycogen stores, intracellular water, digestive mass)
    fatDelta = -(absDelta * 0.72);
    leanDelta = -(absDelta * 0.28);
  } else {
    // Surplus Partitioning: ~45% lean muscle, ~55% adipose tissue
    leanDelta = weightDelta * 0.45;
    fatDelta = weightDelta * 0.55;
  }

  const currentFatKg = currentSpecs.fatMassKg;
  const targetFatKg = Math.max(currentSpecs.weightKg * 0.05, currentFatKg + fatDelta);
  const targetLbm = targetWeightKg - targetFatKg;
  const targetBfPct = Math.round((targetFatKg / targetWeightKg) * 1000) / 10;
  const targetFfmi = targetLbm / (hM * hM);

  // Regional circumferences based on regional adipose density
  // 1 kg pure fat lost from trunk = ~0.88 cm off waist, ~0.65 cm off hips
  const pureFatDropKg = Math.abs(fatDelta);
  const sign = weightDelta >= 0 ? 1 : -1;

  const waistDeltaCm = sign * (pureFatDropKg * 0.88);
  const hipDeltaCm = sign * (pureFatDropKg * 0.65);
  const chestDeltaCm = sign * (pureFatDropKg * 0.18) + (leanDelta * 0.35);
  const bicepDeltaCm = sign * (pureFatDropKg * 0.06) + (leanDelta * 0.25);

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