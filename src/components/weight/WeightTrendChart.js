'use client';

import { useMemo, useRef, useState, useEffect } from 'react';

const W = 600;
const H = 200;
const PAD_X = 30;
const PAD_Y = 22;

/** Catmull-Rom through the points, converted to cubic beziers. */
function smoothPath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    // 1/6 tension keeps the curve from overshooting on noisy weigh-ins.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Trailing mean over `size` samples — the signal under the daily noise. */
function trailingAverage(values, size) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - size + 1), i + 1);
    return slice.reduce((a, v) => a + v, 0) / slice.length;
  });
}

function formatDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Weight trend chart.
 *
 * Draws the raw weigh-ins as a faint smoothed line and a 7-point trailing
 * average as the primary line, because day-to-day scale movement is mostly
 * water and reading it as progress is misleading.
 *
 * @param entries [{ logged_at, weight_kg }] in ascending date order
 */
export default function WeightTrendChart({ entries }) {
  const pathRef = useRef(null);
  const [drawn, setDrawn] = useState(false);
  const [dashLength, setDashLength] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);

  const model = useMemo(() => {
    if (!entries || entries.length === 0) return null;

    const weights = entries.map((e) => Number(e.weight_kg));
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    // Pad the domain so a flat series doesn't render as a line on the floor.
    const span = max - min || 1;
    const lo = min - span * 0.15;
    const hi = max + span * 0.15;

    const xFor = (i) =>
      entries.length === 1 ? W / 2 : PAD_X + (i / (entries.length - 1)) * (W - PAD_X * 2);
    const yFor = (w) => H - PAD_Y - ((w - lo) / (hi - lo)) * (H - PAD_Y * 2);

    const points = entries.map((e, i) => ({
      x: xFor(i),
      y: yFor(Number(e.weight_kg)),
      weight: Number(e.weight_kg),
      date: e.logged_at,
    }));

    const avgValues = trailingAverage(weights, 7);
    const avgPoints = avgValues.map((v, i) => ({ x: xFor(i), y: yFor(v), value: v }));

    const linePath = smoothPath(points);
    const avgPath = smoothPath(avgPoints);
    const areaPath =
      avgPoints.length > 1
        ? `${avgPath} L ${avgPoints[avgPoints.length - 1].x.toFixed(1)} ${H - PAD_Y} L ${avgPoints[0].x.toFixed(1)} ${H - PAD_Y} Z`
        : '';

    const minPoint = points[weights.indexOf(min)];
    const maxPoint = points[weights.indexOf(max)];

    return { points, avgPoints, linePath, avgPath, areaPath, min, max, minPoint, maxPoint, lo, hi, yFor };
  }, [entries]);

  // Measure the path then release the dash offset, which draws the line in.
  useEffect(() => {
    if (!model || !pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    setDashLength(len);
    setDrawn(false);
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [model]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e) => e.key === 'Escape' && setActiveIndex(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex]);

  if (!model) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No weigh-ins yet — log your first one below.
      </p>
    );
  }

  const { points, linePath, avgPath, areaPath, min, max, minPoint, maxPoint } = model;
  const active = activeIndex === null ? null : points[activeIndex];
  const latest = points[points.length - 1];

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Weight trend
          </h3>
          <p className="mt-0.5 font-numeric text-[10px] text-slate-400">
            {formatDay(points[0].date)} – {formatDay(latest.date)} · {points.length} weigh-ins
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1">
            <span className="font-numeric text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">
              {latest.weight.toFixed(1)}
            </span>
            <span className="font-numeric text-[10px] font-bold text-slate-400">kg</span>
          </div>
          <p className="mt-1 font-numeric text-[10px] text-slate-400">
            range {min.toFixed(1)}–{max.toFixed(1)} kg
          </p>
        </div>
      </div>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-48 w-full overflow-visible"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="text-amber-500" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" className="text-amber-500" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal reference lines at min / mid / max of the data. */}
          {[0, 0.5, 1].map((t) => {
            const y = PAD_Y + t * (H - PAD_Y * 2);
            return (
              <line
                key={t}
                x1={PAD_X}
                x2={W - PAD_X}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                className={t === 1 ? 'text-slate-300 dark:text-slate-700' : 'text-slate-200/70 dark:text-slate-800/80'}
              />
            );
          })}

          {/* Filled area under the trailing average. */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#weight-area)"
              className={`transition-opacity duration-1000 ease-out ${drawn ? 'opacity-100' : 'opacity-0'}`}
            />
          )}

          {/* Raw weigh-ins, de-emphasised. */}
          <path
            d={linePath}
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={`stroke-slate-300 dark:stroke-slate-600 transition-opacity duration-700 ${
              drawn ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transitionDelay: '500ms' }}
          />

          {/* 7-point trailing average — the headline line, drawn in. */}
          <path
            ref={pathRef}
            d={avgPath}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="stroke-amber-500 dark:stroke-amber-400"
            style={{
              strokeDasharray: dashLength || undefined,
              strokeDashoffset: drawn ? 0 : dashLength,
              transition: 'stroke-dashoffset 1100ms ease-out',
            }}
          />

          {/* Min / max markers give the chart statistical anchors. */}
          {points.length > 2 &&
            [
              { p: minPoint, label: `${min.toFixed(1)} low` },
              { p: maxPoint, label: `${max.toFixed(1)} high` },
            ].map(({ p, label }) => (
              <g
                key={label}
                className={`transition-opacity duration-700 ${drawn ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: '900ms' }}
              >
                <circle cx={p.x} cy={p.y} r="3" className="fill-slate-400 dark:fill-slate-500" />
                <text
                  x={p.x}
                  y={p.y - 8}
                  textAnchor="middle"
                  className="fill-slate-400 font-numeric text-[9px]"
                >
                  {label}
                </text>
              </g>
            ))}

          {/* Scrub targets: full-height hit areas, one per weigh-in. */}
          {points.map((p, i) => {
            const slot = points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : W;
            return (
              <rect
                key={p.date}
                x={p.x - slot / 2}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => setActiveIndex((prev) => (prev === i ? null : i))}
              />
            );
          })}

          {/* Active point + crosshair */}
          {active && (
            <g className="pointer-events-none">
              <line
                x1={active.x}
                x2={active.x}
                y1={PAD_Y}
                y2={H - PAD_Y}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 3"
                className="text-slate-400"
              />
              <circle
                cx={active.x}
                cy={active.y}
                r="5"
                className="fill-amber-500 dark:fill-amber-400 stroke-white dark:stroke-slate-900"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Latest point always marked. */}
          <circle
            cx={latest.x}
            cy={latest.y}
            r="4"
            className={`fill-amber-500 dark:fill-amber-400 stroke-white dark:stroke-slate-900 transition-opacity duration-500 ${
              drawn ? 'opacity-100' : 'opacity-0'
            }`}
            strokeWidth="1.5"
            style={{ transitionDelay: '1000ms' }}
          />
        </svg>

        {/* Tooltip in DOM rather than SVG so text scales predictably. */}
        {active && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2"
            style={{ left: `${(active.x / W) * 100}%` }}
          >
            <div className="whitespace-nowrap rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2 py-1 text-center shadow-lg">
              <span className="block font-numeric text-[9px] text-slate-400 leading-none">
                {formatDay(active.date)}
              </span>
              <span className="mt-0.5 block font-numeric text-[11px] font-bold text-slate-900 dark:text-white leading-none">
                {active.weight.toFixed(1)} kg
              </span>
              {activeIndex > 0 && (
                <span className="mt-0.5 block font-numeric text-[9px] leading-none text-slate-400">
                  {(active.weight - points[activeIndex - 1].weight >= 0 ? '+' : '') +
                    (active.weight - points[activeIndex - 1].weight).toFixed(1)}{' '}
                  vs prev
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-center gap-3 border-t border-slate-200/70 dark:border-slate-800 pt-2">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 rounded-full bg-amber-500" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            7-day average
          </span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            Daily weigh-ins
          </span>
        </span>
      </div>
    </div>
  );
}
