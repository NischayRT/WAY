/**
 * lib/currentPhysiqueLogic.js
 * Body type for the CURRENT avatar.
 *
 * Classification is sex-aware (see lib/physiqueClassifier.js). The old
 * version compared chest to waist with male-only thresholds, so a woman's
 * bust was read as a "V-taper" and her healthy body fat could be read as
 * obese (the male obese line is 25%, the female one is 32%).
 *
 * fallbackIndex = mesh slot in the GLB (see lib/bodyModels.js). The same
 * slots are used for the male and female files.
 */

import { classifyPhysique } from './physiqueClassifier';
import { MESH_SLOT } from './bodyModels';

export const CURRENT_ARCHETYPES = {
  SLIM: {
    key: 'SLIM',
    fallbackIndex: MESH_SLOT.SLIM,
    label: 'Slim / Skinny',
    scaleBoost: { x: 0.86, z: 0.86, waist: 0.85, chest: 0.85, arm: 0.88 },
  },
  SOFT_BELLY: {
    key: 'SOFT_BELLY',
    fallbackIndex: MESH_SLOT.SOFT_BELLY,
    // Now means "body fat in the ACE 'average' band" (men 18–24%, women
    // 25–31%), which is not overweight, so the label says so.
    label: 'Average / Soft Belly',
    scaleBoost: { x: 1.08, z: 1.14, waist: 1.16, chest: 0.98, arm: 0.95 },
  },
  OBESE: {
    key: 'OBESE',
    fallbackIndex: MESH_SLOT.OBESE,
    label: 'Heavyset / Obese',
    scaleBoost: { x: 1.22, z: 1.28, waist: 1.3, chest: 1.05, arm: 1.05 },
  },
  LEAN: {
    key: 'LEAN',
    fallbackIndex: MESH_SLOT.LEAN,
    label: 'Lean / Athletic',
    scaleBoost: { x: 0.98, z: 0.96, waist: 0.94, chest: 1.06, arm: 1.02 },
  },
  MUSCULAR: {
    key: 'MUSCULAR',
    fallbackIndex: MESH_SLOT.MUSCULAR,
    label: 'Muscular',
    scaleBoost: { x: 1.15, z: 1.02, waist: 0.92, chest: 1.25, arm: 1.22 },
  },
};

export function resolveCurrentPhysique({
  sex = 'male',
  chestCm,
  waistCm,
  hipCm,
  heightCm,
  weightKg,
  bodyFatPct,
}) {
  const { key } = classifyPhysique({ sex, heightCm, weightKg, bodyFatPct, waistCm, hipCm, chestCm });
  return CURRENT_ARCHETYPES[key];
}
