'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, CalendarRange } from 'lucide-react';
import { ui } from '@/lib/ui';
import { addDays } from '@/lib/dateUtils';
import WeightStats from '@/components/weight/WeightStats';
import WeightTrendChart from '@/components/weight/WeightTrendChart';
import WeighInForm from '@/components/weight/WeighInForm';
import WeightHistoryList from '@/components/weight/WeightHistoryList';
import ActivityChart from '@/components/activity/ActivityChart';

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

  /* ---------- activity, fetched for the range ---------- */
  const cache = useRef(new Map());
  const [activity, setActivity] = useState({ days: [], loading: false, error: null, reauth: false });

  useEffect(() => {
    if (!googleHealthConnected || !rangeValid) return undefined;
    const key = `${from}|${to}`;
    if (cache.current.has(key)) {
      setActivity({ days: cache.current.get(key), loading: false, error: null, reauth: false });
      return undefined;
    }

    const controller = new AbortController();
    setActivity((prev) => ({ ...prev, loading: true, error: null }));
    fetch(`/api/google-health/history?from=${from}&to=${to}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data.reauthRequired) {
          setActivity({ days: [], loading: false, error: null, reauth: true });
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Could not load activity data');
        cache.current.set(key, data.days ?? []);
        setActivity({ days: data.days ?? [], loading: false, error: null, reauth: false });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setActivity({ days: [], loading: false, error: err.message, reauth: false });
      });
    return () => controller.abort();
  }, [from, to, rangeValid, googleHealthConnected]);

  const series = (field) => activity.days.map((d) => ({ date: d.date, value: d[field] }));

  return (
    <>
      {/* Range picker: drives every chart on the page. */}
      <div className={`${ui.card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-900 dark:text-white">
            <CalendarRange size={13} /> Range
          </div>
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

      {/* Weight */}
      {entries.length > 0 && (
        <WeightStats entries={entries.slice(-90)} heightCm={heightCm} goal={goal} />
      )}

      <div className={ui.card}>
        {weightInRange.length > 0 ? (
          <WeightTrendChart entries={weightInRange} />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {entries.length > 0
              ? 'No weigh-ins in this range — try a wider one.'
              : 'No weigh-ins yet — log your first one below.'}
          </p>
        )}
      </div>

      {/* Activity */}
      {googleHealthConnected ? (
        <>
          {activity.reauth && (
            <div className={`${ui.card} flex flex-wrap items-center justify-between gap-3`}>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your Google Health connection expired. Reconnect to see steps, distance and calories.
              </p>
              <a href="/api/google-health/connect?returnTo=%2Factivity" className={ui.btnPrimary}>
                Reconnect
              </a>
            </div>
          )}
          {activity.error && (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{activity.error}</p>
          )}
          {!activity.reauth && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className={ui.card}>
                <ActivityChart
                  title="Steps"
                  days={series('steps')}
                  goal={goals.steps}
                  barClass="fill-blue-500 dark:fill-blue-400"
                  dotClass="bg-blue-500"
                  loading={activity.loading}
                />
              </div>
              <div className={ui.card}>
                <ActivityChart
                  title="Distance"
                  days={series('distanceKm')}
                  unit="km"
                  decimals={1}
                  goal={goals.distanceKm}
                  barClass="fill-emerald-500 dark:fill-emerald-400"
                  dotClass="bg-emerald-500"
                  loading={activity.loading}
                />
              </div>
              <div className={ui.card}>
                <ActivityChart
                  title="Active calories burned"
                  days={series('activeCalories')}
                  unit="kcal"
                  goal={goals.burnKcal}
                  barClass="fill-amber-500 dark:fill-amber-400"
                  dotClass="bg-amber-500"
                  loading={activity.loading}
                />
              </div>
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
              <p className="text-sm font-bold text-slate-900 dark:text-white">Steps, distance and calories burned</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect Google Health to chart your activity alongside your weight.
              </p>
            </div>
          </div>
          <a href="/api/google-health/connect?returnTo=%2Factivity" className={ui.btnPrimary}>
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
