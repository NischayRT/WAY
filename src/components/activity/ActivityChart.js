'use client';

import { useMemo, useState } from 'react';

const W = 600;
const H = 180;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;

function formatDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/** Groups daily values into `size`-day buckets, averaging the days that have data. */
function bucketize(days, size) {
  if (size <= 1) return days.map((d) => ({ date: d.date, value: d.value, label: formatDay(d.date) }));
  const out = [];
  for (let i = 0; i < days.length; i += size) {
    const slice = days.slice(i, i + size);
    const have = slice.filter((d) => d.value != null && d.value > 0);
    out.push({
      date: slice[0].date,
      value: have.length ? have.reduce((a, d) => a + d.value, 0) / have.length : null,
      label: `${formatDay(slice[0].date)} – ${formatDay(slice[slice.length - 1].date)}`,
    });
  }
  return out;
}

/**
 * Daily bar chart for one activity metric.
 *
 * @param title   heading, e.g. "Steps"
 * @param days    [{ date: 'YYYY-MM-DD', value: number | null }] ascending, one per day
 * @param unit    short unit shown next to numbers ('' | 'km' | 'kcal')
 * @param decimals digits after the point for displayed values
 * @param goal    optional daily goal; drawn as a dashed line
 * @param barClass tailwind fill classes for the bars
 * @param dotClass tailwind bg class for the legend swatch
 */
export default function ActivityChart({
  title,
  days,
  unit = '',
  decimals = 0,
  goal = null,
  barClass,
  dotClass,
  loading = false,
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  const fmt = (n) =>
    Number(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const model = useMemo(() => {
    const withData = days.filter((d) => d.value != null && d.value > 0);
    if (withData.length === 0) return null;

    const size = days.length > 100 ? 7 : 1;
    const buckets = bucketize(days, size);
    const goalNum = Number(goal) > 0 ? Number(goal) : null;
    const maxVal = Math.max(...buckets.map((b) => b.value ?? 0), goalNum ?? 0);
    const top = maxVal * 1.1 || 1;

    const slot = (W - PAD_X * 2) / buckets.length;
    const barW = Math.max(1.5, Math.min(slot * 0.68, 26));
    const yFor = (v) => H - PAD_BOTTOM - (v / top) * (H - PAD_TOP - PAD_BOTTOM);

    const total = withData.reduce((a, d) => a + d.value, 0);
    const best = withData.reduce((a, d) => (d.value > a.value ? d : a), withData[0]);

    return {
      buckets,
      slot,
      barW,
      yFor,
      goalNum,
      size,
      avg: total / withData.length,
      total,
      best,
      daysWithData: withData.length,
    };
  }, [days, goal]);

  const header = (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
        {title}
      </h3>
    </div>
  );

  if (loading && !model) {
    return (
      <div>
        {header}
        <div className="mt-3 h-40 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (!model) {
    return (
      <div>
        {header}
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No {title.toLowerCase()} recorded in this range.
        </p>
      </div>
    );
  }

  const { buckets, slot, barW, yFor, goalNum, size, avg, total, best, daysWithData } = model;
  const active = activeIndex === null ? null : buckets[activeIndex];

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          {header}
          <p className="mt-0.5 font-numeric text-[10px] text-slate-400">
            {daysWithData} day{daysWithData === 1 ? '' : 's'} with data
            {size > 1 ? ' · weekly averages' : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1">
            <span className="font-numeric text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">
              {fmt(avg)}
            </span>
            {unit && <span className="font-numeric text-[10px] font-bold text-slate-400">{unit}</span>}
          </div>
          <p className="mt-1 font-numeric text-[10px] text-slate-400">avg / day</p>
        </div>
      </div>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-40 w-full overflow-visible"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={H - PAD_BOTTOM}
            y2={H - PAD_BOTTOM}
            stroke="currentColor"
            strokeWidth="1"
            className="text-slate-300 dark:text-slate-700"
          />

          {goalNum && (
            <g className="pointer-events-none">
              <line
                x1={PAD_X}
                x2={W - PAD_X}
                y1={yFor(goalNum)}
                y2={yFor(goalNum)}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="text-slate-400 dark:text-slate-500"
              />
              <text
                x={W - PAD_X}
                y={yFor(goalNum) - 4}
                textAnchor="end"
                className="fill-slate-400 font-numeric text-[9px]"
              >
                goal {fmt(goalNum)}
              </text>
            </g>
          )}

          {buckets.map((b, i) => {
            const cx = PAD_X + slot * i + slot / 2;
            const h = b.value ? H - PAD_BOTTOM - yFor(b.value) : 0;
            const isActive = activeIndex === i;
            return (
              <g key={b.date}>
                {b.value ? (
                  <rect
                    x={cx - barW / 2}
                    y={yFor(b.value)}
                    width={barW}
                    height={Math.max(h, 1)}
                    rx={Math.min(3, barW / 2)}
                    className={`${barClass} transition-opacity ${
                      activeIndex === null || isActive ? 'opacity-100' : 'opacity-40'
                    }`}
                  />
                ) : null}
                <rect
                  x={PAD_X + slot * i}
                  y={0}
                  width={slot}
                  height={H}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => setActiveIndex((prev) => (prev === i ? null : i))}
                />
              </g>
            );
          })}

          <text x={PAD_X} y={H - 4} className="fill-slate-400 font-numeric text-[9px]">
            {formatDay(buckets[0].date)}
          </text>
          <text x={W - PAD_X} y={H - 4} textAnchor="end" className="fill-slate-400 font-numeric text-[9px]">
            {formatDay(buckets[buckets.length - 1].date)}
          </text>
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2"
            style={{
              left: `${Math.min(88, Math.max(12, ((PAD_X + slot * activeIndex + slot / 2) / W) * 100))}%`,
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2 py-1 text-center shadow-lg">
              <span className="block font-numeric text-[9px] text-slate-400 leading-none">{active.label}</span>
              <span className="mt-0.5 block font-numeric text-[11px] font-bold text-slate-900 dark:text-white leading-none">
                {active.value != null ? `${fmt(active.value)}${unit ? ` ${unit}` : ''}` : 'No data'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-200/70 dark:border-slate-800 pt-2 font-numeric text-[10px] text-slate-400">
        <span>
          Total {fmt(total)}
          {unit ? ` ${unit}` : ''}
        </span>
        <span>
          Best {formatDay(best.date)} · {fmt(best.value)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
    </div>
  );
}
