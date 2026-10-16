/**
 * lib/readiness.js
 *
 * Readiness, Recovery and Sleep consistency for the Healthspan panel.
 *
 * Google Health's own Daily Readiness score is NOT available through the
 * Google Health API (only in the app and Takeout). It is built from heart
 * rate variability, resting heart rate and recent sleep, so this computes a
 * transparent proxy from the same three signals, each judged against the
 * person's OWN recent baseline (not population norms):
 *
 *   HRV        today vs your 30-day baseline (higher = more recovered)   40%
 *   Resting HR today vs your 30-day baseline (lower = more recovered)    30%
 *   Sleep      last night and the last 3 nights vs ~7.5 h                30%
 *
 * Each part maps "at your normal" to ~65 and moves ~20 points per standard
 * deviation, so 0-100 lines up with Fitbit's bands: 65+ ready, 30-64 fair,
 * under 30 low (rest).
 *
 * Readiness is deliberately NOT used inside Body Age: it describes how
 * recovered you are today, while Body Age is long-term risk from 30-day
 * habits. Mixing them would let one bad night move your Body Age.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / (a.length - 1));
};

const SLEEP_NEED_MIN = 450; // 7.5 h
const BASELINE_DAYS = 30;
const MIN_BASELINE = 7;

/**
 * @param byDay Map/Object date -> { hrv?, rhr?, sleepMin? }
 * @param dateStr the day to score
 * @param dates   sorted ascending list of all dates available
 * @returns { score, parts: { hrv, rhr, sleep }, values } | null
 */
export function readinessOn(byDay, dateStr, dates) {
  const today = byDay[dateStr];
  if (!today) return null;
  const prior = dates.filter((d) => d < dateStr).slice(-BASELINE_DAYS).map((d) => byDay[d]);

  const parts = {};
  const weights = {};

  const hrvBase = prior.map((x) => x.hrv).filter((v) => v > 0);
  if (today.hrv > 0 && hrvBase.length >= MIN_BASELINE) {
    const z = (today.hrv - mean(hrvBase)) / Math.max(sd(hrvBase) || 0, 3);
    parts.hrv = clamp(65 + 20 * z, 0, 100);
    weights.hrv = 0.4;
  }
  const rhrBase = prior.map((x) => x.rhr).filter((v) => v > 0);
  if (today.rhr > 0 && rhrBase.length >= MIN_BASELINE) {
    const z = (mean(rhrBase) - today.rhr) / Math.max(sd(rhrBase) || 0, 1.5);
    parts.rhr = clamp(65 + 20 * z, 0, 100);
    weights.rhr = 0.3;
  }
  if (today.sleepMin > 0) {
    const last3 = [...prior.slice(-2).map((x) => x.sleepMin).filter((v) => v > 0), today.sleepMin];
    const night = Math.min(1.1, today.sleepMin / SLEEP_NEED_MIN);
    const recent = Math.min(1.1, mean(last3) / SLEEP_NEED_MIN);
    parts.sleep = clamp(100 * (0.6 * night + 0.4 * recent) - 10, 0, 100);
    weights.sleep = 0.3;
  }

  const w = Object.values(weights).reduce((a, b) => a + b, 0);
  // Needs HRV or resting HR plus something else to be meaningful.
  if (w < 0.6 || (!parts.hrv && !parts.rhr)) return null;
  const score = Object.entries(parts).reduce((a, [k, v]) => a + v * weights[k], 0) / w;
  return {
    score: Math.round(score),
    parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v)])),
    values: { hrv: today.hrv ?? null, rhr: today.rhr ?? null, sleepMin: today.sleepMin ?? null },
  };
}

export function readinessBand(score) {
  if (score == null) return null;
  if (score >= 65) return { key: 'high', label: 'Ready' };
  if (score >= 30) return { key: 'fair', label: 'Fair' };
  return { key: 'low', label: 'Rest today' };
}

/** Sleep consistency as a percentage from the spread (SD, minutes) of sleep midpoints. 70%+ is the target. */
export function sleepConsistencyPct(midpointSdMin) {
  if (midpointSdMin == null) return null;
  return Math.round(clamp(100 - 0.8 * midpointSdMin, 0, 100));
}

/**
 * @param days [{ date, hrv, rhr, sleepMin }] (any order, may have gaps)
 * @param todayStr
 */
export function computeRecovery(days, todayStr) {
  const byDay = {};
  for (const d of days) byDay[d.date] = { ...(byDay[d.date] || {}), ...d };
  const dates = Object.keys(byDay).sort();

  // Today's score, else the latest day that has one (readiness is set after waking).
  let today = null;
  for (let i = dates.length - 1; i >= 0 && dates[i] >= shift(todayStr, -2); i -= 1) {
    const r = readinessOn(byDay, dates[i], dates);
    if (r) {
      today = { ...r, date: dates[i] };
      break;
    }
  }
  const daily = dates
    .filter((d) => d >= shift(todayStr, -13))
    .map((d) => ({ date: d, score: readinessOn(byDay, d, dates)?.score ?? null }));
  const week = daily.filter((x) => x.date > shift(todayStr, -7) && x.score != null).map((x) => x.score);
  const prevWeek = daily.filter((x) => x.date <= shift(todayStr, -7) && x.score != null).map((x) => x.score);
  const recovery = week.length >= 3 ? Math.round(mean(week)) : null;
  const yesterday = daily.filter((x) => x.score != null && today && x.date < today.date).slice(-1)[0]?.score ?? null;

  return {
    readiness: today ? { ...today, band: readinessBand(today.score), yesterday } : null,
    recovery:
      recovery == null
        ? null
        : {
            score: recovery,
            band: readinessBand(recovery),
            change: prevWeek.length >= 3 ? Math.round(recovery - mean(prevWeek)) : null,
            daily: daily.slice(-7),
          },
  };
}

function shift(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
