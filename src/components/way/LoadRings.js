'use client';

import { cx } from '@/components/way/ui';

/**
 * Recovery · Strain · Sleep rings (lib/dailyLoad.js via
 * /api/google-health/daily-load). Each ring renders only when its data is
 * there; with none of them, nothing renders at all.
 */

const STRAIN = '#60a5fa';
const SLEEP = '#818cf8';

export const hasLoad = (load) => !!(load && (load.recovery || load.strain || load.sleep));

function Ring({ pct, color, size = 112, stroke = 9, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1b2333" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${p * c} ${c}`}
          style={{ transition: 'stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function items(load) {
  const out = [];
  if (load?.recovery) {
    const r = load.recovery;
    out.push({
      key: 'recovery',
      title: 'Recovery',
      color: r.band.color,
      pct: r.score / 100,
      big: `${r.score}%`,
      small: 'ready',
      badge: r.band.label,
      sub: r.rhr ? `RHR ${Math.round(r.rhr)} bpm` : `${r.band.label} recovery`,
      text: r.text,
    });
  }
  if (load?.strain) {
    const s = load.strain;
    out.push({
      key: 'strain',
      title: 'Strain',
      color: STRAIN,
      pct: s.value / 21,
      big: s.value.toFixed(1),
      small: '/ 21',
      badge: s.target.tag,
      sub: `target ${s.target.lo}–${s.target.hi}`,
      text: s.text,
    });
  }
  if (load?.sleep) {
    const s = load.sleep;
    out.push({
      key: 'sleep',
      title: 'Sleep',
      color: SLEEP,
      pct: s.minutes / s.need,
      big: s.label,
      small: 'hrs',
      badge: `${s.pct}%`,
      sub: `${s.pct}% of ${Math.round((s.need / 60) * 10) / 10} h`,
      text: s.text,
    });
  }
  return out;
}

const Badge = ({ color, children }) => (
  <span className="whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold" style={{ color, borderColor: `${color}66` }}>
    {children}
  </span>
);

/** Phones: rings side by side in an inset panel. */
export function LoadRingsCompact({ load, className = '' }) {
  const list = items(load);
  if (!list.length) return null;
  return (
    <div
      className={cx('grid gap-2 rounded-2xl border border-way-line bg-way-rail/60 px-2 py-4', className)}
      style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}
    >
      {list.map((it) => (
        <div key={it.key} className="flex min-w-0 flex-col items-center gap-2 text-center">
          <Ring pct={it.pct} color={it.color} size={88} stroke={8}>
            <span className="font-mono text-lg font-semibold leading-none" style={{ color: it.color }}>
              {it.big}
            </span>
            <span className="mt-1 font-mono text-[10px] text-way-dim">{it.small}</span>
          </Ring>
          <span className="font-heading text-[13px] font-bold uppercase tracking-[0.08em]">{it.title}</span>
          <span className="truncate text-[11px] text-way-mute">{it.sub}</span>
        </div>
      ))}
    </div>
  );
}

/** Desktop: one column per ring with a sentence on what to do. */
export function LoadRingsWide({ load, className = '' }) {
  const list = items(load);
  if (!list.length) return null;
  return (
    <div className={cx('grid divide-x divide-way-line', className)} style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
      {list.map((it) => (
        <div key={it.key} className="flex min-w-0 items-center gap-5 px-7 py-6">
          <Ring pct={it.pct} color={it.color} size={124} stroke={10}>
            <span className="font-mono text-[26px] font-semibold leading-none" style={{ color: it.color }}>
              {it.big}
            </span>
            <span className="mt-1 font-mono text-[11px] text-way-dim">{it.small}</span>
          </Ring>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-[15px] font-bold uppercase tracking-[0.08em]">{it.title}</span>
              <Badge color={it.color}>{it.badge}</Badge>
            </span>
            <p className="text-[13px] leading-snug text-way-ink2 [text-wrap:pretty] xl:text-sm">{it.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small per-day bars for each metric over a range (Activity page). */
export function LoadTrend({ series = [], className = '' }) {
  const rows = [
    { key: 'recovery', label: 'Recovery', max: 100, color: (v) => (v >= 67 ? '#34d399' : v >= 34 ? '#fbbf24' : '#fb7185'), fmt: (v) => `${v}%` },
    { key: 'strain', label: 'Strain', max: 21, color: () => STRAIN, fmt: (v) => v.toFixed(1) },
    { key: 'sleepMin', label: 'Sleep', max: 600, color: () => SLEEP, fmt: (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` },
  ].filter((r) => series.some((d) => d[r.key] != null));
  if (!rows.length || series.length < 2) return null;
  return (
    <div className={cx('grid gap-4 md:grid-cols-3', className)}>
      {rows.map((r) => {
        const vals = series.map((d) => d[r.key]).filter((v) => v != null);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return (
          <div key={r.key} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-way-mute">{r.label}</span>
              <span className="font-mono font-semibold text-way-ink2">avg {r.fmt(r.key === 'strain' ? avg : Math.round(avg))}</span>
            </div>
            <div className="flex h-14 items-end gap-[2px]">
              {series.map((d) => {
                const v = d[r.key];
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${v == null ? 'no data' : r.fmt(v)}`}
                    className="flex-1 rounded-t-[2px]"
                    style={{
                      height: v == null ? 3 : `${Math.max(6, Math.min(100, (v / r.max) * 100))}%`,
                      background: v == null ? '#1b2333' : r.color(v),
                      opacity: v == null ? 1 : 0.85,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
