'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Footprints,
  Navigation,
  Flame,
  HeartPulse,
  Droplets,
  Building2,
  Moon,
  Activity,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CircleCheck,
  Trophy,
  Lock,
} from 'lucide-react';
import { TILE_DEFS, TILE_KEYS, DEFAULT_TILE_KEYS } from '@/lib/daily';
import { Btn, Modal, Toggle, cx } from './ui';

export const TILE_ICONS = {
  steps: Footprints,
  distance: Navigation,
  energy: Flame,
  heart: HeartPulse,
  oxygen: Droplets,
  floors: Building2,
  sleep: Moon,
  glucose: Activity,
};
export const MAX_TILES = 8;

// Same key as before the redesign, so people keep the tiles they picked.
const storageKey = (userId) => `way.homeTiles.v1.${userId || 'me'}`;

const CHANGE = 'way-tiles-change';

function readRaw(userId) {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function parseSaved(raw) {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const valid = arr.filter((k) => TILE_KEYS.includes(k));
    return valid.length ? valid.slice(0, MAX_TILES) : null;
  } catch {
    return null;
  }
}

function subscribe(cb) {
  window.addEventListener('storage', cb);
  window.addEventListener(CHANGE, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(CHANGE, cb);
  };
}

/**
 * The user's chosen tiles, shared by Today (tiles) and Activity (stats).
 * Stored in this browser; other tabs pick up changes too.
 */
export function useTileSelection(userId) {
  const raw = useSyncExternalStore(subscribe, () => readRaw(userId), () => null);
  const tiles = useMemo(() => parseSaved(raw) || DEFAULT_TILE_KEYS, [raw]);
  const save = useCallback(
    (next) => {
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        /* private mode: nothing to persist to */
      }
      window.dispatchEvent(new Event(CHANGE));
    },
    [userId]
  );
  return [tiles, save];
}

/** Switch tiles on and off and set their order. */
export function EditTilesDialog(props) {
  // Mounted only while open, so every opening starts from the saved choice.
  return props.open ? <EditTilesPanel {...props} /> : null;
}

function EditTilesPanel({ onClose, current, onSave, title = 'Edit tiles', subtitle, saveLabel = 'Save tiles' }) {
  const [draft, setDraft] = useState(current);

  const ordered = [...draft.map((k) => TILE_DEFS.find((t) => t.key === k)), ...TILE_DEFS.filter((t) => !draft.includes(t.key))].filter(Boolean);
  const move = (key, dir) =>
    setDraft((d) => {
      const i = d.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = d.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const toggle = (key) =>
    setDraft((d) => (d.includes(key) ? (d.length > 1 ? d.filter((k) => k !== key) : d) : d.length < MAX_TILES ? [...d, key] : d));

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle={subtitle ?? 'Switch tiles on, set their order. Calories and Body Age are always on Today.'}
      footer={
        <>
          <Btn variant="outline" onClick={() => setDraft(DEFAULT_TILE_KEYS)} className="flex-1 md:mr-auto md:flex-none">
            <RotateCcw size={13} />
            Reset<span className="hidden md:inline"> to default</span>
          </Btn>
          <Btn variant="outline" onClick={onClose} className="hidden md:inline-flex">
            Cancel
          </Btn>
          <Btn variant="primary" onClick={() => onSave(draft)} className="flex-[2] md:flex-none">
            {saveLabel}
          </Btn>
        </>
      }
    >
      <div className="mb-2 font-mono text-[11px] font-medium text-way-dim">
        {draft.length} of {MAX_TILES} tiles on
      </div>
      <ul className="flex flex-col gap-1.5">
        {ordered.map((t) => {
          const on = draft.includes(t.key);
          const Icon = TILE_ICONS[t.key];
          const idx = draft.indexOf(t.key);
          return (
            <li
              key={t.key}
              className={cx('flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors md:px-3', on ? 'bg-way-hover' : '')}
            >
              <Icon size={17} className="w-[22px] shrink-0" style={{ color: on ? t.color : '#475569' }} />
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[13px] font-semibold md:text-sm">{t.label}</span>
                <span className="truncate text-[11px] text-way-dim md:text-xs">{t.hint}</span>
              </div>
              {on ? (
                <>
                  <button
                    type="button"
                    onClick={() => move(t.key, -1)}
                    disabled={idx === 0}
                    aria-label={`Move ${t.label} up`}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-way-line2 text-way-mute disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(t.key, 1)}
                    disabled={idx === draft.length - 1}
                    aria-label={`Move ${t.label} down`}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-way-line2 text-way-mute disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                </>
              ) : null}
              <Toggle on={on} onChange={() => toggle(t.key)} label={`Show ${t.label}`} disabled={!on && draft.length >= MAX_TILES} />
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

const STYLES = {
  progress: { border: '#1c2433', bg: '#0f1420', badgeColor: '#94a3b8', badgeBg: 'transparent', subColor: '#64748b' },
  info: { border: '#1c2433', bg: '#0f1420', badgeColor: '#94a3b8', badgeBg: 'transparent', subColor: '#64748b' },
  reached: {
    border: 'rgba(52,211,153,.35)',
    bg: 'linear-gradient(180deg, rgba(52,211,153,.07), rgba(52,211,153,0) 55%), #0f1420',
    bar: '#34d399',
    badgeColor: '#6ee7b7',
    badgeBg: 'rgba(52,211,153,.12)',
    Badge: CircleCheck,
    subColor: '#6ee7b7',
  },
  exceeded: {
    border: 'rgba(250,204,21,.45)',
    bg: 'linear-gradient(180deg, rgba(250,204,21,.10), rgba(250,204,21,0) 60%), #0f1420',
    bar: 'linear-gradient(90deg,#34d399,#facc15)',
    badgeColor: '#fde047',
    badgeBg: 'rgba(250,204,21,.14)',
    Badge: Trophy,
    subColor: '#fde047',
  },
};

/**
 * One health tile with its fulfilment level: in progress, goal reached
 * (green), or past the goal (gold). The bar runs to 120% with a tick at 100%.
 */
export function HealthTile({ tileKey, model, k = 1, delay = 0, connectHref }) {
  const def = TILE_DEFS.find((t) => t.key === tileKey);
  const Icon = TILE_ICONS[tileKey];
  const s = STYLES[model.status] || STYLES.info;
  const hasBadge = model.status === 'reached' || model.status === 'exceeded';
  const fill = model.pct == null ? 0 : (Math.max(0, Math.min(model.pct, 120)) / 120) * 100 * k;

  return (
    <div
      className="way-rise flex min-w-0 flex-col gap-2.5 rounded-[18px] border p-3.5 transition-[border-color,background] duration-[400ms] md:gap-3 md:rounded-[20px] md:px-[22px] md:py-5"
      style={{ borderColor: s.border, background: s.bg, '--d': `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-way-mute md:gap-2 md:text-[13px]">
          <Icon size={14} className="shrink-0" style={{ color: def.color }} />
          <span className="truncate">{def.label}</span>
        </div>
        {hasBadge ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full font-mono text-[10px] font-semibold md:px-2 md:py-[3px]"
            style={{ color: s.badgeColor, background: s.badgeBg }}
            title={model.badge}
          >
            <s.Badge size={12} />
            <span className="hidden md:inline">{model.badge}</span>
          </span>
        ) : null}
      </div>

      {model.state ? (
        <TileState state={model.state} sub={model.sub} connectHref={connectHref} />
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[22px] font-semibold leading-none md:text-[30px]">{model.v}</span>
            {model.unit ? <span className="font-mono text-[11px] font-medium text-way-dim md:text-xs">{model.unit}</span> : null}
          </div>
          <div className="relative h-1 rounded-full bg-way-track md:h-[5px]">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width,background] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ width: `${fill}%`, background: s.bar || def.color }}
            />
            {model.hasGoal ? <div className="absolute -top-[3px] -bottom-[3px] left-[83.33%] w-0.5 rounded-sm bg-way-faint" /> : null}
          </div>
          <span className="text-[11px] md:text-xs" style={{ color: s.subColor }}>
            {model.sub}
          </span>
        </>
      )}
    </div>
  );
}

function TileState({ state, sub, connectHref }) {
  if (state === 'loading') {
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true">
        <div className="h-[22px] w-20 animate-pulse rounded-md bg-way-track md:h-[30px]" />
        <div className="h-1 animate-pulse rounded-full bg-way-track" />
        <div className="h-3 w-28 animate-pulse rounded bg-way-track" />
      </div>
    );
  }
  if (state === 'permission') {
    return (
      <div className="flex flex-col items-start gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-way-mute md:text-xs">
          <Lock size={12} />
          {sub}
        </span>
        {connectHref ? (
          <a href={connectHref} className="rounded-lg border border-way-line2 px-2.5 py-1.5 text-[11px] font-semibold text-way-ink2 hover:bg-way-hover">
            Allow access
          </a>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[22px] font-semibold leading-none text-way-faint md:text-[30px]">—</span>
      <span className="text-[11px] text-way-dim md:text-xs">{sub}</span>
    </div>
  );
}

/**
 * Even rows: up to 4 tiles in one row, more split into two rows (3 + 3, 4 + 3…).
 * Returns the desktop column span (of 12) for tile i of n.
 */
export function tileSpan(i, n) {
  const rows = n <= 4 ? 1 : 2;
  const r1 = Math.ceil(n / rows);
  const inRow = i < r1 ? r1 : n - r1;
  return 12 / inRow;
}
