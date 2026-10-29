/**
 * lib/units.js
 * Display units. Everything is stored and calculated in cm and kg; these
 * helpers only convert what people see and type.
 *
 *   height: 'cm' | 'ftin'   weight: 'kg' | 'lb'   length (body measurements): 'cm' | 'in'
 */

export const DEFAULT_UNITS = { height: 'cm', weight: 'kg', length: 'cm' };
export const UNIT_CHOICES = {
  height: [
    ['cm', 'cm'],
    ['ftin', 'ft · in'],
  ],
  weight: [
    ['kg', 'kg'],
    ['lb', 'lb'],
  ],
  length: [
    ['cm', 'cm'],
    ['in', 'in'],
  ],
};

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function normalizeUnits(u) {
  const out = { ...DEFAULT_UNITS };
  for (const kind of Object.keys(UNIT_CHOICES)) {
    if (u && UNIT_CHOICES[kind].some(([v]) => v === u[kind])) out[kind] = u[kind];
  }
  return out;
}

const round = (v, dec) => {
  const f = 10 ** dec;
  return Math.round(v * f) / f;
};
/** Trim trailing zeros: 72.0 -> "72", 72.50 -> "72.5". */
const num = (v, dec) => String(round(v, dec));

/* ---------- weight ---------- */
export const weightUnit = (u) => (u?.weight === 'lb' ? 'lb' : 'kg');
export const kgToDisplay = (kg, u) => (kg == null || kg === '' || !Number.isFinite(Number(kg)) ? null : u?.weight === 'lb' ? Number(kg) / KG_PER_LB : Number(kg));
export const displayToKg = (v, u) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : u?.weight === 'lb' ? Number(v) * KG_PER_LB : Number(v));
/** "72.5 kg" / "159.8 lb". A weight difference converts the same way. */
export function fmtWeight(kg, u, dec = 1, withUnit = true) {
  const v = kgToDisplay(kg, u);
  if (v == null) return '—';
  return withUnit ? `${num(v, dec)} ${weightUnit(u)}` : num(v, dec);
}
/** Number only, fixed decimals (for aligned columns): "72.5" / "159.8". */
export const fmtWeightFixed = (kg, u, dec = 1) => {
  const v = kgToDisplay(kg, u);
  return v == null ? '—' : v.toFixed(dec);
};

/* ---------- height ---------- */
export function cmToFtIn(cm) {
  const total = Number(cm) / CM_PER_IN;
  let ft = Math.floor(total / 12);
  let inch = Math.round(total - ft * 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return { ft, inch };
}
export const ftInToCm = (ft, inch) => (Number(ft) || 0) * 12 * CM_PER_IN + (Number(inch) || 0) * CM_PER_IN;
/** "175 cm" / "5′ 9″". */
export function fmtHeight(cm, u) {
  if (cm == null || cm === '' || !Number.isFinite(Number(cm)) || Number(cm) <= 0) return '—';
  if (u?.height === 'ftin') {
    const { ft, inch } = cmToFtIn(cm);
    return `${ft}′ ${inch}″`;
  }
  return `${Math.round(Number(cm))} cm`;
}

/* ---------- body measurements ---------- */
export const lengthUnit = (u) => (u?.length === 'in' ? 'in' : 'cm');
export const cmToLength = (cm, u) => (cm == null || !Number.isFinite(Number(cm)) ? null : u?.length === 'in' ? Number(cm) / CM_PER_IN : Number(cm));
export const lengthToCm = (v, u) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : u?.length === 'in' ? Number(v) * CM_PER_IN : Number(v));
/** "81 cm" / "32″" (inches to the nearest half). */
export function fmtLength(cm, u) {
  const v = cmToLength(cm, u);
  if (v == null) return '—';
  return u?.length === 'in' ? `${num(Math.round(v * 2) / 2, 1)}″` : `${Math.round(v)} cm`;
}
/** A signed change in body measurement: "−2.5 cm" / "−1″". */
export function fmtLengthDelta(cmDelta, u) {
  const v = cmToLength(Math.abs(cmDelta), u);
  const sign = cmDelta <= 0 ? '−' : '+';
  return u?.length === 'in' ? `${sign}${num(Math.round(v * 2) / 2, 1)}″` : `${sign}${num(v, 1)} cm`;
}
