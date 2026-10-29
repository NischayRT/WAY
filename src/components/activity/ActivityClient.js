'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Scale, Activity, TrendingUp, Lock } from 'lucide-react';
import { addDays } from '@/lib/dateUtils';
import { buildBodyModel } from '@/lib/bodyPreview';
import { calculateBMR, calculateTDEE, ACTIVITY_MULTIPLIERS } from '@/lib/bmrTdee';
import { TILE_DEFS, FLOORS_GOAL } from '@/lib/daily';
import { PAGE, PageHeader, Card, Eyebrow, Segmented, Btn, fmt, useMounted, polyPoints, cx } from '@/components/way/ui';
import { EditTilesDialog, useTileSelection, TILE_ICONS } from '@/components/way/tiles';
import { LoadRingsCompact, LoadRingsWide, LoadTrend, hasLoad } from '@/components/way/LoadRings';
import WeightLogDialog from '@/components/way/WeightLogDialog';
import { useJson } from '@/components/way/useJson';
import HealthDataNotice from '@/components/way/HealthDataNotice';
import { BodyAgeLocked } from '@/components/today/BodyAgeCard';
import TapTips from '@/components/way/TapTips';
import { useUnits, UnitSwitch } from '@/components/way/units';
import { fmtWeight, fmtWeightFixed, fmtHeight, weightUnit } from '@/lib/units';

const RANGES = [
  ['7D', 7],
  ['30D', 30],
  ['90D', 90],
  ['6M', 180],
  ['1Y', 365],
];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dt = (s) => new Date(`${s}T00:00:00`);
const dstr = (s) => {
  const d = dt(s);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
};
const mean = (arr) => {
  const v = arr.filter((x) => x != null && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const dayDiff = (a, b) => Math.round((dt(b) - dt(a)) / 86400000);

/** How each chosen tile is charted here. */
const STATS = {
  steps: { label: 'Steps', from: 'days', field: 'steps', unit: 'steps/day', dec: 0, goalKey: 'steps' },
  distance: { label: 'Distance', from: 'days', field: 'distanceKm', unit: 'km/day', dec: 1, goalKey: 'distanceKm' },
  energy: { label: 'Active burn', from: 'days', field: 'activeCalories', unit: 'kcal/day', dec: 0, goalKey: 'burnKcal' },
  heart: { label: 'Heart rate', from: 'heart', unit: 'bpm resting', dec: 0 },
  oxygen: { label: 'SpO₂', from: 'oxygen', field: 'spo2', unit: '% overnight', dec: 1, lo: 90, hi: 100, rangeGoal: [95, 100] },
  floors: { label: 'Floors climbed', from: 'floors', field: 'floors', unit: 'floors/day', dec: 0, goal: FLOORS_GOAL },
  sleep: { label: 'Sleep', from: 'sleep', field: 'sleepHours', unit: 'h/night', dec: 1, rangeGoal: [7, 9], hi: 10, noun: 'nights', scope: 'sleep' },
  glucose: { label: 'Glucose', from: 'glucose', field: 'glucoseAvg', unit: 'mg/dL avg', dec: 0, lo: 60, hi: 160, rangeGoal: [70, 140], neutral: true },
};
const EXTRA_KEYS = ['heart', 'oxygen', 'floors', 'sleep', 'glucose'];

/** Days → buckets: daily up to 30 days, weekly up to 6 months, monthly beyond. */
function bucketize(dates, range) {
  const mode = range <= 30 ? 'day' : range <= 180 ? 'week' : 'month';
  let buckets = [];
  if (mode === 'day') {
    buckets = dates.map((d) => ({ dates: [d], label: range === 7 ? 'SMTWTFS'[dt(d).getDay()] : String(dt(d).getDate()), title: dstr(d) }));
  } else if (mode === 'week') {
    for (let i = dates.length; i > 0; i -= 7) buckets.unshift({ dates: dates.slice(Math.max(0, i - 7), i) });
    buckets.forEach((b) => {
      b.label = String(dt(b.dates[0]).getDate());
      b.title = `Week of ${dstr(b.dates[0])}`;
    });
  } else {
    const map = new Map();
    dates.forEach((d) => {
      const key = d.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    buckets = [...map.values()].map((ds) => ({ dates: ds, label: MON[dt(ds[0]).getMonth()][0], title: MON[dt(ds[0]).getMonth()] }));
  }
  const n = buckets.length;
  const xLabels = buckets.map((b, i) => {
    if (mode === 'day' && range === 30) return (n - 1 - i) % 5 === 0 ? b.label : '';
    if (mode === 'week' && range === 180) return (n - 1 - i) % 4 === 0 ? b.label : '';
    if (mode === 'week') return (n - 1 - i) % 2 === 0 ? b.label : '';
    return b.label;
  });
  return { mode, buckets, xLabels, bucketStr: mode === 'day' ? 'Daily values' : mode === 'week' ? 'Weekly averages' : 'Monthly averages' };
}

function StatCard({ c, k, gapD, gapM, xLabels, span }) {
  const Icon = TILE_ICONS[c.key];
  return (
    <Card
      id={`stat-${c.key}`}
      rise
      delay={c.delay}
      className="flex scroll-mt-6 flex-col gap-3 px-[18px] py-4 [grid-column:auto] lg:gap-[18px] lg:p-6 lg:[grid-column:span_var(--span)/span_var(--span)]"
      style={{ '--span': span }}
    >
      <div className="flex items-start justify-between gap-2.5 lg:gap-4">
        <div className="flex flex-col gap-[5px] lg:gap-2">
          <div className="flex items-center gap-[7px] text-xs text-way-mute lg:gap-2 lg:text-[13px]">
            <Icon size={15} style={{ color: c.color }} />
            {c.label}
          </div>
          <div className="flex items-baseline gap-1 lg:gap-[5px]">
            <span className="font-mono text-xl font-semibold leading-none lg:text-3xl">{c.avg}</span>
            <span className="font-mono text-[11px] font-medium text-way-dim lg:text-xs">{c.avgUnit}</span>
          </div>
        </div>
        <div className="flex gap-[22px]">
          <div className="flex flex-col items-end gap-0.5 lg:gap-[3px]">
            <span className="font-mono text-[13px] font-semibold lg:text-[15px]" style={{ color: c.hitColor }}>
              {c.hit}
            </span>
            <span className="text-[10px] text-way-dim lg:text-[11px]">{c.hitLabel}</span>
          </div>
          {c.best ? (
            <div className="hidden flex-col items-end gap-[3px] lg:flex">
              <span className="font-mono text-[15px] font-semibold">{c.best}</span>
              <span className="text-[11px] text-way-dim">{c.bestLabel}</span>
            </div>
          ) : null}
        </div>
      </div>

      {c.permission ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-way-line2 p-4">
          <span className="flex items-center gap-1.5 text-[13px] text-way-mute">
            <Lock size={13} />
            Allow WAY to read this from Google Health.
          </span>
          <Btn as="a" href={c.permission} variant="primary" size="sm" className="rounded-[10px]">
            Allow access
          </Btn>
        </div>
      ) : c.loading ? (
        <div className="h-[72px] animate-pulse rounded-xl bg-way-track/60 lg:h-[140px]" />
      ) : c.isHeart ? (
        <div className="flex flex-col gap-2">
          <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="block h-[72px] w-full lg:h-[140px]">
            <polygon points={c.band} style={{ fill: 'rgba(251,113,133,.14)' }} />
            <polyline points={c.line} style={{ fill: 'none', stroke: '#fb7185', strokeWidth: 2.2, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' }} />
          </svg>
          <div className="hidden gap-4 text-[11px] text-way-dim lg:flex">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 border-t-2 border-way-over" />
              Resting
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3.5 rounded-sm bg-[rgba(251,113,133,.25)]" />
              Daily low–high
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[
            ['lg:hidden', 72, gapM],
            ['hidden lg:flex', 140, gapD],
          ].map(([cls, h, gap]) => (
            <TapTips key={h} className={cx('flex items-end', cls)} style={{ height: h, gap }}>
              {c.goalPct != null ? (
                <div className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-way-dim" style={{ bottom: `${c.goalPct}%` }} />
              ) : null}
              {c.band ? (
                <div
                  className="pointer-events-none absolute inset-x-0 border-y border-dashed border-way-faint bg-[rgba(129,140,248,.08)]"
                  style={{ bottom: `${c.band.lo}%`, height: `${c.band.h}%` }}
                />
              ) : null}
              {c.bars.map((b, i) => (
                <div
                  key={i}
                  data-tip={b.title}
                  tabIndex={b.title ? 0 : undefined}
                  className="min-w-0 flex-1 cursor-default rounded-[4px_4px_1px_1px] outline-none transition-[height,background,opacity] duration-[800ms] ease-[cubic-bezier(.2,.8,.2,1)] hover:opacity-75 focus-visible:opacity-75"
                  style={{ height: `${b.h * k}%`, background: b.color }}
                />
              ))}
            </TapTips>
          ))}
          <div className="hidden lg:flex" style={{ gap: gapD }}>
            {xLabels.map((x, i) => (
              <span key={i} className="min-w-0 flex-1 whitespace-nowrap text-center font-mono text-[10px] font-semibold text-way-faint">
                {x}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-way-mute [text-wrap:pretty] lg:border-t lg:border-way-line lg:pt-3.5 lg:text-[13px] lg:text-way-ink2">
        <TrendingUp size={14} className="mt-0.5 hidden shrink-0 lg:block" style={{ color: c.color, transform: c.trendFlip }} />
        {c.insight}
      </div>
    </Card>
  );
}

export default function ActivityClient({ userId, profile, entries, goals, googleHealthConnected, today }) {
  const [range, setRange] = useState(30);
  const [editing, setEditing] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [tiles, saveTiles] = useTileSelection(userId);
  // Weights and heights in your units; everything is calculated in kg and cm.
  const { units: U } = useUnits();
  const wk = (kg, dec = 1) => fmtWeightFixed(kg, U, dec);
  const wu = weightUnit(U);
  const k = useMounted() ? 1 : 0;

  const from = addDays(today, -(range - 1));
  const dates = useMemo(() => Array.from({ length: range }, (_, i) => addDays(from, i)), [from, range]);
  const { buckets, xLabels, bucketStr } = useMemo(() => bucketize(dates, range), [dates, range]);
  const nb = buckets.length;
  const gapD = nb <= 7 ? 16 : nb <= 13 ? 8 : nb <= 26 ? 5 : 3;
  const gapM = nb <= 7 ? 8 : nb <= 13 ? 4 : 2;

  /* ---------- weight ---------- */
  const goalKg = profile?.dream_target_weight_kg ? Number(profile.dream_target_weight_kg) : null;
  const all = entries.map((e) => ({ date: e.logged_at, w: Number(e.weight_kg) }));
  const startKg = all.length ? all[0].w : null;
  const wIn = all.filter((e) => e.date >= from && e.date <= today);
  const latest = all.length ? all[all.length - 1] : null;
  // Whether a lower weight is progress: towards the goal if one is set, else by the profile goal.
  const wantsLoss = goalKg != null && startKg != null ? goalKg < startKg : profile?.goal === 'lose_weight';
  const W = useMemo(() => {
    if (!wIn.length) return null;
    const vals = wIn.map((p) => p.w);
    const wmin = Math.min(...vals);
    const wmax = Math.max(...vals);
    const pad = Math.max(0.3, (wmax - wmin) * 0.15);
    const lo = wmin - pad;
    const hi = wmax + pad;
    const X = (date) => (range === 1 ? 150 : (dayDiff(from, date) / (range - 1)) * 300);
    const Y = (v) => ((hi - v) / (hi - lo)) * 120;
    const line = wIn.map((p) => `${X(p.date).toFixed(1)},${Y(p.w).toFixed(1)}`).join(' ');
    const area = `${X(wIn[0].date).toFixed(1)},120 ${line} ${X(wIn[wIn.length - 1].date).toFixed(1)},120`;
    const avgLine = wIn
      .map((p) => {
        const win = wIn.filter((q) => q.date <= p.date && dayDiff(q.date, p.date) < 7).map((q) => q.w);
        return `${X(p.date).toFixed(1)},${Y(mean(win)).toFixed(1)}`;
      })
      .join(' ');
    const last = wIn[wIn.length - 1];
    const first = wIn[0];
    const change = last.w - first.w;
    const weeks = Math.max(1, dayDiff(first.date, last.date) / 7);
    const rate = change / weeks;
    const toGo = goalKg != null ? last.w - goalKg : null;
    const heading = goalKg != null && toGo !== 0 && Math.sign(-rate) === Math.sign(toGo) && Math.abs(rate) > 0.01;
    const eta = heading ? dt(today) : null;
    if (eta) eta.setDate(eta.getDate() + Math.round((Math.abs(toGo) / Math.abs(rate)) * 7));
    const sign = (v) => (v <= 0 ? '−' : '+');
    const progressPct = goalKg != null && startKg != null && startKg !== goalKg ? Math.round(((startKg - last.w) / (startKg - goalKg)) * 100) : null;
    const pace = Math.abs(rate) > 1 ? `Faster than ${fmtWeight(1, U)} a week; ease off if energy dips.` : Math.abs(rate) >= 0.25 ? 'A sustainable pace.' : 'Pace has slowed; a plateau is normal.';
    return {
      now: wk(last.w),
      line,
      area,
      avgLine,
      dotX: X(last.date) / 3,
      dotY: (Y(last.w) / 120) * 100,
      hiStr: wk(hi),
      midStr: wk((hi + lo) / 2),
      loStr: wk(lo),
      x0: dstr(from),
      x1: dstr(addDays(today, -Math.floor(range / 2))),
      stats: [
        { label: 'Change', v: `${sign(change)}${wk(Math.abs(change))} ${wu}`, color: Math.abs(change) < 0.05 ? '#f1f5f9' : (change < 0) === wantsLoss ? '#34d399' : '#fb7185' },
        { label: 'Weekly rate', v: `${sign(rate)}${wk(Math.abs(rate), 2)} ${wu}`, color: '#f1f5f9' },
        { label: 'To goal', v: toGo != null ? `${wk(Math.abs(toGo))} ${wu}` : '—', color: '#f1f5f9' },
        { label: 'ETA at this pace', v: eta ? `${MON[eta.getMonth()]} ${eta.getFullYear()}` : '—', color: '#6ee7b7' },
      ],
      insight:
        progressPct != null
          ? `${Math.max(0, Math.min(100, progressPct))}% of the way from ${fmtWeight(startKg, U)}. ${pace}`
          : wIn.length > 1
            ? `${change <= 0 ? 'Down' : 'Up'} ${fmtWeight(Math.abs(change), U)} in this range. ${pace}`
            : 'One weigh-in in this range. Log a few more to see a trend.',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wIn, range, from, today, goalKg, startKg, wantsLoss, U]);

  /* ---------- body composition ---------- */
  const comp = useMemo(() => {
    const h = Number(profile?.height_cm);
    const w = latest?.w ?? Number(profile?.weight_kg);
    if (!(h > 0) || !(w > 0)) return null;
    const bmi = w / (h / 100) ** 2;
    const band = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese';
    const model = buildBodyModel(profile, w);
    const fat = model.bodyFatPct;
    const lean = w * (1 - fat / 100);
    const loKg = 18.5 * (h / 100) ** 2;
    const hiKg = 24.9 * (h / 100) ** 2;
    const vs = w > hiKg ? `${fmtWeight(w - hiKg, U)} over` : w < loKg ? `${fmtWeight(loKg - w, U)} under` : 'Inside';
    // Energy: Mifflin-St Jeor from the profile; with measurements, Katch-McArdle
    // from lean mass (more accurate for lean or heavy builds).
    const measured = !!profile?.waist_cm;
    const mifflin = profile?.age ? calculateBMR({ weightKg: w, heightCm: h, age: Number(profile.age), sex: profile?.sex }) : null;
    const bmr = measured && model.stats?.bmr ? model.stats.bmr : mifflin;
    const level = ACTIVITY_MULTIPLIERS[profile?.activity_level] ? profile.activity_level : 'light';
    const tdee = bmr ? calculateTDEE(bmr, level) : null;
    return {
      bmr,
      bmrMethod: measured && model.stats?.bmr ? 'from lean mass' : 'from height, weight, age',
      tdee,
      level: level.replace(/_/g, ' '),
      ffmi: model.stats?.ffmi ?? null,
      whtr: measured && model.stats?.waistToHeightRatio ? model.stats.waistToHeightRatio : null,
      h: fmtHeight(h, U),
      age: profile?.age,
      bmi: bmi.toFixed(1),
      band,
      bandColor: band === 'Healthy' ? '#34d399' : '#fbbf24',
      marker: ((Math.min(35, Math.max(16, bmi)) - 16) / 19) * 100,
      fat,
      lean,
      range: `${fmtWeight(loKg, U, 0, false)}–${fmtWeight(hiKg, U, 0)}`,
      vs,
      measured,
    };
  }, [profile, latest, U]);

  /* ---------- your stats (Google Health) ---------- */
  const extraKeys = tiles.filter((t) => EXTRA_KEYS.includes(t));
  const hist = useJson(googleHealthConnected ? `/api/google-health/history?from=${from}&to=${today}&keys=${extraKeys.join(',')}` : null);
  const reauth = hist.data?.reauthRequired || hist.status === 401;
  const byDate = useMemo(() => new Map((hist.data?.days || []).map((d) => [d.date, d])), [hist.data]);
  const series = (key, name) => new Map((hist.data?.extras?.[key]?.data?.series?.[name] || []).map((p) => [p.date, p.value]));
  const connectHref = (scope) => `/api/google-health/connect?returnTo=%2Factivity${scope ? `&extra=${scope}` : ''}`;

  // Your measured burn: BMR plus the active calories Google Health recorded.
  const activeAvg = useMemo(() => {
    const vals = dates.map((d) => byDate.get(d)?.activeCalories).filter((v) => v != null && v > 0);
    return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [dates, byDate]);
  const measuredTdee = comp?.bmr && activeAvg != null ? comp.bmr + activeAvg : null;

  const stats = tiles
    .filter((key) => STATS[key])
    .map((key, si, list) => {
      const c = { ...STATS[key], key, color: TILE_DEFS.find((t) => t.key === key).color };
      const isLastOdd = si === list.length - 1 && list.length % 2 === 1;
      const base = { key, label: c.label, color: c.color, delay: 140 + si * 70, span: isLastOdd ? 12 : 6, avgUnit: c.unit };
      const res = c.from === 'days' ? null : hist.data?.extras?.[key];
      if (res?.needsPermission) return { ...base, avg: '—', hit: '', hitLabel: '', permission: connectHref(c.scope), insight: 'Needs permission.' };
      if (hist.loading) return { ...base, avg: '…', hit: '', hitLabel: '', loading: true, insight: 'Loading from Google Health…' };

      if (key === 'heart') {
        const rest = series('heart', 'resting');
        const low = series('heart', 'low');
        const high = series('heart', 'high');
        const restVals = dates.map((d) => rest.get(d) ?? null);
        const avg = mean(restVals);
        const lo = 40;
        const hi = 180;
        const y = (v) => 120 - ((v - lo) / (hi - lo)) * 120;
        const pts = buckets
          .map((b, i) => ({
            x: nb === 1 ? 150 : (i / (nb - 1)) * 300,
            r: mean(b.dates.map((d) => rest.get(d) ?? null)),
            l: mean(b.dates.map((d) => low.get(d) ?? null)),
            h: mean(b.dates.map((d) => high.get(d) ?? null)),
          }))
          .filter((p) => p.r != null || p.l != null);
        const bandPts = pts.filter((p) => p.l != null && p.h != null);
        const band = [...bandPts.map((p) => `${p.x.toFixed(1)},${y(p.h).toFixed(1)}`), ...bandPts.slice().reverse().map((p) => `${p.x.toFixed(1)},${y(p.l).toFixed(1)}`)].join(' ');
        const line = pts.filter((p) => p.r != null).map((p) => `${p.x.toFixed(1)},${y(p.r).toFixed(1)}`).join(' ');
        const highs = dates.map((d) => ({ d, v: high.get(d) })).filter((p) => p.v != null);
        const peak = highs.length ? highs.reduce((m, p) => (p.v > m.v ? p : m)) : null;
        const lows = dates.map((d) => low.get(d)).filter((v) => v != null);
        const half = Math.floor(restVals.length / 2);
        const delta = (mean(restVals.slice(half)) ?? 0) - (mean(restVals.slice(0, half)) ?? 0);
        return {
          ...base,
          isHeart: true,
          avg: avg != null ? fmt(avg) : '—',
          band,
          line,
          hit: lows.length && peak ? `${Math.min(...lows)}–${peak.v}` : '—',
          hitLabel: 'bpm range',
          hitColor: '#f1f5f9',
          best: peak ? dstr(peak.d) : null,
          bestLabel: peak ? `peak ${peak.v} bpm` : '',
          trendFlip: delta <= 0 ? 'scaleY(-1)' : 'none',
          insight:
            avg == null
              ? 'No heart rate in this range.'
              : Math.abs(delta) < 0.5
                ? 'Resting heart rate held steady across this range.'
                : `Resting heart rate ${delta < 0 ? 'down' : 'up'} ${Math.abs(delta).toFixed(1)} bpm in the second half of this range${delta < 0 ? ', a sign of improving fitness' : ''}.`,
        };
      }

      const get = c.from === 'days' ? (d) => byDate.get(d)?.[c.field] ?? null : ((m) => (d) => m.get(d) ?? null)(series(key, c.field));
      const vals = dates.map(get);
      const have = vals.filter((v) => v != null);
      const avg = mean(vals);
      const goal = c.goal ?? (c.goalKey ? goals[c.goalKey] : null);
      const bVals = buckets.map((b) => mean(b.dates.map(get)));
      const bLo = c.lo ?? 0;
      const bHi = Math.max(...bVals.filter((v) => v != null), goal || 0, c.rangeGoal ? c.rangeGoal[1] : 0, c.hi || 0, 1) * (c.lo ? 1 : 1.12);
      const pct = (v) => Math.max(0, ((v - bLo) / (bHi - bLo)) * 100);
      const inGoal = (v) => (goal ? v >= goal : c.rangeGoal ? v >= c.rangeGoal[0] && v <= c.rangeGoal[1] : true);
      const hits = have.filter(inGoal).length;
      const bars = bVals.map((v, i) => ({
        h: v == null ? 0 : pct(v),
        color: v != null && inGoal(v) ? c.color : `${c.color}66`,
        title: `${buckets[i].title}: ${v == null ? 'no data' : c.dec ? v.toFixed(c.dec) : fmt(v)}`,
      }));
      const half = Math.floor(vals.length / 2);
      const first = mean(vals.slice(0, half));
      const second = mean(vals.slice(half));
      const chg = first ? ((second - first) / first) * 100 : 0;
      let bestIdx = -1;
      vals.forEach((v, i) => {
        if (v != null && (bestIdx < 0 || v > vals[bestIdx])) bestIdx = i;
      });
      const fmtV = (v) => (c.dec ? v.toFixed(c.dec) : fmt(v));
      let insight;
      if (!have.length) insight = 'No data in this range yet.';
      else if (c.rangeGoal && !goal)
        insight = `${hits} of ${have.length} ${c.noun || 'days'} inside your ${c.rangeGoal[0]}–${c.rangeGoal[1]} range.${Math.abs(chg) >= 3 ? ` ${chg > 0 ? 'Up' : 'Down'} ${Math.abs(chg).toFixed(0)}% in the second half.` : ''}`;
      else if (Math.abs(chg) < 3) insight = goal ? `Steady across this range, averaging ${Math.round((avg / goal) * 100)}% of goal.` : 'Steady across this range.';
      else insight = `${chg > 0 ? 'Up' : 'Down'} ${Math.abs(chg).toFixed(0)}% in the second half of this range${!c.neutral && chg > 0 ? '. Keep the momentum.' : '.'}`;
      return {
        ...base,
        avg: avg != null ? fmtV(avg) : '—',
        bars,
        goalPct: goal ? pct(goal) : null,
        band: c.rangeGoal && !goal ? { lo: pct(c.rangeGoal[0]), h: pct(c.rangeGoal[1]) - pct(c.rangeGoal[0]) } : null,
        hit: `${hits}/${have.length}`,
        hitLabel: goal ? 'goal hit' : c.rangeGoal ? 'in range' : 'days',
        hitColor: have.length && hits / have.length >= 0.5 ? '#34d399' : '#f1f5f9',
        best: bestIdx >= 0 ? fmtV(vals[bestIdx]) : null,
        bestLabel: bestIdx >= 0 ? `${c.neutral ? 'high' : 'best'} · ${dstr(dates[bestIdx])}` : '',
        trendFlip: chg < 0 ? 'scaleY(-1)' : 'none',
        insight,
      };
    });

  /* ---------- body age trend ---------- */
  const baRange = Math.max(7, Math.min(180, range));
  const ba = useJson(googleHealthConnected ? `/api/body-age?from=${addDays(today, -(baRange - 1))}&to=${today}` : null);
  const baView = useMemo(() => {
    const d = ba.data;
    if (!d) return null;
    const v = d.vitals || {};
    const statsRow = [
      { v: d.result?.pace != null ? `${d.result.pace.toFixed(1)}×` : '—', label: 'Pace' },
      { v: v.readiness?.score != null ? String(Math.round(v.readiness.score)) : '—', label: 'Readiness' },
      { v: v.hrv?.value != null ? `${v.hrv.value} ms` : '—', label: 'HRV' },
    ];
    if (!d.eligible) {
      const met = (d.requirements || []).filter((r) => r.met).length;
      const nextReq = (d.requirements || []).find((r) => !r.met);
      return { locked: true, statsRow, msg: nextReq ? `${met} of ${d.requirements.length} ready. Needs ${nextReq.label.toLowerCase()} (${nextReq.have} of ${nextReq.need}).` : 'Getting ready.' };
    }
    const trend = [...(d.result.trend || []).map((t) => t.bodyAge).filter((x) => x != null)].reverse();
    trend.push(d.result.bodyAge);
    const first = trend[0];
    return {
      locked: false,
      now: d.result.bodyAge.toFixed(1),
      real: d.result.chronologicalAge,
      delta: `${d.result.bodyAge - first <= 0 ? '−' : '+'}${Math.abs(d.result.bodyAge - first).toFixed(1)} y`,
      deltaColor: d.result.bodyAge - first <= 0 ? '#34d399' : '#fb7185',
      line: polyPoints(trend, { w: 300, h: 60, pad: 4 }),
      statsRow,
    };
  }, [ba.data]);

  /* ---------- weigh-ins ---------- */
  const recent = wIn.slice().reverse();
  const rows = recent.map((p, i) => {
    const prev = recent[i + 1];
    const d = prev ? p.w - prev.w : 0;
    const win = wIn.filter((q) => q.date <= p.date && dayDiff(q.date, p.date) < 7).map((q) => q.w);
    const prog = goalKg != null && startKg != null && startKg !== goalKg ? Math.max(0, Math.min(100, ((startKg - p.w) / (startKg - goalKg)) * 100)) : 0;
    const dd = dt(p.date);
    return {
      key: p.date,
      date: p.date === today ? 'Today' : p.date === addDays(today, -1) ? 'Yesterday' : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dd.getDay()]}, ${dstr(p.date)}`,
      w: wk(p.w),
      d: prev ? `${d <= 0 ? '−' : '+'}${wk(Math.abs(d))}` : '—',
      dColor: !prev || Math.abs(d) < 0.05 ? '#7c8aa0' : (d < 0) === wantsLoss ? '#34d399' : '#fb7185',
      avg: wk(mean(win)),
      prog: prog * k,
      left: goalKg != null ? `${wk(Math.abs(p.w - goalKg))} ${wu}` : '—',
    };
  });
  const shownRows = showAll ? rows : rows.slice(0, 8);

  const rangeStr = `${dstr(from)} – ${dstr(today)} ${dt(today).getFullYear()}`;
  const editBtn = (
    <Btn variant="outline" onClick={() => setEditing(true)} className="h-[34px] rounded-full px-[11px] text-xs md:h-10 md:rounded-xl md:px-3.5 md:text-[13px]">
      <Pencil size={12} />
      Edit stats
    </Btn>
  );

  // Body Age shows only once every stat it needs is there, right under the weight chart.
  const bodyAgeReady = googleHealthConnected && !!ba.data?.eligible;
  const loadDays = Math.min(range, 31);
  const loadRes = useJson(googleHealthConnected ? `/api/google-health/daily-load?date=${today}&days=${loadDays}` : null);
  const load = loadRes.data?.connected ? loadRes.data : null;

  // Body composition
  const compCard = (
    <Card id="body-composition" rise delay={80} className={cx('flex scroll-mt-6 flex-col gap-3.5 p-[18px] lg:col-span-4 lg:gap-[22px] lg:p-7', bodyAgeReady && 'lg:row-span-2')}>
      <div className="flex items-center justify-between">
        <Eyebrow>Body composition</Eyebrow>
        <span className="font-mono text-[11px] font-medium text-way-dim">
          {comp ? `${comp.h}${comp.age ? ` · ${comp.age} y` : ''}` : ''}
        </span>
      </div>
      {comp ? (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5 lg:gap-2">
                <span className="font-mono text-2xl font-semibold lg:font-brand lg:text-[56px] lg:font-normal lg:leading-none">{comp.bmi}</span>
                <span className="text-xs text-way-dim lg:text-[13px]">BMI</span>
              </div>
              <span className="text-xs font-semibold lg:text-[13px]" style={{ color: comp.bandColor }}>
                {comp.band}
              </span>
            </div>
            <div className="relative flex h-1.5 gap-0.5 lg:h-2 lg:gap-[3px]">
              {[
                [2.5, '#60a5fa66'],
                [6.5, '#34d39999'],
                [5, '#fbbf2499'],
                [5, '#fb718599'],
              ].map(([flex, c]) => (
                <div key={c} className="rounded-[3px] lg:rounded" style={{ flex, background: c }} />
              ))}
              <div
                className="absolute -top-1 h-3.5 w-[3px] rounded-sm bg-slate-50 shadow-[0_0_0_3px_#0f1420] transition-[left] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)] lg:-top-[5px] lg:h-[18px]"
                style={{ left: `${comp.marker * k}%` }}
              />
            </div>
            <div className="hidden justify-between font-mono text-[10px] font-medium text-way-faint lg:flex">
              <span>16</span>
              <span>18.5</span>
              <span>25</span>
              <span>30</span>
              <span>35</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-2 lg:gap-x-4 lg:gap-y-[18px] lg:border-t lg:border-way-line lg:pt-5">
            {[
              [`${comp.fat.toFixed(1)}%`, 'Body fat (est.)'],
              [fmtWeight(comp.lean, U), 'Lean mass'],
              [comp.range, 'Healthy range'],
              [comp.vs, 'Vs healthy range'],
            ].map(([v, label], i) => (
              <div key={label} className={cx('flex flex-col gap-0.5 lg:gap-[3px]', i === 3 && 'hidden lg:flex')}>
                <span className="font-mono text-[15px] font-semibold lg:text-xl">{v}</span>
                <span className="text-[10px] text-way-dim lg:text-xs">{label}</span>
              </div>
            ))}
          </div>
          {comp.bmr ? (
            <div className="flex flex-col gap-2.5 border-t border-way-line pt-3.5 lg:pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-way-mute">
                  BMR <span className="text-way-dim">· {comp.bmrMethod}</span>
                </span>
                <span className="font-mono text-[15px] font-semibold">
                  {fmt(comp.bmr)} <span className="text-[11px] text-way-dim">kcal</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-way-mute">
                  TDEE <span className="text-way-dim">· {comp.level} activity</span>
                </span>
                <span className="font-mono text-[15px] font-semibold">
                  {fmt(comp.tdee)} <span className="text-[11px] text-way-dim">kcal</span>
                </span>
              </div>
              {measuredTdee ? (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-way-mute">
                    Measured burn <span className="text-way-dim">· BMR + Google Health</span>
                  </span>
                  <span className="font-mono text-[15px] font-semibold text-way-protein">
                    {fmt(measuredTdee)} <span className="text-[11px] text-way-dim">kcal</span>
                  </span>
                </div>
              ) : null}
              {comp.ffmi || comp.whtr ? (
                <div className="flex gap-4 font-mono text-[11px] text-way-dim">
                  {comp.ffmi ? <span>FFMI {comp.ffmi}</span> : null}
                  {comp.whtr ? <span>Waist/height {comp.whtr}</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="mt-auto hidden text-xs text-way-dim [text-wrap:pretty] lg:block">
            {comp.measured ? 'Body fat is estimated from your measurements (US Navy method).' : 'Body fat is estimated until you add measurements.'}{' '}
            <Link href="/settings?tab=body" className="text-way-protein">
              Update them in Body
            </Link>
            .
          </p>
        </>
      ) : (
        <p className="text-sm text-way-mute">Add your height and weight in Settings to see this.</p>
      )}
    </Card>
  );

  // Body age trend
  const bodyAgeCard = (
    <Card id="body-age" rise delay={80} className="flex scroll-mt-6 flex-col gap-3 p-[18px] lg:col-span-8 lg:gap-[18px] lg:p-7">
      <div className="flex items-center justify-between">
        <Eyebrow>Body age trend</Eyebrow>
        <span className="font-mono text-[11px] font-medium text-way-dim">{RANGES.find((r) => r[1] === range)[0]}</span>
      </div>
      {!googleHealthConnected ? (
        <div className="flex flex-1 flex-col justify-center gap-3.5">
          <span className="hidden font-brand text-[56px] leading-none text-way-faint lg:block">—</span>
          <span className="text-[13px] text-way-mute lg:text-sm">Log in to Google Health to track your Body Age over time.</span>
          <Btn as="a" href={connectHref()} variant="primary" className="self-start rounded-[10px] lg:self-stretch lg:rounded-xl">
            Log in to Google Health
          </Btn>
          <HealthDataNotice />
        </div>
      ) : !baView ? (
        <div className="h-24 animate-pulse rounded-xl bg-way-track/60" />
      ) : baView.locked ? (
        <>
          <span className="font-brand text-[38px] leading-none text-way-faint lg:text-[56px]">—</span>
          <span className="text-[13px] text-way-mute [text-wrap:pretty]">{baView.msg}</span>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5 lg:gap-2">
              <span className="font-brand text-[38px] leading-none text-way-gold lg:text-[56px]">{baView.now}</span>
              <span className="font-mono text-[11px] font-medium text-way-dim lg:text-xs">real {baView.real}</span>
            </div>
            <span className="font-mono text-xs font-semibold lg:text-[13px]" style={{ color: baView.deltaColor }}>
              {baView.delta}
            </span>
          </div>
          <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="block h-14 w-full lg:h-[90px]">
            <polyline points={baView.line} style={{ fill: 'none', stroke: '#facc15', strokeWidth: 2.2, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' }} />
          </svg>
        </>
      )}
      {googleHealthConnected && baView ? (
        <div className="mt-auto hidden grid-cols-3 border-t border-way-line pt-4 lg:grid">
          {baView.statsRow.map((st) => (
            <div key={st.label} className="flex flex-col items-center gap-[3px]">
              <span className="font-mono text-[17px] font-semibold">{st.v}</span>
              <span className="text-[11px] text-way-dim">{st.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );


  return (
    <main className={PAGE}>
      <PageHeader
        title="Activity"
        sub={rangeStr}
        right={
          <>
            <Segmented mono className="hidden md:flex" value={range} onChange={setRange} options={RANGES.map(([label, r]) => ({ value: r, label }))} />
            {googleHealthConnected ? editBtn : null}
          </>
        }
      />
      <Segmented mono size="sm" stretch className="md:hidden" value={range} onChange={setRange} options={RANGES.map(([label, r]) => ({ value: r, label }))} />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
        {/* Weight */}
        <Card id="weight" rise className="flex scroll-mt-6 flex-col gap-3.5 p-[18px] lg:col-span-8 lg:gap-5 lg:p-7">
          <div className="flex items-center justify-between gap-2.5 lg:items-start lg:gap-5">
            <div className="flex flex-col gap-[3px] lg:gap-1.5">
              <Eyebrow>Weight</Eyebrow>
              <div className="flex items-baseline gap-[5px] lg:gap-2">
                <span className="font-brand text-[38px] leading-none lg:text-[64px] lg:leading-[.9]">{W?.now ?? (latest ? wk(latest.w) : '—')}</span>
                <span className="flex items-center gap-2 font-mono text-xs font-medium text-way-dim lg:text-[13px]">
                  <span>
                    {wu}
                    <span className="hidden lg:inline">{goalKg != null ? ` · goal ${fmtWeight(goalKg, U)}` : ''}</span>
                  </span>
                  <UnitSwitch kind="weight" />
                </span>
              </div>
            </div>
            <Btn variant="primary" onClick={() => setWeightOpen(true)} className="h-9 rounded-full px-3.5 text-xs lg:h-10 lg:rounded-[11px] lg:px-4 lg:text-[13px]">
              <Scale size={14} />
              Log weight
            </Btn>
          </div>

          {W ? (
            <>
              <div className="order-3 grid grid-cols-4 gap-2 border-t border-way-line pt-3 lg:order-none lg:gap-0 lg:border-b lg:pt-0">
                {W.stats.map((st, i) => (
                  <div key={st.label} className={cx('flex flex-col gap-0.5 lg:gap-1 lg:px-[18px] lg:py-3.5', i && 'lg:border-l lg:border-way-line')}>
                    <span className="text-[10px] text-way-dim lg:text-xs">{st.label}</span>
                    <span className="font-mono text-[13px] font-semibold lg:text-lg" style={{ color: st.color }}>
                      {st.v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="relative hidden h-[220px] w-10 shrink-0 lg:block">
                  <span className="absolute right-0 top-0 -translate-y-1/2 font-mono text-[10px] font-medium text-way-faint">{W.hiStr}</span>
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[10px] font-medium text-way-faint">{W.midStr}</span>
                  <span className="absolute bottom-0 right-0 translate-y-1/2 font-mono text-[10px] font-medium text-way-faint">{W.loStr}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <div className="relative h-[150px] lg:h-[220px]">
                    {[0, 50, 100].map((t) => (
                      <div key={t} className="absolute inset-x-0 hidden border-t border-[#151c2a] lg:block" style={{ top: `${t}%` }} />
                    ))}
                    <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="absolute inset-0 block h-full w-full overflow-visible">
                      <polygon points={W.area} style={{ fill: 'rgba(52,211,153,.08)' }} />
                      <polyline
                        points={W.avgLine}
                        className="hidden lg:block"
                        style={{ fill: 'none', stroke: '#475569', strokeWidth: 1.5, strokeDasharray: '4 4', vectorEffect: 'non-scaling-stroke' }}
                      />
                      <polyline
                        points={W.line}
                        style={{ fill: 'none', stroke: '#34d399', strokeWidth: 2.2, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round', strokeLinecap: 'round' }}
                      />
                    </svg>
                    <div
                      className="absolute -ml-[5.5px] -mt-[5.5px] h-[11px] w-[11px] rounded-full bg-way-protein shadow-[0_0_0_5px_rgba(52,211,153,.18)]"
                      style={{ left: `${W.dotX}%`, top: `${W.dotY}%` }}
                    />
                    <span className="absolute left-0 top-0 font-mono text-[10px] font-medium text-way-faint lg:hidden">{W.hiStr}</span>
                    <span className="absolute bottom-0 left-0 font-mono text-[10px] font-medium text-way-faint lg:hidden">{W.loStr}</span>
                  </div>
                  <div className="hidden justify-between font-mono text-[11px] font-semibold text-way-dim lg:flex">
                    <span>{W.x0}</span>
                    <span>{W.x1}</span>
                    <span>Today</span>
                  </div>
                </div>
              </div>
              <div className="order-4 flex items-center justify-between gap-4 text-xs text-way-mute lg:order-none lg:text-[13px]">
                <span className="[text-wrap:pretty]">{W.insight}</span>
                <span className="hidden items-center gap-1.5 whitespace-nowrap text-[11px] text-way-dim lg:flex">
                  <span className="w-4 border-t-[1.5px] border-dashed border-way-faint" />
                  7-day average
                </span>
              </div>
            </>
          ) : (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-way-line2 p-6 text-center">
              <Scale size={20} className="text-way-faint" />
              <span className="text-sm text-way-mute">{all.length ? 'No weigh-ins in this range. Try a wider one.' : 'No weigh-ins yet. Log your first one.'}</span>
            </div>
          )}
        </Card>

        {compCard}
        {bodyAgeReady ? (
          bodyAgeCard
        ) : googleHealthConnected && ba.data?.connected && ba.data.eligible === false ? (
          <BodyAgeLocked id="body-age" data={ba.data} returnTo="/activity" className="lg:col-span-12" />
        ) : null}

        {/* Recovery · Strain · Sleep: only when there's data for it */}
        {hasLoad(load) ? (
          <Card rise className="flex flex-col gap-4 overflow-hidden p-[18px] lg:col-span-12 lg:gap-0 lg:p-0">
            <div className="flex items-baseline justify-between gap-3 lg:px-7 lg:pt-6">
              <Eyebrow>Recovery · Strain · Sleep</Eyebrow>
              <span className="font-mono text-[11px] font-medium text-way-dim">today · trend over {loadDays} days</span>
            </div>
            <LoadRingsCompact load={load} className="lg:hidden" />
            <LoadRingsWide load={load} className="hidden lg:grid" />
            <LoadTrend series={load.series} className="lg:border-t lg:border-way-line lg:px-7 lg:py-5" />
          </Card>
        ) : null}

        {/* Your stats */}
        {googleHealthConnected && !reauth ? (
          <>
            <div className="flex items-center justify-between px-0.5 pt-1.5 lg:col-span-12 lg:-mb-1.5 lg:items-baseline lg:p-0">
              <div className="flex items-baseline gap-3">
                <Eyebrow>Your stats</Eyebrow>
                <span className="hidden font-mono text-[11px] font-medium text-way-dim lg:inline">{bucketStr} · dashed = goal</span>
              </div>
              <span className="font-mono text-[11px] font-medium text-way-dim lg:hidden">{bucketStr}</span>
            </div>
            {hist.error && !hist.data?.days ? <p className="text-[13px] text-rose-300 lg:col-span-12">{hist.error}</p> : null}
            {stats.map((c) => (
              <StatCard key={c.key} c={c} k={k} gapD={gapD} gapM={gapM} xLabels={xLabels} span={c.span} />
            ))}
          </>
        ) : (
          <Card className="flex flex-col items-start gap-3 border-dashed border-way-line2 p-5 lg:col-span-12 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-5 lg:p-7">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-blue-400/30 bg-blue-400/10">
                <Activity size={22} className="text-way-carbs" />
              </div>
              <div className="flex flex-col gap-[3px]">
                <span className="text-[15px] font-semibold lg:text-base">{reauth ? 'Reconnect Google Health' : 'Steps, sleep, heart and more'}</span>
                <span className="text-[13px] text-way-mute">
                  {reauth ? 'Your Google Health connection expired.' : 'Log in to Google Health to chart your activity next to your weight.'}
                </span>
              </div>
            </div>
            <Btn as="a" href={connectHref()} variant="primary" className="rounded-[10px] lg:h-11 lg:rounded-xl lg:px-[18px] lg:text-sm">
              {reauth ? 'Reconnect' : 'Log in to Google Health'}
            </Btn>
            {!reauth ? <HealthDataNotice className="basis-full" /> : null}
          </Card>
        )}

        {/* Weigh-ins */}
        <Card className="order-last flex flex-col py-1.5 lg:order-none lg:col-span-8 lg:pb-2 lg:pt-6">
          <div className="flex items-center justify-between px-[18px] pb-2 pt-3 lg:px-7 lg:pb-3.5 lg:pt-0">
            <div className="flex items-baseline gap-3">
              <Eyebrow>Weigh-ins</Eyebrow>
              <span className="font-mono text-[11px] font-medium text-way-dim">{wIn.length} in range</span>
            </div>
            {rows.length > 8 ? (
              <button type="button" onClick={() => setShowAll((s) => !s)} className="hidden text-xs text-way-mute hover:text-way-ink lg:block">
                {showAll ? 'Show less' : 'Full history'}
              </button>
            ) : null}
          </div>
          {rows.length ? (
            <>
              <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr] border-t border-way-line px-7 py-2.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-way-faint lg:grid">
                <span>DATE</span>
                <span>WEIGHT</span>
                <span>CHANGE</span>
                <span>7-DAY AVG</span>
                <span className="text-right">TO GOAL</span>
              </div>
              {shownRows.map((h, i) => (
                <div
                  key={h.key}
                  className={cx(
                    'items-center justify-between border-t border-way-line px-[18px] py-[11px] transition-colors lg:grid lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr] lg:px-7 lg:py-3 lg:hover:bg-[#121928]',
                    i >= 5 ? 'hidden lg:grid' : 'flex'
                  )}
                >
                  <span className="text-[13px] text-way-ink2">{h.date}</span>
                  <span className="hidden font-mono text-[13px] font-semibold lg:inline">
                    {h.w} {wu}
                  </span>
                  <span className="hidden font-mono text-xs font-semibold lg:inline" style={{ color: h.dColor }}>
                    {h.d}
                  </span>
                  <span className="hidden font-mono text-xs font-medium text-way-mute lg:inline">{h.avg}</span>
                  <div className="hidden items-center justify-end gap-2.5 lg:flex">
                    <div className="h-1 w-[90px] overflow-hidden rounded-full bg-way-track">
                      <div className="h-full bg-way-protein transition-[width] duration-[800ms]" style={{ width: `${h.prog}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono text-[11px] font-medium text-way-dim">{h.left}</span>
                  </div>
                  <div className="flex items-baseline gap-3 lg:hidden">
                    <span className="font-mono text-[13px] font-semibold">
                      {h.w} {wu}
                    </span>
                    <span className="w-[46px] text-right font-mono text-[11px] font-semibold" style={{ color: h.dColor }}>
                      {h.d}
                    </span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="border-t border-way-line px-[18px] py-4 text-[13px] text-way-dim lg:px-7">No weigh-ins in this range.</p>
          )}
        </Card>

      </div>

      <EditTilesDialog
        open={editing}
        onClose={() => setEditing(false)}
        current={tiles}
        title="Edit stats"
        subtitle="Shared with your tiles on Today."
        saveLabel="Save stats"
        onSave={(next) => {
          saveTiles(next);
          setEditing(false);
        }}
      />
      <WeightLogDialog open={weightOpen} onClose={() => setWeightOpen(false)} date={today} today={today} currentWeight={latest?.w ?? profile?.weight_kg} />
    </main>
  );
}
