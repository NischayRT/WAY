/**
 * lib/bodyAge.js
 *
 * Body Age: an "effective age" in the same sense as WHOOP Age. It is the age at
 * which an average person would carry the same all-cause mortality risk as
 * you, given how you sleep, move, and how fit and lean you are.
 *
 * How it works
 *  1. Each metric is turned into a HAZARD RATIO against a health-optimised
 *     target (meeting the target = 1.0 = 0 years), using dose-response
 *     figures from large meta-analyses and cohorts (see EVIDENCE).
 *  2. Hazard ratios become years with the Gompertz law: adult mortality rises
 *     about 9.5% a year (doubling every ~7.3 years), so
 *         years = ln(HR) / 0.095        e.g. HR 1.22 -> +2.1 y, 0.85 -> -1.7 y
 *  3. Overlap is discounted twice. Within a group (VO2 max + resting heart
 *     rate; steps + zone minutes; two tape-based body measures) by the
 *     group's shrink factor, and across groups by 0.65, because lifestyle
 *     factors cluster (low steps tends to come with low fitness and a larger
 *     waist). Calibrated so that all-good vs all-poor habits spans roughly
 *     +/-10 years, in line with cohort studies of combined lifestyle factors
 *     (e.g. Li et al. 2018, Circulation: 0 vs 5 healthy factors ~ 2.5-3x
 *     mortality) and WHOOP's report that people in poor vs excellent
 *     self-rated health sit ~5 years either side of their real age.
 *  4. Each metric is capped at +/-3 years; the total stays within 15 years of
 *     real age. A +/- range reflects how strong each piece of evidence is.
 *  5. Pace of Aging compares the last 30 days with the last 180: if the next
 *     six months look like the last month, how fast will Body Age move per
 *     year of real time? 1.0 = in step with real age, < 1 slower, < 0 getting
 *     younger. A single month is noisy, so its difference counts half.
 *
 * It is a lifestyle risk estimate, not a medical test or a measure of
 * cellular ageing.
 */

export const GOMPERTZ_B = 0.095;
const METRIC_CAP_YEARS = 3;
const TOTAL_CAP_YEARS = 15;
const CROSS_GROUP_SHRINK = 0.65;
const RECENT_WEIGHT = 0.5;

/** Log-linear interpolation of a hazard curve given as [[x, HR], ...] (x ascending). */
function curve(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, h1] = points[i];
    const [x0, h0] = points[i - 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return Math.exp(Math.log(h0) + t * (Math.log(h1) - Math.log(h0)));
    }
  }
  return points[points.length - 1][1];
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const yearsOf = (hr) => clamp(Math.log(hr) / GOMPERTZ_B, -METRIC_CAP_YEARS, METRIC_CAP_YEARS);

/** Targets that depend on age and sex. */
export function targetsFor(age, sex) {
  const female = sex === 'female';
  const over30 = Math.max(0, age - 30);
  return {
    steps: age >= 60 ? 6000 : 8000,
    // VO2 max: WHOOP's published 30-year-old targets (44 men / 38 women),
    // declining ~0.35 / 0.3 ml/kg/min a year after 30 as in FRIEND norms.
    vo2: Math.max(female ? 22 : 25, (female ? 38 : 44) - (female ? 0.3 : 0.35) * over30),
    leanPct: (female ? 67 : 80) - 0.1 * over30,
    restingHr: 60,
    sleepMin: 7,
    sleepMax: 8.5,
    moderateMinWeek: 150,
    vigorousMinWeek: 75,
    strengthMinWeek: 60,
    whtr: 0.5,
  };
}

/**
 * Hazard ratio for each metric, relative to its target (1.0 at target).
 * Each returns { hr, note } or null if the input is missing.
 */
const METRICS = {
  // Paluch et al. 2022, Lancet Public Health (15 cohorts, 47,471 adults):
  // step-count quartiles 3.6k / 5.8k / 7.8k / 10.9k -> HR 1 / 0.60 / 0.55 / 0.47.
  // Re-based to ~8k = 1.0; benefits plateau above ~11k (6-8k for 60+).
  steps: (v, t) => {
    const s = (v * 8000) / t.steps; // older adults' curve shifted to their lower plateau
    return curve([[2000, 2.6], [3550, 1.82], [5800, 1.09], [7840, 1.0], [10900, 0.855], [15000, 0.855]], s);
  },
  // Arem et al. 2015, JAMA Intern Med (661,137 adults): leisure MVPA vs none
  // <150 min 0.80, 150-300 0.69, 300-450 0.63, 450-750 0.61. Re-based to 150 min.
  moderateMinWeek: (v) => curve([[0, 1.45], [75, 1.16], [150, 1.0], [300, 0.91], [450, 0.88], [2000, 0.88]], v),
  // Gebel et al. 2015, JAMA Intern Med: some vigorous activity on top of
  // moderate is linked to a further ~9-13% lower mortality.
  vigorousMinWeek: (v) => curve([[0, 1.1], [37, 1.05], [75, 1.0], [150, 0.95], [1000, 0.95]], v),
  // Momma et al. 2022, BJSM meta-analysis: muscle-strengthening 30-60 min/week
  // is linked to ~10-20% lower all-cause mortality; J-shaped beyond ~140 min.
  strengthMinWeek: (v) => curve([[0, 1.2], [30, 1.05], [60, 1.0], [130, 1.0], [180, 1.03], [300, 1.08]], v),
  // Cappuccio et al. 2010, Sleep (1.38M people): short sleep RR 1.12, long
  // sleep RR 1.30; lowest risk around 7-8 hours.
  sleepHours: (v) => curve([[4.5, 1.25], [5.5, 1.15], [6, 1.12], [6.5, 1.05], [7, 1.0], [8.5, 1.0], [9, 1.1], [9.5, 1.2], [10, 1.3], [14, 1.3]], v),
  // Windred et al. 2024, Sleep (UK Biobank, ~61k): irregular sleep timing was
  // linked to 20-48% higher mortality vs regular. Measured here as the spread
  // (standard deviation, minutes) of each night's sleep midpoint.
  sleepMidpointSdMin: (v) => curve([[15, 0.9], [30, 0.92], [45, 0.97], [60, 1.0], [90, 1.2], [120, 1.45], [200, 1.5]], v),
  // Aune et al. 2017, Nutr Metab Cardiovasc Dis (meta-analysis): every 10 bpm
  // higher resting heart rate -> 17% higher all-cause mortality. No further
  // credit below 50 bpm (athletes).
  restingHr: (v, t) => Math.pow(1.17, (clamp(v, 50, 100) - t.restingHr) / 10),
  // Kodama et al. 2009, JAMA (33 studies, 102,980 people): each 1 MET
  // (3.5 ml/kg/min) of cardiorespiratory fitness -> 13% lower mortality.
  vo2: (v, t) => Math.pow(0.87, clamp((v - t.vo2) / 3.5, -3, 3)),
  // Lean (fat-free) mass share. Higher body fat / lower muscle mass are linked
  // to higher mortality (e.g. Srikanthan & Karlamangla 2014; Lee & Giovannucci).
  // Conservative: +10% risk per 5 points below target, -3% per 5 above (to 10).
  leanPct: (v, t) => {
    const d = v - t.leanPct;
    return d < 0 ? Math.pow(1.1, -d / 5) : Math.pow(0.97, Math.min(d, 10) / 5);
  },
  // Waist-to-height ratio (Jayedi et al. 2020, BMJ: central adiposity and
  // mortality; WHtR 0.5 is the cut-off used for South Asians). ~24% higher
  // risk per 0.1 above 0.5. A WAY Studio addition (WHOOP doesn't use it).
  whtr: (v, t) => (v <= t.whtr ? 1 : Math.pow(1.24, (v - t.whtr) / 0.1)),
};

/** How strong each evidence base is (share of the effect used as +/- range). */
const EVIDENCE_SPREAD = {
  steps: 0.25,
  moderateMinWeek: 0.25,
  vigorousMinWeek: 0.4,
  strengthMinWeek: 0.35,
  sleepHours: 0.3,
  sleepMidpointSdMin: 0.45,
  restingHr: 0.25,
  vo2: 0.2,
  leanPct: 0.4,
  whtr: 0.3,
};

/**
 * Overlap groups. Within a group the summed years are multiplied by `shrink`
 * so shared signal isn't counted twice (WHOOP fits this from member data;
 * these fixed values are conservative stand-ins).
 */
export const GROUPS = [
  { key: 'fitness', label: 'Cardio fitness', metrics: ['vo2', 'restingHr'], shrink: 0.7 },
  { key: 'activity', label: 'Activity', metrics: ['steps', 'moderateMinWeek', 'vigorousMinWeek'], shrink: 0.6 },
  { key: 'strength', label: 'Strength', metrics: ['strengthMinWeek'], shrink: 1 },
  { key: 'sleep', label: 'Sleep', metrics: ['sleepHours', 'sleepMidpointSdMin'], shrink: 0.85 },
  { key: 'body', label: 'Body composition', metrics: ['leanPct', 'whtr'], shrink: 0.6 },
];

export const METRIC_LABELS = {
  steps: { label: 'Daily steps', unit: 'steps/day', decimals: 0 },
  moderateMinWeek: { label: 'Zone minutes, moderate (fat burn)', unit: 'min/week', decimals: 0 },
  vigorousMinWeek: { label: 'Zone minutes, vigorous (cardio + peak)', unit: 'min/week', decimals: 0 },
  strengthMinWeek: { label: 'Strength training', unit: 'min/week', decimals: 0 },
  sleepHours: { label: 'Hours of sleep', unit: 'h/night', decimals: 1 },
  sleepMidpointSdMin: { label: 'Sleep consistency (timing spread)', unit: 'min', decimals: 0 },
  restingHr: { label: 'Resting heart rate', unit: 'bpm', decimals: 0 },
  vo2: { label: 'VO₂ max (Cardio Fitness Score)', unit: 'ml/kg/min', decimals: 1 },
  leanPct: { label: 'Lean body mass', unit: '% of weight', decimals: 0 },
  whtr: { label: 'Waist-to-height ratio', unit: '', decimals: 2 },
};

/** Years from a set of metric values (one window). */
function score(values, t) {
  const perMetric = {};
  for (const [k, fn] of Object.entries(METRICS)) {
    if (values[k] == null || !Number.isFinite(Number(values[k]))) continue;
    const hr = fn(Number(values[k]), t);
    perMetric[k] = { hr, rawYears: yearsOf(hr) };
  }
  let total = 0;
  let spreadSq = 0;
  const groups = GROUPS.map((g) => {
    const present = g.metrics.filter((m) => perMetric[m]);
    const raw = present.reduce((a, m) => a + perMetric[m].rawYears, 0);
    const years = raw * g.shrink * CROSS_GROUP_SHRINK;
    for (const m of present) {
      perMetric[m].years = perMetric[m].rawYears * g.shrink * CROSS_GROUP_SHRINK;
      spreadSq += Math.pow(EVIDENCE_SPREAD[m] * perMetric[m].years, 2);
    }
    total += years;
    return { ...g, years, present };
  });
  return { perMetric, groups, total, spread: Math.sqrt(spreadSq) };
}

/**
 * @param {object} p
 *   age, sex
 *   long:   metric values averaged over the last ~180 days
 *   recent: the same over the last 30 days (for Pace of Aging)
 * @returns { bodyAge, chronologicalAge, difference, range, pace, contributors[], groups[] }
 */
export function computeBodyAge({ age, sex, long, recent }) {
  const t = targetsFor(age, sex);
  const L = score(long, t);
  const R = score({ ...long, ...recent }, t);

  const delta = clamp(L.total, -TOTAL_CAP_YEARS, TOTAL_CAP_YEARS);
  const bodyAge = Math.max(18, age + delta);
  // +/-: evidence strength, plus a floor for wearable measurement noise.
  const range = Math.max(0.5, Math.round((Math.sqrt(L.spread * L.spread + 0.6 * 0.6)) * 2) / 2);

  // Pace: over the next 6 months Body Age moves (0.5 + recent - long) years.
  const pace = clamp(1 + ((R.total - L.total) * RECENT_WEIGHT) / 0.5, -1, 3);

  const contributors = Object.entries(L.perMetric)
    .map(([k, m]) => ({
      key: k,
      ...METRIC_LABELS[k],
      value: long[k],
      recent: recent?.[k] ?? null,
      target: targetLabel(k, t),
      hazardRatio: Math.round(m.hr * 100) / 100,
      years: Math.round(m.years * 10) / 10,
      recentYears: R.perMetric[k] ? Math.round(R.perMetric[k].years * 10) / 10 : null,
    }))
    .sort((a, b) => Math.abs(b.years) - Math.abs(a.years));

  return {
    chronologicalAge: age,
    bodyAge: Math.round(bodyAge * 10) / 10,
    difference: Math.round((bodyAge - age) * 10) / 10,
    range,
    pace: Math.round(pace * 10) / 10,
    contributors,
    groups: L.groups.map((g) => ({ key: g.key, label: g.label, years: Math.round(g.years * 10) / 10 })),
  };
}

function targetLabel(k, t) {
  switch (k) {
    case 'steps':
      return `${t.steps.toLocaleString('en-IN')}+`;
    case 'moderateMinWeek':
      return `${t.moderateMinWeek}+`;
    case 'vigorousMinWeek':
      return `${t.vigorousMinWeek}+`;
    case 'strengthMinWeek':
      return `${t.strengthMinWeek}-130`;
    case 'sleepHours':
      return `${t.sleepMin}-${t.sleepMax}`;
    case 'sleepMidpointSdMin':
      return 'under 60';
    case 'restingHr':
      return `${t.restingHr} or lower`;
    case 'vo2':
      return `${t.vo2.toFixed(0)}+`;
    case 'leanPct':
      return `${t.leanPct.toFixed(0)}%+`;
    case 'whtr':
      return `under ${t.whtr}`;
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/* Prerequisites: Body Age is shown only when all of these are met.    */
/* ------------------------------------------------------------------ */

export const REQUIREMENTS = [
  { key: 'profile', label: 'Age, sex, height and weight in your profile' },
  { key: 'measurements', label: 'Waist (and hips for women) in Body Studio, for lean mass' },
  { key: 'steps', label: 'Steps on at least 28 days', min: 28 },
  { key: 'zones', label: 'Heart-rate zone data on at least 28 days', min: 28 },
  { key: 'restingHr', label: 'Resting heart rate on at least 28 days', min: 28 },
  { key: 'sleep', label: 'Sleep tracked on at least 28 nights', min: 28 },
  { key: 'recent', label: 'Wearing your tracker on at least 14 of the last 30 days', min: 14 },
  { key: 'vo2', label: 'A VO₂ max (Cardio Fitness Score) in the last 90 days', min: 1 },
];
