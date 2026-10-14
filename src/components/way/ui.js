'use client';

/**
 * Shared building blocks for the redesigned dashboard (dark, editorial).
 * Colours come from the --color-way-* tokens in app/globals.css.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

/** Page body: 16px gutters on phones, room for the bottom bar; 40px gutters on desktop. */
export const PAGE =
  'mx-auto flex w-full max-w-[1360px] flex-col gap-3.5 px-4 pt-6 pb-[calc(104px+env(safe-area-inset-bottom))] md:gap-5 md:px-10 md:pt-8 md:pb-10';

/** Indian digit grouping, rounded: 12,450. */
export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');
/** One decimal, trailing .0 kept: 79.0. */
export const f1 = (n) => (Number(n) || 0).toFixed(1);

export const MACRO_COLORS = {
  calories: '#fbbf24',
  protein: '#34d399',
  carbs: '#60a5fa',
  fat: '#a78bfa',
  over: '#fb7185',
};

const noopSubscribe = () => () => {};
/** True in the browser, false during server render (no hydration mismatch). */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** The animation "k" factor: 0 on the first paint, 1 right after, so bars grow in. */
export function useMounted(delay = 60) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // A page loaded in a background tab never gets animation frames, so a
    // timeout (not rAF) flips this; the content must never stay at 0.
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return mounted;
}

export function Card({ as: Tag = 'section', className = '', rise = false, delay = 0, style, children, ...rest }) {
  return (
    <Tag
      className={cx('rounded-[22px] border border-way-line bg-way-card', rise && 'way-rise', className)}
      style={rise ? { '--d': `${delay}ms`, ...style } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Small uppercase section label ("DAILY SCORE"). */
export function Eyebrow({ className = '', children, style }) {
  return (
    <span
      className={cx('font-heading text-xs font-bold uppercase tracking-[0.14em] text-way-mute', className)}
      style={style}
    >
      {children}
    </span>
  );
}

/** Page title row: big narrow title, mono subtitle, optional right side. */
export function PageHeader({ title, sub, right, back }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-0.5 md:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        {back}
        <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3.5">
          <h1 className="font-heading text-[28px] font-bold leading-none tracking-[-0.01em] md:text-[34px]">{title}</h1>
          {sub ? <span className="truncate font-mono text-[11px] font-medium text-way-dim md:text-xs">{sub}</span> : null}
        </div>
      </div>
      {right ? <div className="flex items-center gap-3">{right}</div> : null}
    </header>
  );
}

/** Pill-shaped segmented control with a light "on" state. */
export function Segmented({ options, value, onChange, size = 'md', mono = false, className = '', stretch = false }) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-[13px]';
  return (
    <div
      role="tablist"
      className={cx(
        'gap-1 rounded-[14px] border border-way-line bg-way-card p-1',
        stretch ? 'grid' : 'flex',
        className
      )}
      style={stretch ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-semibold transition-colors duration-200',
              pad,
              mono && 'font-mono',
              on ? 'bg-way-ink text-way-page' : 'text-way-mute hover:text-way-ink'
            )}
          >
            {o.icon ? <o.icon size={size === 'sm' ? 13 : 14} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** iOS-style switch. */
export function Toggle({ on, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40',
        on ? 'bg-emerald-500' : 'bg-way-line2'
      )}
    >
      <span
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-slate-50 transition-[left] duration-200"
        style={{ left: on ? 19 : 3 }}
      />
    </button>
  );
}

/** Rounded progress track. `pct` 0..100. */
export function Bar({ pct = 0, color = '#34d399', height = 4, className = '', background, children }) {
  return (
    <div className={cx('relative overflow-hidden rounded-full bg-way-track', className)} style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: background || color }}
      />
      {children}
    </div>
  );
}

const BTN = {
  primary: 'bg-way-ink text-way-page hover:bg-white',
  outline: 'border border-way-line2 text-way-ink2 hover:bg-way-hover hover:border-way-line3',
  accent: 'bg-way-protein text-way-page hover:bg-emerald-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  dangerOutline: 'border border-rose-400/40 text-rose-300 hover:bg-rose-400/10',
  ghost: 'text-way-mute hover:text-way-ink hover:bg-way-hover',
  muted: 'bg-way-track text-way-faint',
};

export function Btn({ variant = 'primary', size = 'md', className = '', as: Tag = 'button', children, ...rest }) {
  const sz = size === 'sm' ? 'h-8 px-3 text-xs rounded-full' : size === 'lg' ? 'h-12 px-5 text-sm rounded-[14px]' : 'h-10 px-4 text-[13px] rounded-xl';
  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button' } : {})}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
        sz,
        BTN[variant],
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Small round icon button (close, prev/next). */
export function IconBtn({ label, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-way-line2 text-way-mute transition-colors hover:bg-way-hover hover:text-way-ink disabled:opacity-35',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Coloured dot + label, used for macro legends. */
export function Dot({ color, size = 6 }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

/**
 * Dialog on desktop, bottom sheet on phones. Rendered into <body> above the
 * navigation; Escape and the backdrop close it; the page behind stops scrolling.
 */
export function Modal({ open, onClose, title, subtitle, children, footer, width = 520 }) {
  const mounted = useIsClient();
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(3,6,12,.72)] md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className="dark way-rise flex max-h-[86vh] w-full flex-col gap-4 rounded-t-3xl border-t border-way-line2 bg-way-card px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[18px] text-way-ink shadow-[0_30px_80px_rgba(0,0,0,.5)] outline-none md:max-h-[90vh] md:rounded-[22px] md:border md:p-6"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-heading text-xl font-bold md:text-2xl">{title}</span>
            {subtitle ? <span className="text-xs text-way-dim">{subtitle}</span> : null}
          </div>
          <IconBtn label="Close" onClick={onClose}>
            <X size={16} />
          </IconBtn>
        </div>
        <div className="no-scrollbar -mx-1 min-h-0 flex-1 overflow-y-auto px-1">{children}</div>
        {footer ? <div className="flex shrink-0 flex-wrap gap-2.5">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

/** Short-lived confirmation message. Returns [node, show(text, Icon?)]. */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (text, Icon = null, tone = 'ok') => {
    clearTimeout(timer.current);
    setToast({ text, Icon, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2600);
  };
  const node = toast ? (
    <div
      key={toast.key}
      role="status"
      className={cx(
        'way-rise fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-[0_12px_30px_rgba(0,0,0,.45)] md:bottom-8',
        toast.tone === 'error'
          ? 'border-rose-400/40 bg-[#2a0f17] text-rose-200'
          : 'border-emerald-400/30 bg-[#0c241c] text-emerald-300'
      )}
    >
      {toast.Icon ? <toast.Icon size={15} /> : null}
      {toast.text}
    </div>
  ) : null;
  return [node, show];
}

/** Labelled number input with a unit, as used across Settings. */
export function NumField({ label, value, onChange, unit, step = 1, placeholder, icon, min, max }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-way-mute">
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="flex h-11 items-center gap-1 rounded-xl border border-way-line2 bg-way-rail px-3 focus-within:border-way-faint">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="way-num w-full min-w-0 flex-1 bg-transparent font-mono text-[15px] font-semibold text-way-ink outline-none placeholder:text-way-faint"
        />
        {unit ? <span className="font-mono text-[10px] font-medium text-way-dim">{unit}</span> : null}
      </span>
    </label>
  );
}

/** Pill chip that toggles on (light) / off (outlined). */
export function Chip({ on, onClick, children, className = '', color }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors duration-200',
        on ? 'text-way-page' : 'border-way-line2 text-way-ink2 hover:border-way-line3',
        className
      )}
      style={on ? { background: color || '#f1f5f9', borderColor: color || '#f1f5f9' } : undefined}
    >
      {children}
    </button>
  );
}

/** Points string for an SVG polyline across a 0..w × 0..h box. */
export function polyPoints(values, { w = 300, h = 60, pad = 2, lo, hi } = {}) {
  const vals = values.filter((v) => v != null && Number.isFinite(v));
  if (!vals.length) return '';
  const min = lo ?? Math.min(...vals);
  const max = hi ?? Math.max(...vals);
  const span = max - min || 1;
  const n = values.length;
  const pts = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    const x = n === 1 ? w / 2 : (i / (n - 1)) * w;
    const y = pad + ((max - v) / span) * (h - pad * 2);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return pts.join(' ');
}
