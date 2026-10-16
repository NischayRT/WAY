/**
 * lib/dailyLoad.js — Recovery, Strain and Sleep (WHOOP-style), from data a
 * Fitbit / Pixel Watch already sends to Google Health. No extra permissions:
 * HRV and resting heart rate (health metrics), Active Zone Minutes and steps
 * (activity), sleep sessions (optional sleep permission).
 *
 * RECOVERY (0–100 %)
 *   lib/readiness.js: last night's HRV and resting heart rate against YOUR
 *   own 30-day baseline (z-scores) plus sleep vs need. Bands as WHOOP:
 *   67+ green, 34–66 yellow, under 34 red. Needs 7+ baseline nights.
 *
 * STRAIN (0–21)
 *   Cardiovascular load for the day as a TRIMP (training impulse, Banister /
 *   Edwards): minutes in each heart-rate zone weighted by intensity, plus a
 *   small load from walking below the zones:
 *       load = 20 (a day's baseline) + steps/1000
 *            + 2 × fat-burn min + 3.5 × cardio min + 5 × peak min
 *   then put on WHOOP's diminishing 0–21 scale (each extra point is harder):
 *       strain = 21 × (1 − e^(−load / 150))
 *   Calibration: quiet day ≈ 3, 10k steps + 30 min cardio ≈ 12,
 *   1 h hard run ≈ 17–18, all-day race ≈ 20+.
 *   Fitbit's zones already use your own resting/max heart rate.
 *
 * STRAIN TARGET (from recovery, as WHOOP does)
 *   green 14–18 (push), yellow 10–14 (maintain), red 4–10 (recover).
 *
 * SLEEP NEED
 *   8 h base, + 10 min per strain point above 14 yesterday, + half of the
 *   last 3 nights' average shortfall (sleep debt), capped at 9½ h.
 *   "Bed by" = your usual wake time − need − your usual time to fall asleep.
 *
 * These are transparent estimates, not medical measurements.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const STRAIN_K = 150;
export const BASE_LOAD = 20;
export const ZONE_WEIGHTS = { fat: 2, cardio: 3.5, peak: 5 };

export function loadOf({ steps = 0, fat = 0, cardio = 0, peak = 0 } = {}) {
  return BASE_LOAD + (Number(steps) || 0) / 1000 + ZONE_WEIGHTS.fat * fat + ZONE_WEIGHTS.cardio * cardio + ZONE_WEIGHTS.peak * peak;
}
export const strainOf = (load) => Math.round(21 * (1 - Math.exp(-load / STRAIN_K)) * 10) / 10;

export function recoveryBand(score) {
  if (score == null) return null;
  if (score >= 67) return { key: 'green', label: 'Green', color: '#34d399' };
  if (score >= 34) return { key: 'yellow', label: 'Yellow', color: '#fbbf24' };
  return { key: 'red', label: 'Red', color: '#fb7185' };
}

export function strainTarget(recoveryScore) {
  const band = recoveryBand(recoveryScore)?.key;
  if (band === 'green') return { lo: 14, hi: 18, tag: 'Build' };
  if (band === 'red') return { lo: 4, hi: 10, tag: 'Recover' };
  return { lo: 10, hi: 14, tag: 'Maintain' };
}

/** Strain added by `minutes` of brisk walking (fat-burn zone, ~100 steps/min) on top of today's load. */
export function walkGain(load, minutes = 30) {
  return Math.round((strainOf(load + minutes * ZONE_WEIGHTS.fat + (minutes * 100) / 1000) - strainOf(load)) * 10) / 10;
}

/** Minutes of brisk walking to reach `target` strain from today's load (null if already there). */
export function walkMinutesTo(load, target) {
  if (strainOf(load) >= target) return null;
  if (target >= 21) return null;
  const needLoad = -STRAIN_K * Math.log(1 - target / 21);
  const perMin = ZONE_WEIGHTS.fat + 0.1;
  return Math.ceil(Math.max(0, needLoad - load) / perMin / 5) * 5;
}

export function sleepNeedMin({ yesterdayStrain = null, recentNights = [] } = {}) {
  const base = 480;
  const strainAdd = yesterdayStrain != null ? Math.max(0, yesterdayStrain - 14) * 10 : 0;
  const debts = recentNights.filter((m) => m > 0).map((m) => Math.max(0, base - m));
  const debtAdd = debts.length ? mean(debts) * 0.5 : 0;
  return Math.round(clamp(base + strainAdd + debtAdd, base, 570));
}

const hhmm12 = (mins) => {
  const m = ((Math.round(mins / 5) * 5) % 1440 + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'am' : 'pm'}`;
};
const hm = (mins) => `${Math.floor(mins / 60)}:${String(Math.round(mins % 60)).padStart(2, '0')}`;
const dur = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
};

/**
 * @param days ascending [{ date, steps?, fat?, cardio?, peak?, hrv?, rhr?, sleepMin?, wakeClock?, latency? }]
 *        wakeClock = minutes after midnight the main sleep ended.
 * @param recoveryFor (date) => score|null
 * @param date the day to describe
 */
export function describeDay(days, recoveryFor, date) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = byDate.get(date) || { date };
  const prevDates = days.filter((d) => d.date < date).map((d) => d.date);
  const yesterday = byDate.get(prevDates[prevDates.length - 1]);

  // Recovery (today, else yesterday's if the watch hasn't synced the night yet)
  const recScore = recoveryFor(date);
  const recovery =
    recScore == null
      ? null
      : (() => {
          const band = recoveryBand(recScore);
          const baseRhr = mean(days.filter((d) => d.date < date && d.rhr > 0).slice(-30).map((d) => d.rhr));
          const rhr = today.rhr ?? null;
          const rhrNote = rhr && baseRhr ? (rhr <= baseRhr - 1 ? 'below your normal' : rhr >= baseRhr + 2 ? 'above your normal' : 'at your normal') : '';
          const advice =
            band.key === 'green' ? 'A hard session is fine today.' : band.key === 'yellow' ? 'Train, but keep it moderate.' : 'Take it easy and prioritise sleep.';
          return {
            score: recScore,
            band,
            rhr,
            hrv: today.hrv ?? null,
            text: `${band.key === 'green' ? 'Primed' : band.key === 'yellow' ? 'Steady' : 'Run down'}.${rhr ? ` Resting HR ${Math.round(rhr)} bpm${rhrNote ? `, ${rhrNote}` : ''}.` : ''} ${advice}`,
          };
        })();

  // Strain (needs zone minutes for the day)
  const hasZones = today.fat != null || today.cardio != null || today.peak != null;
  const strain =
    !hasZones
      ? null
      : (() => {
          const load = loadOf(today);
          const value = strainOf(load);
          const t = strainTarget(recScore);
          const gain = walkGain(load, 30);
          const mins = walkMinutesTo(load, t.lo);
          let text;
          if (value < t.lo) text = `${(t.lo - value).toFixed(1)} below today's ${t.lo}–${t.hi} target. A 30 min brisk walk adds about ${gain}${mins && mins !== 30 ? ` (≈${mins} min reaches ${t.lo})` : ''}.`;
          else if (value <= t.hi) text = `In today's ${t.lo}–${t.hi} target. Good balance of work and recovery.`;
          else text = `Above today's ${t.lo}–${t.hi} target. Wind down and sleep well to recover.`;
          return { value, load: Math.round(load), target: t, gain, text, minutes: { fat: today.fat ?? 0, cardio: today.cardio ?? 0, peak: today.peak ?? 0 } };
        })();

  // Sleep (last night = sleep that ended on `date`)
  const sleep =
    !(today.sleepMin > 0)
      ? null
      : (() => {
          const recent = prevDates.slice(-3).map((d) => byDate.get(d)?.sleepMin).filter((m) => m > 0);
          const yStrain = yesterday && (yesterday.fat != null || yesterday.cardio != null) ? strainOf(loadOf(yesterday)) : null;
          const need = sleepNeedMin({ yesterdayStrain: yStrain, recentNights: recent });
          const pct = Math.round((today.sleepMin / need) * 100);
          const prev = yesterday?.sleepMin;
          const delta = prev > 0 ? today.sleepMin - prev : null;
          const wakes = days.filter((d) => d.date <= date && d.wakeClock != null).slice(-7).map((d) => d.wakeClock);
          const lat = median(days.filter((d) => d.date <= date && d.latency != null).slice(-7).map((d) => d.latency)) ?? 15;
          const wake = median(wakes);
          const bed = wake != null ? wake - need - lat : null;
          const needLabel = dur(need);
          let text = `${pct}% of your ${needLabel} need`;
          if (delta != null && Math.abs(delta) >= 5) text += `, ${delta > 0 ? 'up' : 'down'} ${dur(Math.abs(delta))} on the night before`;
          text += '.';
          if (bed != null) text += ` Bed by ${hhmm12(bed)} hits ${needLabel}.`;
          return { minutes: today.sleepMin, label: hm(today.sleepMin), need, pct, delta, bedtime: bed != null ? hhmm12(bed) : null, text };
        })();

  return { date, recovery, strain, sleep };
}
