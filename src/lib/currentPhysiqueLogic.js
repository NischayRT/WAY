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
  },
  SOFT_BELLY: {
    key: 'SOFT_BELLY',
    fallbackIndex: MESH_SLOT.SOFT_BELLY,
    // Now means "body fat in the ACE 'average' band" (men 18–24%, women
    // 25–31%), which is not overweight, so the label says so.
    label: 'Average / Soft Belly',
  },
  OBESE: {
    key: 'OBESE',
    fallbackIndex: MESH_SLOT.OBESE,
    label: 'Heavyset / Obese',
  },
  LEAN: {
    key: 'LEAN',
    fallbackIndex: MESH_SLOT.LEAN,
    label: 'Lean / Athletic',
  },
  MUSCULAR: {
    key: 'MUSCULAR',
    fallbackIndex: MESH_SLOT.MUSCULAR,
    label: 'Muscular',
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
