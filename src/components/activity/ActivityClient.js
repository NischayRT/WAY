'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, CalendarRange, Lightbulb, Scale } from 'lucide-react';
import { ui } from '@/lib/ui';
import { addDays } from '@/lib/dateUtils';
import WeightStats from '@/components/weight/WeightStats';
import WeightTrendChart from '@/components/weight/WeightTrendChart';
import WeighInForm from '@/components/weight/WeighInForm';
import WeightHistoryList from '@/components/weight/WeightHistoryList';
import ActivityChart from '@/components/activity/ActivityChart';
import HeartTrendChart from '@/components/activity/HeartTrendChart';
import { useTileSelection, EditTilesButton } from '@/components/home/TileBoard';
import { FLOORS_GOAL } from '@/components/home/GoogleHealthWidgets';
import { interpret } from '@/lib/insights';

// Optional stats that come from the history API's `keys`. Heart rate, when
// selected, is shown as the featured chart next to weight.
const EXTRA_KEYS = ['heart', 'oxygen', 'floors', 'sleep', 'glucose'];

/** How each selectable stat is charted and described on this page. */
const STAT_CHARTS = {
  steps: { title: 'Steps', from: 'days', field: 'steps', unit: 'steps', goalKey: 'steps', bar: 'fill-blue-500 dark:fill-blue-400', dot: 'bg-blue-500' },
  distance: { title: 'Distance', from: 'days', field: 'distanceKm', unit: 'km', decimals: 1, goalKey: 'distanceKm', bar: 'fill-emerald-500 dark:fill-emerald-400', dot: 'bg-emerald-500' },
  energy: { title: 'Active calories burned', from: 'days', field: 'activeCalories', unit: 'kcal', goalKey: 'burnKcal', bar: 'fill-violet-500 dark:fill-violet-400', dot: 'bg-violet-500' },
  floors: { title: 'Floors climbed', from: 'floors', field: 'floors', unit: 'floors', goal: FLOORS_GOAL, bar: 'fill-amber-500 dark:fill-amber-400', dot: 'bg-amber-500' },
  sleep: { title: 'Sleep', from: 'sleep', field: 'sleepHours', unit: 'h', decimals: 1, better: 'range', range: [7, 9], noun: 'night', bar: 'fill-indigo-500 dark:fill-indigo-400', dot: 'bg-indigo-500', scope: 'sleep' },
  glucose: { title: 'Glucose (daily average)', from: 'glucose', field: 'glucoseAvg', unit: 'mg/dL', better: null, bar: 'fill-teal-500 dark:fill-teal-400', dot: 'bg-teal-500' },
  oxygen: { title: 'SpO₂ (overnight)', from: 'oxygen', field: 'spo2', unit: '%', decimals: 1, better: null, bar: 'fill-cyan-500 dark:fill-cyan-400', dot: 'bg-cyan-500' },
};

function Insights({ lines }) {
  if (!lines?.length) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
      {lines.map((l) => (
        <li key={l} className="flex gap-1.5 text-xs leading-snug text-slate-600 dark:text-slate-300">
          <Lightbulb size={12} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

const PRESETS = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: '180d', label: '6M', days: 180 },
  { key: '365d', label: '1Y', days: 365 },
];
const MAX_CUSTOM_DAYS = 366;

function spanDays(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;
}

export default function ActivityClient({
  userId,
  entries,
  heightCm,
  goal,
  goals,
  googleHealthConnected,
  today,
}) {
  const [presetKey, setPresetKey] = useState('30d');
  const [custom, setCustom] = useState({ from: addDays(today, -29), to: today });
  const [rangeError, setRangeError] = useState(null);
  const [tiles, saveTiles] = useTileSelection(userId);

  const { from, to } = useMemo(() => {
    if (presetKey === 'custom') return custom;
    const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[1];
    return { from: addDays(today, -(preset.days - 1)), to: today };
  }, [presetKey, custom, today]);

  const handleCustom = (field) => (e) => {
    const next = { ...custom, [field]: e.target.value };
    if (!next.from || !next.to) {
      setCustom(next);
      return;
    }
    if (next.to > today) next.to = today;
    if (next.from > next.to) {
      setRangeError('Start date must be on or before the end date.');
      setCustom(next);
      return;
    }
    if (spanDays(next.from, next.to) > MAX_CUSTOM_DAYS) {
      setRangeError(`Pick a range of up to ${MAX_CUSTOM_DAYS} days.`);
      setCustom(next);
      return;
    }
    setRangeError(null);
    setCustom(next);
  };
  const rangeValid = !rangeError && from && to && from <= to;

  /* ---------- weight, filtered to the range ---------- */
  const weightInRange = useMemo(
    () => entries.filter((e) => e.logged_at >= from && e.logged_at <= to),
    [entries, from, to]
  );

  const weightInsight = useMemo(() => {
    const days = weightInRange.map((e) => ({ date: e.logged_at, value: Number(e.weight_kg) }));
    const better = goal === 'lose_weight' ? 'lower' : goal === 'gain_muscle' || goal === 'lean_mass' ? 'higher' : null;
    const res = interpret(days, { unit: 'kg', decimals: 1, better, noun: 'weigh-in' });
    if (days.length >= 2) {
      const change = days[days.length - 1].value - days[0].value;
      res.lines.splice(1, 0, `${change <= 0 ? 'Down' : 'Up'} ${Math.abs(change).toFixed(1)} kg from the first to the last weigh-in in this range.`);
    }
    return res.lines.filter((l) => !l.startsWith('Best') && !l.startsWith('Lowest'));
  }, [weightInRange, goal]);

  /* ---------- activity, fetched for the range ---------- */
  const showHeart = tiles.includes('heart');
  const extraKeys = useMemo(() => tiles.filter((k) => EXTRA_KEYS.includes(k)), [tiles]);
  const cache = useRef(new Map());
  const [activity, setActivity] = useState({ days: [], extras: {}, loading: false, error: null, reauth: false });

  useEffect(() => {
    if (!googleHealthConnected || !rangeValid) return undefined;
    const key = `${from}|${to}|${extraKeys.join(',')}`;
    if (cache.current.has(key)) {
      setActivity({ ...cache.current.get(key), loading: false, error: null, reauth: false });
      return undefined;
    }

    const controller = new AbortController();
    setActivity((prev) => ({ ...prev, loading: true, error: null }));
    fetch(`/api/google-health/history?from=${from}&to=${to}&keys=${extraKeys.join(',')}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data.reauthRequired) {
          setActivity({ days: [], extras: {}, loading: false, error: null, reauth: true });
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Could not load activity data');
        const value = { days: data.days ?? [], extras: data.extras ?? {} };
        cache.current.set(key, value);
        setActivity({ ...value, loading: false, error: null, reauth: false });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setActivity({ days: [], extras: {}, loading: false, error: err.message, reauth: false });
      });
    return () => controller.abort();
  }, [from, to, rangeValid, googleHealthConnected, extraKeys]);

  const series = (field) => activity.days.map((d) => ({ date: d.date, value: d[field] }));
  const extraSeries = (key, name) => activity.extras?.[key]?.data?.series?.[name] ?? [];
  const connectHref = (scope) =>
    `/api/google-health/connect?returnTo=%2Factivity${scope ? `&extra=${scope}` : ''}`;
  const heart = activity.extras?.heart;
  const heartInsight = useMemo(() => {
    const r = interpret(extraSeries('heart', 'resting'), { unit: 'bpm', better: 'lower' }).lines;
    const hi = extraSeries('heart', 'high').filter((d) => d.value != null);
    if (hi.length) {
      const top = hi.reduce((a, d) => (d.value > a.value ? d : a));
      r.push(`Highest heart rate: ${top.value} bpm on ${new Date(`${top.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`);
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.extras]);

  // The user's chosen stats, in their order (heart is featured above; calories
  // consumed lives on the Nutrition page).
  const statKeys = tiles.filter((k) => STAT_CHARTS[k]);

  return (
    <>
      {/* Range picker: drives every chart on the page. */}
      <div className={`${ui.card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-900 dark:text-white">
            <CalendarRange size={13} /> Range
          </div>
          <div className="flex min-w-0 items-center gap-2">
          <div
            role="tablist"
            aria-label="Date range"
            className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
          >
            {[...PRESETS, { key: 'custom', label: 'Custom' }].map((p) => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={presetKey === p.key}
                onClick={() => setPresetKey(p.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  presetKey === p.key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          
          </div>
          <EditTilesButton tiles={tiles} onSave={saveTiles} label="Edit stats" compact />
        </div>

        {presetKey === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <label className={ui.label}>
              From
              <input
                type="date"
                value={custom.from}
                max={custom.to || today}
                onChange={handleCustom('from')}
                className={ui.input}
              />
            </label>
            <label className={ui.label}>
              To
              <input
                type="date"
                value={custom.to}
                min={custom.from}
                max={today}
                onChange={handleCustom('to')}
                className={ui.input}
              />
            </label>
          </div>
        )}
        {rangeError && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{rangeError}</p>}
      </div>

      {/* Featured: weight and heart, side by side */}
      <div className={`grid grid-cols-1 gap-4 ${showHeart ? 'lg:grid-cols-2' : ''}`}>
        <div className={ui.card}>
          {weightInRange.length > 0 ? (
            <>
              <WeightTrendChart entries={weightInRange} />
              <Insights lines={weightInsight} />
            </>
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-1 text-center">
              <Scale size={18} className="text-slate-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {entries.length > 0 ? 'No weigh-ins in this range. Try a wider one.' : 'No weigh-ins yet. Log your first one below.'}
              </p>
            </div>
          )}
        </div>

        {showHeart && (
        <div className={ui.card}>
          {!googleHealthConnected ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">Connect Google Health to chart your heart rate next to your weight.</p>
              <a href={connectHref()} className={ui.btnPrimary}>
                Connect Google Health
              </a>
            </div>
          ) : heart?.needsPermission ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">Reconnect Google Health to allow reading your heart rate.</p>
              <a href={connectHref()} className={ui.btnPrimary}>
                Allow access
              </a>
            </div>
          ) : (
            <>
              <HeartTrendChart
                resting={extraSeries('heart', 'resting')}
                low={extraSeries('heart', 'low')}
                high={extraSeries('heart', 'high')}
                loading={activity.loading}
              />
              {!activity.loading && <Insights lines={heartInsight} />}
            </>
          )}
        </div>
        )}
      </div>

      {entries.length > 0 && <WeightStats entries={entries.slice(-90)} heightCm={heightCm} goal={goal} />}

      {/* Your stats: the same tiles chosen on the home page */}
      {googleHealthConnected ? (
        <>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-900 dark:text-white">Your stats</h2>

          {activity.reauth && (
            <div className={`${ui.card} flex flex-wrap items-center justify-between gap-3`}>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your Google Health connection expired. Reconnect to see your stats.
              </p>
              <a href={connectHref()} className={ui.btnPrimary}>
                Reconnect
              </a>
            </div>
          )}
          {activity.error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{activity.error}</p>}

          {!activity.reauth && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {statKeys.map((k) => {
                const c = STAT_CHARTS[k];
                const res = c.from === 'days' ? null : activity.extras?.[k];
                if (res?.needsPermission) {
                  return (
                    <div key={k} className={`${ui.card} flex flex-col items-start justify-between gap-3`}>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">{c.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Allow WAY to read this from Google Health.</p>
                      <a href={connectHref(c.scope)} className={ui.btnPrimary}>
                        Allow access
                      </a>
                    </div>
                  );
                }
                const days = c.from === 'days' ? series(c.field) : extraSeries(k, c.field);
                const goalValue = c.goal ?? (c.goalKey ? goals[c.goalKey] : null);
                const lines = interpret(days, {
                  unit: c.unit,
                  decimals: c.decimals ?? 0,
                  goal: goalValue,
                  better: c.better === undefined ? 'higher' : c.better,
                  range: c.range,
                  noun: c.noun,
                }).lines;
                if (k === 'oxygen') {
                  const vo2 = extraSeries('oxygen', 'vo2').filter((d) => d.value != null);
                  if (vo2.length) {
                    const last = vo2[vo2.length - 1];
                    lines.push(
                      `VO₂ max: ${last.value}${vo2.length > 1 ? ` (${last.value - vo2[0].value >= 0 ? '+' : ''}${(last.value - vo2[0].value).toFixed(1)} over the range)` : ''}.`
                    );
                  }
                  const low = days.filter((d) => d.value != null && d.value < 95).length;
                  if (days.some((d) => d.value != null)) lines.push(`${low} night${low === 1 ? '' : 's'} averaged below 95%.`);
                }
                return (
                  <div key={k} className={ui.card}>
                    <ActivityChart
                      title={c.title}
                      days={days}
                      unit={c.unit === 'steps' || c.unit === 'floors' ? '' : c.unit}
                      decimals={c.decimals ?? 0}
                      goal={goalValue}
                      barClass={c.bar}
                      dotClass={c.dot}
                      loading={activity.loading}
                    />
                    {!activity.loading && <Insights lines={lines} />}
                  </div>
                );
              })}
              {tiles.includes('consumed') && (
                <div className={`${ui.card} flex flex-col justify-between gap-2`}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">Calories consumed</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Your daily calories and macros are charted on the Nutrition page.</p>
                  <Link href="/nutrition" className={`${ui.btnPrimary} self-start`}>
                    Open Nutrition
                  </Link>
                </div>
              )}
              {!statKeys.length && !tiles.includes('consumed') && (
                <p className="text-sm text-slate-500 dark:text-slate-400">No stats selected. Use Edit stats to choose some.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className={`${ui.card} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/40 text-blue-600 dark:text-blue-400">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Steps, sleep, heart and more</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect Google Health to chart your activity alongside your weight.
              </p>
            </div>
          </div>
          <a href={connectHref()} className={ui.btnPrimary}>
            Connect Google Health
          </a>
        </div>
      )}

      <div className={ui.card}>
        <WeighInForm />
      </div>

      {entries.length > 0 && (
        <div className={ui.card}>
          <WeightHistoryList entries={entries.slice(-90)} />
        </div>
      )}
    </>
  );
}