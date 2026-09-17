'use client';

import { useMemo, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Scale, Gauge, CalendarRange } from 'lucide-react';

/**
 * Least-squares slope in kg per day over {date, weight} samples.
 * Regression rather than (last - first) / days, because endpoint differencing
 * is dominated by whatever water weight the two endpoint days happened to
 * carry, while the slope uses every point.
 */
function slopePerDay(samples) {
  if (samples.length < 2) return null;
  const t0 = new Date(`${samples[0].date}T00:00:00`).getTime();
  const xs = samples.map((s) => (new Date(`${s.date}T00:00:00`).getTime() - t0) / 86400000);
  const ys = samples.map((s) => s.weight);

  const n = xs.length;
  const meanX = xs.reduce((a, v) => a + v, 0) / n;
  const meanY = ys.reduce((a, v) => a + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

function daysBetween(a, b) {
  return Math.round(
    (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000
  );
}

function Stat({ icon: Icon, label, value, unit, sub, tone = 'text-slate-900 dark:text-white', delay = 0 }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-3 shadow-xs transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-md ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={13} className="shrink-0 text-slate-400" />
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`font-numeric text-xl font-black leading-none tracking-tight ${tone}`}>
          {value}
        </span>
        {unit && (
          <span className="font-numeric text-[10px] font-bold text-slate-400 leading-none">{unit}</span>
        )}
      </div>
      {sub && <p className="mt-1 font-numeric text-[10px] leading-tight text-slate-400">{sub}</p>}
    </div>
  );
}

/**
 * Statistical summary for the weight page.
 *
 * @param entries  [{ logged_at, weight_kg }] ascending
 * @param heightCm optional, enables BMI
 * @param goal     profile goal string, used to judge trend direction
 */
export default function WeightStats({ entries, heightCm = null, goal = 'maintain' }) {
  const stats = useMemo(() => {
    if (!entries || entries.length === 0) return null;

    const samples = entries.map((e) => ({ date: e.logged_at, weight: Number(e.weight_kg) }));
    const latest = samples[samples.length - 1];
    const first = samples[0];

    const sliceSince = (days) => {
      const cutoff = new Date(`${latest.date}T00:00:00`);
      cutoff.setDate(cutoff.getDate() - days);
      const iso = cutoff.toISOString().slice(0, 10);
      return samples.filter((s) => s.date >= iso);
    };

    const last7 = sliceSince(7);
    const last30 = sliceSince(30);

    const slope30 = slopePerDay(last30);
    const weeklyRate = slope30 === null ? null : slope30 * 7;

    const changeAll = latest.weight - first.weight;
    const change7 = last7.length > 1 ? latest.weight - last7[0].weight : null;

    const weights = samples.map((s) => s.weight);
    const bmi = heightCm ? latest.weight / (heightCm / 100) ** 2 : null;

    // Logging cadence over the tracked span — sparse data makes every other
    // number here less trustworthy, so it's surfaced rather than hidden.
    const span = daysBetween(first.date, latest.date) + 1;
    const cadence = span > 0 ? Math.round((samples.length / span) * 100) : null;

    const losing = goal === 'lose_weight';
    const gaining = goal === 'gain_muscle' || goal === 'lean_mass';
    const onTrack =
      weeklyRate === null
        ? null
        : losing
          ? weeklyRate < -0.05
          : gaining
            ? weeklyRate > 0.05
            : Math.abs(weeklyRate) <= 0.25;

    return {
      latest,
      first,
      span,
      count: samples.length,
      changeAll,
      change7,
      weeklyRate,
      min: Math.min(...weights),
      max: Math.max(...weights),
      bmi,
      cadence,
      onTrack,
      last30Count: last30.length,
    };
  }, [entries, heightCm, goal]);

  if (!stats) return null;

  const { weeklyRate, changeAll, change7, bmi, cadence, onTrack } = stats;

  const RateIcon =
    weeklyRate === null || Math.abs(weeklyRate) < 0.05
      ? Minus
      : weeklyRate > 0
        ? TrendingUp
        : TrendingDown;

  const rateTone =
    onTrack === null
      ? 'text-slate-900 dark:text-white'
      : onTrack
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-amber-600 dark:text-amber-400';

  const signed = (n, digits = 1) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

  const bmiBand =
    bmi === null
      ? null
      : bmi < 18.5
        ? 'underweight'
        : bmi < 25
          ? 'normal range'
          : bmi < 30
            ? 'overweight'
            : 'obese';

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <Stat
        icon={RateIcon}
        label="Weekly rate"
        value={weeklyRate === null ? '—' : signed(weeklyRate, 2)}
        unit={weeklyRate === null ? '' : 'kg/wk'}
        sub={
          weeklyRate === null
            ? 'need 2+ weigh-ins'
            : `fitted over ${stats.last30Count} recent logs`
        }
        tone={rateTone}
        delay={0}
      />
      <Stat
        icon={Scale}
        label="Last 7 days"
        value={change7 === null ? '—' : signed(change7)}
        unit={change7 === null ? '' : 'kg'}
        sub="vs oldest log in window"
        delay={70}
      />
      <Stat
        icon={CalendarRange}
        label="Total change"
        value={signed(changeAll)}
        unit="kg"
        sub={`across ${stats.span} days · ${stats.count} logs`}
        delay={140}
      />
      <Stat
        icon={Gauge}
        label={bmi === null ? 'Logging cadence' : 'BMI'}
        value={bmi === null ? (cadence === null ? '—' : cadence) : bmi.toFixed(1)}
        unit={bmi === null ? '%' : ''}
        sub={bmi === null ? 'days logged in span' : `${bmiBand} · ${cadence}% days logged`}
        delay={210}
      />
    </div>
  );
}
