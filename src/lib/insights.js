/**
 * lib/insights.js
 * Short, plain-language readings of a daily series for the Activity page:
 * average, trend, goal hits and best/worst day. Purely descriptive; no
 * medical claims.
 */

const fmtDay = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * @param days  [{ date, value|null }] ascending, one per day
 * @param opts  {
 *   unit: 'steps' | 'km' | ..., decimals, goal,
 *   better: 'higher' | 'lower' | 'range' | null   (how to describe the trend)
 *   range: [lo, hi]  for better === 'range' (e.g. sleep 7-9 h)
 *   noun: 'day' | 'night'
 * }
 * @returns { stats, lines: string[] }
 */
export function interpret(days, opts = {}) {
  const { unit = '', decimals = 0, goal = null, better = 'higher', range = null, noun = 'day' } = opts;
  const have = (days || []).filter((d) => d.value != null && Number.isFinite(Number(d.value)) && Number(d.value) > 0);
  if (!have.length) return { stats: null, lines: [`No data in this range.`] };

  const f = (n) =>
    Number(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const u = unit ? ` ${unit}` : '';
  const vals = have.map((d) => Number(d.value));
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const best = have.reduce((a, d) => (Number(d.value) > Number(a.value) ? d : a));
  const lowest = have.reduce((a, d) => (Number(d.value) < Number(a.value) ? d : a));
  const lines = [];

  lines.push(
    `Averaged ${f(avg)}${u} per ${noun} across ${have.length} ${noun}${have.length === 1 ? '' : 's'} with data.`
  );

  // Trend: first half vs second half of the days that have data.
  if (have.length >= 4) {
    const mid = Math.floor(have.length / 2);
    const a = have.slice(0, mid).reduce((s, d) => s + Number(d.value), 0) / mid;
    const b = have.slice(mid).reduce((s, d) => s + Number(d.value), 0) / (have.length - mid);
    const pct = a ? ((b - a) / a) * 100 : 0;
    if (Math.abs(pct) < 3) lines.push('Steady across the range.');
    else {
      const dir = pct > 0 ? 'up' : 'down';
      let tone = '';
      if (better === 'higher') tone = pct > 0 ? ' (nice)' : '';
      if (better === 'lower') tone = pct < 0 ? ' (generally a good sign)' : '';
      lines.push(`Trending ${dir} ${Math.abs(pct).toFixed(0)}% in the second half of the range${tone}.`);
    }
  }

  if (goal && better === 'higher') {
    const hit = vals.filter((v) => v >= goal).length;
    lines.push(`Reached your ${f(goal)}${u} goal on ${hit} of ${have.length} ${noun}s.`);
  }
  if (range) {
    const inRange = vals.filter((v) => v >= range[0] && v <= range[1]).length;
    lines.push(`${inRange} of ${have.length} ${noun}s were in the ${range[0]}-${range[1]}${u} range.`);
  }

  if (better === 'lower') lines.push(`Lowest: ${f(lowest.value)}${u} on ${fmtDay(lowest.date)}.`);
  else if (better === 'higher') lines.push(`Best ${noun}: ${f(best.value)}${u} on ${fmtDay(best.date)}.`);
  else if (better === 'range') lines.push(`Longest ${noun}: ${f(best.value)}${u} on ${fmtDay(best.date)}; shortest ${f(lowest.value)}${u}.`);
  else lines.push(`Highest: ${f(best.value)}${u} on ${fmtDay(best.date)}; lowest ${f(lowest.value)}${u}.`);

  return { stats: { avg, best, lowest, count: have.length }, lines };
}
