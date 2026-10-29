'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import {
  DEFAULT_UNITS,
  UNIT_CHOICES,
  normalizeUnits,
  kgToDisplay,
  displayToKg,
  weightUnit,
  cmToFtIn,
  ftInToCm,
} from '@/lib/units';
import { cx } from './tokens';

const LOCAL_KEY = 'way.unitPrefs';
const Ctx = createContext(null);

/**
 * Your display units (height, weight, body measurements), shared by every
 * page. Saved on your profile (profiles.units, supabase/units-2026-10.sql) so
 * the choice follows you to other devices; also kept in this browser, which
 * is what's used until that column exists.
 */
export function UnitsProvider({ initial, userId, children }) {
  const fromServer = initial && typeof initial === 'object' && Object.keys(initial).length > 0;
  const [units, setUnits] = useState(() => normalizeUnits(initial));
  const supabase = useRef(null);

  useEffect(() => {
    if (fromServer) return;
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      if (saved) {
        const u = normalizeUnits(saved);
        setUnits(u);
        // Picked before the profile existed (onboarding): keep it on the profile too.
        if (userId) {
          supabase.current ??= createClient();
          supabase.current.from('profiles').update({ units: u }).eq('id', userId).then(() => null, () => null);
        }
      }
    } catch {
      // storage blocked: defaults are fine
    }
  }, [fromServer, userId]);

  const setUnit = useCallback(
    (kind, value) => {
      setUnits((u) => {
        const next = normalizeUnits({ ...u, [kind]: value });
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        if (userId) {
          supabase.current ??= createClient();
          supabase.current
            .from('profiles')
            .update({ units: next })
            .eq('id', userId)
            .then(({ error }) => error && console.warn('[units] not saved to profile:', error.message));
        }
        return next;
      });
    },
    [userId]
  );

  return <Ctx.Provider value={{ units, setUnit }}>{children}</Ctx.Provider>;
}

/** { units, setUnit(kind, value) }. Outside a provider: metric, and switching works for this page only. */
export function useUnits() {
  const ctx = useContext(Ctx);
  const [local, setLocal] = useState(DEFAULT_UNITS);
  if (ctx) return ctx;
  return { units: local, setUnit: (kind, value) => setLocal((u) => normalizeUnits({ ...u, [kind]: value })) };
}

/** Small switch for one kind of unit: kg | lb, cm | ft · in, cm | in. */
export function UnitSwitch({ kind, className = '', size = 'sm', plain = false }) {
  const { units, setUnit } = useUnits();
  return (
    <span
      role="radiogroup"
      aria-label={`${kind} units`}
      className={cx(
        'inline-flex shrink-0 rounded-lg border p-0.5',
        plain ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900' : 'border-way-line2 bg-way-rail',
        className
      )}
    >
      {UNIT_CHOICES[kind].map(([v, label]) => {
        const on = units[kind] === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setUnit(kind, v)}
            className={cx(
              'rounded-md font-mono font-semibold transition-colors',
              size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
              on
                ? plain
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-way-ink text-way-page'
                : plain
                  ? 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  : 'text-way-dim hover:text-way-ink2'
            )}
          >
            {label}
          </button>
        );
      })}
    </span>
  );
}

const trim = (v, dec) => String(Math.round(v * 10 ** dec) / 10 ** dec);

/**
 * A weight input in your unit. `kg` in, `onChange(kg | '')` out. Keeps what
 * you type as typed (no rounding mid-edit) and re-reads `kg` when the unit
 * or the value changes from outside.
 */
export function WeightInput({ kg, onChange, className = '', placeholderKg, ...rest }) {
  const { units } = useUnits();
  const shown = (v) => (v === '' || v == null ? '' : trim(kgToDisplay(v, units), 1));
  const [text, setText] = useState(() => shown(kg));
  const lastKg = useRef(kg);
  useEffect(() => {
    if (kg !== lastKg.current) {
      lastKg.current = kg;
      setText(shown(kg));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kg]);
  useEffect(() => {
    setText(shown(lastKg.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units.weight]);
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.1"
      value={text}
      placeholder={placeholderKg != null ? `e.g. ${trim(kgToDisplay(placeholderKg, units), 0)}` : undefined}
      onChange={(e) => {
        setText(e.target.value);
        const v = e.target.value === '' ? '' : Math.round(displayToKg(e.target.value, units) * 100) / 100;
        lastKg.current = v;
        onChange(v);
      }}
      className={className}
      aria-label={`Weight in ${weightUnit(units)}`}
      {...rest}
    />
  );
}

/**
 * A height input in your unit: one box in cm, or feet + inches. `cm` in,
 * `onChange(cm | '')` out.
 */
export function HeightInput({ cm, onChange, className = '', boxClassName = '', suffixClassName = '' }) {
  const { units } = useUnits();
  const parts = (v) => (v === '' || v == null || !(Number(v) > 0) ? { ft: '', inch: '' } : (({ ft, inch }) => ({ ft: String(ft), inch: String(inch) }))(cmToFtIn(v)));
  const [cmText, setCmText] = useState(() => (cm === '' || cm == null ? '' : trim(Number(cm), 1)));
  const [fi, setFi] = useState(() => parts(cm));
  const lastCm = useRef(cm);
  useEffect(() => {
    if (cm !== lastCm.current) {
      lastCm.current = cm;
      setCmText(cm === '' || cm == null ? '' : trim(Number(cm), 1));
      setFi(parts(cm));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cm]);
  const emit = (v) => {
    lastCm.current = v;
    onChange(v);
  };
  if (units.height !== 'ftin') {
    return (
      <span className={cx('flex min-w-0 flex-1 items-center gap-1', boxClassName)}>
        <input
          type="number"
          inputMode="decimal"
          value={cmText}
          placeholder="e.g. 170"
          aria-label="Height in centimetres"
          onChange={(e) => {
            setCmText(e.target.value);
            emit(e.target.value === '' ? '' : Number(e.target.value));
          }}
          className={className}
        />
        <span className={suffixClassName}>cm</span>
      </span>
    );
  }
  const update = (next) => {
    setFi(next);
    emit(next.ft === '' && next.inch === '' ? '' : Math.round(ftInToCm(next.ft, next.inch) * 10) / 10);
  };
  return (
    <span className={cx('flex min-w-0 flex-1 items-center gap-1', boxClassName)}>
      <input type="number" inputMode="numeric" min={3} max={8} value={fi.ft} placeholder="5" aria-label="Height, feet" onChange={(e) => update({ ...fi, ft: e.target.value })} className={className} />
      <span className={suffixClassName}>ft</span>
      <input type="number" inputMode="numeric" min={0} max={11} value={fi.inch} placeholder="7" aria-label="Height, inches" onChange={(e) => update({ ...fi, inch: e.target.value })} className={className} />
      <span className={suffixClassName}>in</span>
    </span>
  );
}

const BOX = 'flex h-11 items-center gap-1 rounded-xl border border-way-line2 bg-way-rail px-3 focus-within:border-way-faint';
const INPUT = 'way-num w-full min-w-0 flex-1 bg-transparent font-mono text-[15px] font-semibold text-way-ink outline-none placeholder:text-way-faint';
const SUFFIX = 'font-mono text-[10px] font-medium text-way-dim';

/** NumField-style weight field with its own kg | lb switch. */
export function WeightField({ label = 'Weight', kg, onChange, placeholderKg }) {
  const { units } = useUnits();
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-xs text-way-mute">
      <span className="flex items-center justify-between gap-1.5">
        {label}
        <UnitSwitch kind="weight" />
      </span>
      <label className={BOX}>
        <WeightInput kg={kg} onChange={onChange} placeholderKg={placeholderKg} className={INPUT} />
        <span className={SUFFIX}>{weightUnit(units)}</span>
      </label>
    </div>
  );
}

/** NumField-style height field with its own cm | ft · in switch. */
export function HeightField({ label = 'Height', cm, onChange }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-xs text-way-mute">
      <span className="flex items-center justify-between gap-1.5">
        {label}
        <UnitSwitch kind="height" />
      </span>
      <label className={BOX}>
        <HeightInput cm={cm} onChange={onChange} className={INPUT} suffixClassName={SUFFIX} />
      </label>
    </div>
  );
}
