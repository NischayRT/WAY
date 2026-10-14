/**
 * lib/bodyPreview.js
 * The current body and the goal body as the 3D views draw them, from the
 * profile's measurements (or sex-specific estimates when none are saved).
 * Shared by the Today weight card and Activity's body composition.
 */

import {
  analyzeCurrentPhysique,
  projectScientificDream,
  minWaistCmForBfFloor,
  estimateDefaultMeasurementsCm,
} from './bodyProportions';

const half = (inches) => Math.round(inches * 2) / 2;

/**
 * @param profile   profiles row (height_cm, weight_kg, sex, *_cm, dream_target_*)
 * @param weightKg  the weight to draw (e.g. nearest weigh-in), defaults to the profile's
 * @returns { currentData, targetData|null, targetKg|null, bodyFatPct, stats }
 */
export function buildBodyModel(profile, weightKg) {
  const heightCm = Number(profile?.height_cm) || 175;
  const w = Number(weightKg) || Number(profile?.weight_kg) || 75;
  const sex = profile?.sex === 'female' ? 'female' : 'male';

  const est = estimateDefaultMeasurementsCm({ heightCm, weightKg: w, sex });
  const waistIn0 = half(Number(profile?.waist_cm || est.waistCm) / 2.54);
  const hipIn = half(Number(profile?.hip_cm || est.hipCm) / 2.54);
  const chestIn = half(Number(profile?.chest_cm || est.chestCm) / 2.54);
  const bicepIn = half(Number(profile?.bicep_cm || est.bicepCm) / 2.54);

  const chestCm = chestIn * 2.54;
  const hipCm = hipIn * 2.54;
  const minWaistIn = Math.max(26, Math.ceil((minWaistCmForBfFloor({ heightCm, weightKg: w, chestCm, hipCm, sex }) / 2.54) * 2) / 2);
  const waistCm = Math.max(waistIn0, minWaistIn) * 2.54;
  const bicepCm = bicepIn * 2.54;

  const stats = analyzeCurrentPhysique({ heightCm, weightKg: w, sex, waistCm, hipCm, chestCm, bicepCm });
  const currentData = { sex, heightCm, weightKg: w, chestCm, waistCm, hipCm, bicepCm, bodyFatPct: stats.bodyFatPct };

  const targetKg = profile?.dream_target_weight_kg ? Number(profile.dream_target_weight_kg) : null;
  if (!targetKg) return { currentData, targetData: null, targetKg: null, bodyFatPct: stats.bodyFatPct, stats };

  const dateStr = profile?.dream_target_date ? String(profile.dream_target_date).slice(0, 10) : null;
  const daysAvailable = dateStr
    ? Math.max(1, Math.ceil((new Date(`${dateStr}T00:00:00`) - new Date()) / 86400000))
    : Math.max(7, Math.round((Math.abs(w - targetKg) / 0.85) * 7));

  const forecast = projectScientificDream({
    currentSpecs: { weightKg: w, waistCm, hipCm, chestCm, bicepCm, ...stats },
    targetWeightKg: targetKg,
    heightCm,
    sex,
    daysAvailable,
  });

  return {
    currentData,
    targetKg,
    bodyFatPct: stats.bodyFatPct,
    stats,
    targetData: {
      sex,
      heightCm,
      weightKg: targetKg,
      chestCm: forecast.dimensions.chestCm,
      waistCm: forecast.dimensions.waistCm,
      hipCm: forecast.dimensions.hipCm,
      bicepCm: forecast.dimensions.bicepCm,
      bodyFatPct: forecast.targetBfPct,
    },
  };
}
