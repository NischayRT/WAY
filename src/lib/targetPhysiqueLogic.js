/**
 * lib/targetPhysiqueLogic.js
 * Body type for the TARGET / DREAM avatar.
 *
 * Uses the same sex-aware classifier as the current body, applied to the
 * projected weight, body fat and waist, so "Now" and "Goal" can never
 * disagree about what a body type means. meshIndex = slot in the GLB
 * (lib/bodyModels.js); the old indices sent "Soft belly" and "Muscular"
 * to the lean mesh.
 */

import { classifyPhysique } from './physiqueClassifier';
import { MESH_SLOT } from './bodyModels';

export const TARGET_ARCHETYPES = {
  LEAN: {
    key: 'LEAN',
    meshIndex: MESH_SLOT.LEAN,
    label: 'Lean / Athletic',
  },
  SOFT_BELLY: {
    key: 'SOFT_BELLY',
    meshIndex: MESH_SLOT.SOFT_BELLY,
    label: 'Average / Soft Belly',
  },
  OBESE: {
    key: 'OBESE',
    meshIndex: MESH_SLOT.OBESE,
    label: 'Heavyset / Obese',
  },
  MUSCULAR: {
    key: 'MUSCULAR',
    meshIndex: MESH_SLOT.MUSCULAR,
    label: 'Muscular',
  },
  SLIM: {
    key: 'SLIM',
    meshIndex: MESH_SLOT.SLIM,
    label: 'Slim / Skinny',
  },
};

export function resolveTargetPhysique({ sex = 'male', bodyFatPct, weightKg, heightCm, chestCm, waistCm, hipCm }) {
  const { key } = classifyPhysique({ sex, heightCm, weightKg, bodyFatPct, waistCm, hipCm, chestCm });
  return TARGET_ARCHETYPES[key];
}
