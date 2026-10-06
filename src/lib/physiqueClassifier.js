/**
 * lib/physiqueClassifier.js
 *
 * One sex-aware classifier shared by the CURRENT and TARGET 3D bodies.
 * Every threshold below is split by sex because the underlying science is:
 * women carry roughly 7–10 percentage points more body fat than men at the
 * same level of fitness, and have less fat-free mass per metre of height.
 *
 * Sources for the cut-offs:
 *  - Body fat bands: American Council on Exercise (ACE) body-fat chart.
 *      Men:   essential 2–5, athletes 6–13, fitness 14–17, average 18–24, obese 25+
 *      Women: essential 10–13, athletes 14–20, fitness 21–24, average 25–31, obese 32+
 *  - Fat-free mass index (FFMI): Kouri et al. 1995 (men: ~19–20 typical,
 *    ~22+ clearly muscular, ~25 natural ceiling); female reference data put
 *    typical women at ~15–16 and clearly muscular women at ~18+.
 *  - BMI < 18.5 = underweight (WHO). This is the only place BMI decides
 *    anything on its own: BMI cannot tell fat from muscle, and body fat %
 *    from the US Navy tape method (which already uses waist, neck and, for
 *    women, hips) is the better signal for everything else.
 *  - Waist-to-height ratio >= 0.6 = substantially increased cardiometabolic
 *    risk (Ashwell et al.). The same cut-off holds for both sexes and across
 *    ethnic groups including South Asians, so it can promote a body to
 *    "obese" even when the tape-based body-fat estimate reads lower.
 */

export const BODY_FAT_BANDS = {
  male: { athletes: 6, fitness: 14, average: 18, obese: 25 },
  female: { athletes: 14, fitness: 21, average: 25, obese: 32 },
};

export const FFMI_BANDS = {
  male: { low: 17, muscular: 21.5 },
  female: { low: 14, muscular: 18 },
};

export const UNDERWEIGHT_BMI = 18.5;
export const HIGH_RISK_WAIST_TO_HEIGHT = 0.6;

const normSex = (sex) => (sex === 'female' ? 'female' : 'male');
const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Which ACE band a body-fat percentage falls in, for display. */
export function bodyFatCategory(bodyFatPct, sex) {
  const b = BODY_FAT_BANDS[normSex(sex)];
  const bf = Number(bodyFatPct);
  if (!Number.isFinite(bf)) return null;
  if (bf >= b.obese) return 'Obese range';
  if (bf >= b.average) return 'Average';
  if (bf >= b.fitness) return 'Fitness';
  if (bf >= b.athletes) return 'Athletic';
  return 'Essential fat';
}

/**
 * @returns {{ key: 'SLIM'|'SOFT_BELLY'|'OBESE'|'LEAN'|'MUSCULAR', sex: string,
 *   bmi: number, ffmi: number, waistToHeight: number|null, bfCategory: string|null }}
 */
export function classifyPhysique({ sex, heightCm, weightKg, bodyFatPct, waistCm }) {
  const s = normSex(sex);
  const bands = BODY_FAT_BANDS[s];
  const ffmiBands = FFMI_BANDS[s];

  const h = num(heightCm, s === 'female' ? 162 : 175);
  const w = num(weightKg, s === 'female' ? 60 : 75);
  const hM = h / 100;
  const bmi = w / (hM * hM);
  // When body fat is unknown, use the middle of the "average" band for
  // this sex rather than a male default.
  const bf = num(bodyFatPct, s === 'female' ? 28 : 21);
  const ffmi = (w * (1 - bf / 100)) / (hM * hM);
  const waistToHeight = Number(waistCm) > 0 ? Number(waistCm) / h : null;

  let key;
  if (bf >= bands.obese || (waistToHeight !== null && waistToHeight >= HIGH_RISK_WAIST_TO_HEIGHT)) {
    key = 'OBESE';
  } else if (bmi < UNDERWEIGHT_BMI || (bmi < 20 && ffmi < ffmiBands.low)) {
    key = 'SLIM';
  } else if (ffmi >= ffmiBands.muscular && bf < bands.average) {
    key = 'MUSCULAR';
  } else if (bf >= bands.average) {
    key = 'SOFT_BELLY';
  } else {
    key = 'LEAN';
  }

  return {
    key,
    sex: s,
    bmi: Math.round(bmi * 10) / 10,
    ffmi: Math.round(ffmi * 10) / 10,
    waistToHeight: waistToHeight !== null ? Math.round(waistToHeight * 100) / 100 : null,
    bfCategory: bodyFatCategory(bf, s),
  };
}
