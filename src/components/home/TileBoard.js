'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, X, ArrowUp, ArrowDown, RotateCcw, Footprints, Navigation, Flame, HeartPulse, Droplets, Building2, Moon, Activity, Target } from 'lucide-react';
import {
  StepsWidget,
  DistanceWidget,
  CaloriesBurnedWidget,
  RemainingGoalWidget,
  HeartWidget,
  OxygenFitnessWidget,
  FloorsWidget,
  SleepWidget,
  GlucoseWidget,
} from './GoogleHealthWidgets';

/**
 * The home tile row, customisable per user.
 *
 *  - "Edit tiles" opens a picker: switch tiles on/off and change their order.
 *  - The choice is saved in this browser (localStorage) per user.
 *  - Only the optional tiles that are switched on are fetched, in one request
 *    to /api/google-health/tiles; each comes back on its own, so a missing
 *    permission (e.g. sleep) only affects that tile.
 */

export const TILE_CATALOG = [
  { key: 'steps', label: 'Steps', Icon: Footprints, hint: 'Steps and your daily step goal' },
  { key: 'distance', label: 'Distance', Icon: Navigation, hint: 'Distance walked or run' },
  { key: 'energy', label: 'Energy burned', Icon: Flame, hint: 'Total burned, active calories vs goal' },
  { key: 'heart', label: 'Heart rate', Icon: HeartPulse, hint: 'Resting, today’s high/low, irregular rhythm alerts' },
  { key: 'oxygen', label: 'SpO₂ & VO₂ max', Icon: Droplets, hint: 'Overnight blood oxygen and cardio fitness' },
  { key: 'floors', label: 'Floors climbed', Icon: Building2, hint: 'Floors climbed vs a 10-floor goal' },
  { key: 'sleep', label: 'Sleep', Icon: Moon, hint: 'Last night’s sleep and stages (asks for sleep access)' },
  { key: 'glucose', label: 'Glucose', Icon: Activity, hint: 'Blood glucose readings logged today' },
  { key: 'consumed', label: 'Calories consumed', Icon: Target, hint: 'Calories eaten vs your target' },
];
export const DEFAULT_TILES = ['steps', 'distance', 'energy', 'heart'];
const MAX_TILES = 8;
const EXTRA_KEYS = new Set(['heart', 'oxygen', 'floors', 'sleep', 'glucose']);
// Optional Google permissions some tiles need (requested only when they're on).
const TILE_SCOPES = { sleep: 'sleep' };
const storageKey = (userId) => `way.homeTiles.v1.${userId || 'me'}`;

function readSaved(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const valid = arr.filter((k) => TILE_CATALOG.some((t) => t.key === k));
    return valid.length ? valid.slice(0, MAX_TILES) : null;
  } catch {
    return null;
  }
}

export default function TileBoard({
  userId,
  selectedDate,
  today,
  healthData,
  healthLoading,
  goals = {},
  consumed,
  currentTargets,
}) {
  const [tiles, setTiles] = useState(DEFAULT_TILES);
  const [editing, setEditing] = useState(false);
  const [extras, setExtras] = useState({});
  const [extrasLoading, setExtrasLoading] = useState(false);

  // Restore after mount (localStorage isn't available during server render).
  useEffect(() => {
    const saved = readSaved(userId);
    if (saved) setTiles(saved);
  }, [userId]);

  const save = useCallback(
    (next) => {
      setTiles(next);
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        /* private mode: keep for this session only */
      }
    },
    [userId]
  );

  const extraKeys = useMemo(() => tiles.filter((k) => EXTRA_KEYS.has(k)), [tiles]);

  useEffect(() => {
    if (!extraKeys.length || !selectedDate) return undefined;
    const ctrl = new AbortController();
    setExtrasLoading(true);
    fetch(`/api/google-health/tiles?date=${selectedDate}&keys=${extraKeys.join(',')}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setExtras(d?.tiles || {}))
      .catch((e) => {
        if (e.name !== 'AbortError') console.error('tiles fetch failed', e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setExtrasLoading(false);
      });
    return () => ctrl.abort();
  }, [extraKeys, selectedDate]);

  // Reconnect link that also asks for every optional permission the user's
  // tiles need, plus any extra one (e.g. 'irn' for irregular rhythm alerts).
  const connectHref = useCallback(
    (extra) => {
      const scopes = new Set(tiles.map((k) => TILE_SCOPES[k]).filter(Boolean));
      if (extra) scopes.add(extra);
      const q = new URLSearchParams({ returnTo: '/home' });
      if (scopes.size) q.set('extra', [...scopes].join(','));
      return `/api/google-health/connect?${q.toString()}`;
    },
    [tiles]
  );

  const render = (key) => {
    const common = { loading: extrasLoading && !extras[key], result: extras[key], today, connectHref };
    switch (key) {
      case 'steps':
        return <StepsWidget steps={healthData.steps} targetSteps={goals.steps ?? null} loading={healthLoading} />;
      case 'distance':
        return <DistanceWidget distanceKm={healthData.distanceKm} targetKm={goals.distanceKm ?? null} loading={healthLoading} />;
      case 'energy':
        return (
          <CaloriesBurnedWidget
            caloriesBurned={healthData.caloriesBurned}
            activeCalories={healthData.activeCalories}
            targetBurn={goals.burnKcal ?? null}
            loading={healthLoading}
          />
        );
      case 'consumed':
        return <RemainingGoalWidget consumedCalories={consumed?.calories ?? 0} targetCalories={currentTargets?.targetCalories} />;
      case 'heart':
        return <HeartWidget {...common} />;
      case 'oxygen':
        return <OxygenFitnessWidget {...common} />;
      case 'floors':
        return <FloorsWidget {...common} />;
      case 'sleep':
        return <SleepWidget {...common} />;
      case 'glucose':
        return <GlucoseWidget {...common} />;
      default:
        return null;
    }
  };

  return (
    <section aria-label="Health tiles" className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <Pencil size={12} /> Edit tiles
        </button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((key) => (
          <div key={key} className="min-w-0">
            {render(key)}
          </div>
        ))}
      </div>

      {editing && <TilePicker current={tiles} onClose={() => setEditing(false)} onSave={(next) => { save(next); setEditing(false); }} />}
    </section>
  );
}

/** Modal: switch tiles on/off and reorder them. */
function TilePicker({ current, onClose, onSave }) {
  const [draft, setDraft] = useState(current);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (key) =>
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : d.length >= MAX_TILES ? d : [...d, key]));
  const move = (key, dir) =>
    setDraft((d) => {
      const i = d.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = d.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  // Selected tiles first (in their order), then the rest.
  const ordered = [...draft.map((k) => TILE_CATALOG.find((t) => t.key === k)), ...TILE_CATALOG.filter((t) => !draft.includes(t.key))].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tile-picker-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="tile-picker-title" className="text-base font-bold text-slate-900 dark:text-white">Home tiles</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Choose up to {MAX_TILES} tiles and their order. {draft.length}/{MAX_TILES} selected.
        </p>

        <ul className="mt-3 max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
          {ordered.map((t) => {
            const on = draft.includes(t.key);
            const idx = draft.indexOf(t.key);
            return (
              <li key={t.key} className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 ${on ? 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60' : 'border-slate-200 dark:border-slate-800'}`}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && draft.length >= MAX_TILES}
                    onChange={() => toggle(t.key)}
                    className="h-4 w-4 shrink-0 accent-emerald-500"
                  />
                  <t.Icon size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{t.label}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{t.hint}</span>
                  </span>
                </label>
                {on && (
                  <span className="flex shrink-0 gap-0.5">
                    <button type="button" onClick={() => move(t.key, -1)} disabled={idx === 0} aria-label={`Move ${t.label} up`} className="rounded-lg p-1 text-slate-500 hover:bg-white disabled:opacity-30 dark:hover:bg-slate-700">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => move(t.key, 1)} disabled={idx === draft.length - 1} aria-label={`Move ${t.label} down`} className="rounded-lg p-1 text-slate-500 hover:bg-white disabled:opacity-30 dark:hover:bg-slate-700">
                      <ArrowDown size={14} />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setDraft(DEFAULT_TILES)} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
            <RotateCcw size={12} /> Reset to default
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(draft.length ? draft : DEFAULT_TILES)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
