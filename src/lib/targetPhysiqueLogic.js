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
    visualBoost: { waist: 0.95, chest: 1.05, arm: 1.0 },
  },
  SOFT_BELLY: {
    key: 'SOFT_BELLY',
    meshIndex: MESH_SLOT.SOFT_BELLY,
    label: 'Average / Soft Belly',
    visualBoost: { waist: 1.15, chest: 0.98, arm: 0.92 },
  },
  OBESE: {
    key: 'OBESE',
    meshIndex: MESH_SLOT.OBESE,
    label: 'Heavyset / Obese',
    visualBoost: { waist: 1.1, chest: 1.05, arm: 1.0 },
  },
  MUSCULAR: {
    key: 'MUSCULAR',
    meshIndex: MESH_SLOT.MUSCULAR,
    label: 'Muscular',
    visualBoost: { waist: 0.92, chest: 1.22, arm: 1.2 },
  },
  SLIM: {
    key: 'SLIM',
    meshIndex: MESH_SLOT.SLIM,
    label: 'Slim / Skinny',
    visualBoost: { waist: 0.85, chest: 0.85, arm: 0.85 },
  },
};

export function resolveTargetPhysique({ sex = 'male', bodyFatPct, weightKg, heightCm, chestCm, waistCm, hipCm }) {
  const { key } = classifyPhysique({ sex, heightCm, weightKg, bodyFatPct, waistCm, hipCm, chestCm });
  return TARGET_ARCHETYPES[key];
}
