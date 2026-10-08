'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';

/** Round up to a readable axis ceiling. */
function niceCeil(value) {
  if (value <= 0) return 1;
  const step = value > 4000 ? 1000 : value > 1500 ? 500 : value > 400 ? 100 : value > 80 ? 50 : value > 20 ? 10 : 5;
  return Math.ceil(value / step) * step;
}

function formatK(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(Math.round(n));
}

/**
 * Single-macro bar chart with a target line and an average line.
 *
 * Scale: the axis runs to this chart's own highest logged value (rounded up
 * to a clean number), so every chart uses its full height. The target line is
 * drawn when it falls inside that range; when it is higher, a "target ↑"
 * note sits at the top instead of squashing all the bars.
 *
 * Interaction (controlled by the parent so all charts show the same day):
 *  - mouse: hover previews a day, click pins it (click again to unpin)
 *  - touch / pen: a TAP selects a day; a SIDEWAYS drag scrubs through days.
 *    A vertical swipe is left to the browser to scroll the page and selects
 *    nothing (it used to select on finger-down, so every scroll that started
 *    on a chart picked a day and re-rendered the page).
 * The old version used onMouseEnter + onClick: on touch screens a tap fires
 * both, so the day was selected and immediately toggled off again.
 *
 * Alignment contract: a fixed-width axis gutter (`w-7`) is shared by the plot
 * row and the label row, and tick labels and gridlines use the same `top`
 * percentages, keeping "0" on the baseline and labels centred under bars.
 *
 * @param data          [{ dayLabel, dateLabel, value }]
 * @param activeIndex   selected day index (or null), owned by the parent
 * @param onHover       (index|null) mouse hover preview
 * @param onSelect      (index) tap / click / scrub
 * @param overlay       optional details window for the active day, drawn
 *                      above the bars from sm up (absolutely positioned, so
 *                      it never moves the layout); phones use a bottom sheet
 * @param overlayInteractive  true when the day is pinned: the window takes
 *                      clicks (links, close). While only hovering it ignores
 *                      the pointer, so it can never steal the hover.
 * @param barClass      literal Tailwind `bg-*` class (never built at runtime)
 * @param lineClass     literal Tailwind `border-*` class for the average line
 */
function MacroBarChart({
  chartKey,
  title,
  unit,
  data,
  target,
  activeIndex = null,
  onHover,
  onSelect,
  overlay = null,
  overlayInteractive = false,
  barClass = 'bg-slate-400',
  lineClass = 'border-slate-400',
  textClass = 'text-slate-700 dark:text-slate-200',
}) {
  const [mounted, setMounted] = useState(false);
  const plotRef = useRef(null);
  const scrubbing = useRef(false);
  const touchStart = useRef(null); // { x, y } of a finger that may be a tap, a scrub or a scroll
  const lastHover = useRef(null);
  const TAP_SLOP = 8; // px a finger may move and still count as a tap

  // rAF so the browser paints the zero-height state before transitioning up.
  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [data]);

  const model = useMemo(() => {
    const values = data.map((d) => d.value ?? 0);
    const logged = values.filter((v) => v > 0);
    const maxValue = logged.length ? Math.max(...logged) : 0;
    // Headroom of ~8% so the tallest bar never touches the top edge.
    const maxScale = niceCeil(maxValue * 1.08);
    return {
      maxScale,
      ticks: [maxScale, maxScale / 2, 0],
      // Average over logged days only: counting empty days as zero would
      // report a diet that was never eaten.
      avg: logged.length ? logged.reduce((a, v) => a + v, 0) / logged.length : 0,
      loggedCount: logged.length,
    };
  }, [data]);

  const { maxScale, ticks, avg, loggedCount } = model;
  const hasData = loggedCount > 0;
  const targetInRange = target > 0 && target <= maxScale;
  const targetPct = targetInRange ? (target / maxScale) * 100 : null;
  const avgPct = avg > 0 ? Math.min((avg / maxScale) * 100, 100) : null;
  const active = activeIndex === null ? null : data[activeIndex];

  // Keep roughly 7 labels regardless of range, so 30 days never crams.
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  const indexAt = (clientX) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const i = Math.floor(((clientX - rect.left) / rect.width) * data.length);
    return Math.min(data.length - 1, Math.max(0, i));
  };

  const onPointerDown = (e) => {
    if (!hasData || e.pointerType === 'mouse') return; // mouse selects on click (below)
    // Don't select yet: this finger may be starting a page scroll.
    touchStart.current = { x: e.clientX, y: e.clientY };
    scrubbing.current = false;
  };
  const onPointerMove = (e) => {
    if (!hasData) return;
    if (e.pointerType === 'mouse') {
      const i = indexAt(e.clientX);
      // Only report a change of bar, not every pixel moved within one.
      if (i !== null && i !== lastHover.current) {
        lastHover.current = i;
        onHover?.(chartKey, i);
      }
      return;
    }
    const start = touchStart.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!scrubbing.current && Math.abs(dx) > TAP_SLOP && Math.abs(dx) > Math.abs(dy)) scrubbing.current = true;
    if (scrubbing.current) {
      const i = indexAt(e.clientX);
      if (i !== null && i !== activeIndex) onSelect?.(chartKey, i);
    }
  };
  const onPointerUp = (e) => {
    const start = touchStart.current;
    if (e.pointerType !== 'mouse' && start && !scrubbing.current) {
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved <= TAP_SLOP) {
        const i = indexAt(e.clientX);
        if (i !== null) onSelect?.(chartKey, i); // a genuine tap
      }
    }
    touchStart.current = null;
    scrubbing.current = false;
  };
  const endScrub = () => {
    // pointercancel: the browser took over to scroll the page.
    touchStart.current = null;
    scrubbing.current = false;
  };
  const onClick = (e) => {
    if (!hasData) return;
    // Touch already selected on pointerdown; only mice select here.
    if (e.nativeEvent?.pointerType && e.nativeEvent.pointerType !== 'mouse') return;
    const i = indexAt(e.clientX);
    if (i !== null) onSelect?.(chartKey, i);
  };
  const onKeyDown = (e) => {
    if (!hasData) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const start = activeIndex ?? (e.key === 'ArrowRight' ? -1 : data.length);
      const next = Math.min(data.length - 1, Math.max(0, start + (e.key === 'ArrowRight' ? 1 : -1)));
      onSelect?.(chartKey, next);
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading truncate text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          {title}
        </h3>
        <span className="shrink-0 font-numeric text-[10px] text-slate-400">
          avg{' '}
          <span className={`font-bold ${textClass}`}>
            {hasData ? formatK(avg) : '–'}
            {hasData ? unit : ''}
          </span>
          {target > 0 && <> / {formatK(target)}</>}
        </span>
      </div>

      <div className="relative mt-2">
        {/* Plot row: axis gutter + plot area */}
        <div className="flex h-32 sm:h-28">
          <div className="relative w-7 shrink-0">
            {hasData &&
              ticks.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="absolute right-1 -translate-y-1/2 font-numeric text-[8px] tabular-nums text-slate-400"
                  style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
                >
                  {formatK(t)}
                </span>
              ))}
          </div>

          <div
            ref={plotRef}
            role={hasData ? 'slider' : undefined}
            tabIndex={hasData ? 0 : -1}
            aria-label={hasData ? `${title} by day` : undefined}
            aria-valuemin={hasData ? 0 : undefined}
            aria-valuemax={hasData ? data.length - 1 : undefined}
            aria-valuenow={hasData && activeIndex !== null ? activeIndex : undefined}
            aria-valuetext={
              active ? `${active.dateLabel}: ${active.value > 0 ? `${Math.round(active.value)}${unit}` : 'no log'}` : undefined
            }
            className={`relative min-w-0 flex-1 select-none outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 ${
              hasData ? 'cursor-pointer touch-pan-y' : ''
            }`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={endScrub}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') {
                lastHover.current = null;
                onHover?.(chartKey, null);
              }
            }}
            onClick={onClick}
            onKeyDown={onKeyDown}
          >
            {/* Gridlines on the same offsets as the ticks */}
            {ticks.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="pointer-events-none absolute inset-x-0 border-t border-slate-200/70 dark:border-slate-800"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}

            {hasData ? (
              <>
                {/* Target line (only when it lies within this chart's range) */}
                {targetPct !== null && (
                  <span
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-slate-400/70 transition-all duration-700 ease-out"
                    style={{ bottom: mounted ? `${targetPct}%` : '0%' }}
                  />
                )}
                {target > 0 && !targetInRange && (
                  <span className="pointer-events-none absolute right-0 top-0 z-10 -translate-y-full pb-0.5 font-numeric text-[8px] text-slate-400">
                    target {formatK(target)} ↑
                  </span>
                )}

                {/* Average line, drawn over the target */}
                {avgPct !== null && (
                  <span
                    className={`pointer-events-none absolute inset-x-0 z-10 border-t border-dotted opacity-80 transition-all duration-700 ease-out ${lineClass}`}
                    style={{ bottom: mounted ? `${avgPct}%` : '0%' }}
                  />
                )}

                <div className="pointer-events-none absolute inset-0 flex items-end gap-px">
                  {data.map((d, i) => {
                    const heightPct = Math.min(((d.value ?? 0) / maxScale) * 100, 100);
                    const isActive = activeIndex === i;
                    const dimmed = activeIndex !== null && !isActive;
                    return (
                      <div key={d.dateLabel ?? i} className="relative flex h-full min-w-0 flex-1 items-end">
                        {isActive && <span className="absolute inset-0 rounded-sm bg-slate-400/10 dark:bg-white/5" />}
                        {d.value > 0 ? (
                          <span
                            className={`relative mx-auto w-full max-w-[16px] rounded-t-sm transition-[height,opacity] duration-700 ease-out ${barClass} ${
                              dimmed ? 'opacity-40' : 'opacity-100'
                            }`}
                            style={{
                              height: mounted ? `${heightPct}%` : '0%',
                              transitionDelay: `${Math.min(i * 25, 300)}ms`,
                            }}
                          />
                        ) : (
                          // Stub marks an unlogged day as distinct from a short bar.
                          <span className="relative mx-auto h-[3px] w-full max-w-[16px] rounded-sm bg-slate-200 dark:bg-slate-800" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">No data logged</span>
                <span className="text-[10px] text-slate-400">Nothing logged in this range</span>
              </div>
            )}
          </div>
        </div>

        {/* Label row reuses the same gutter so labels line up with bars */}
        <div className="mt-1 flex">
          <span className="w-7 shrink-0" />
          <div className="flex min-w-0 flex-1 gap-px overflow-hidden">
            {data.map((d, i) => (
              <span
                key={d.dateLabel ?? i}
                className={`min-w-0 flex-1 truncate text-center font-numeric text-[8px] leading-none ${
                  activeIndex === i ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-400'
                }`}
              >
                {i % labelEvery === 0 || activeIndex === i ? d.dayLabel : ''}
              </span>
            ))}
          </div>
        </div>

        {/* Details window (sm and up): floats above the bars, aligned with
            the active bar and kept inside the card at the edges. */}
        {active && hasData && overlay && (
          <div
            className={`absolute top-0 z-30 hidden w-64 sm:block ${overlayInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{
              left: `calc(1.75rem + (100% - 1.75rem) * ${(activeIndex + 0.5) / data.length})`,
              transform: `translate(${activeIndex < data.length * 0.25 ? '-12%' : activeIndex > data.length * 0.75 ? '-88%' : '-50%'}, calc(-100% - 6px))`,
            }}
          >
            {overlay}
          </div>
        )}

        {/* Small tooltip: always on phones; on larger screens only when there
            is no details window. Kept inside the card at the edges. */}
        {active && hasData && (
          <div
            className={`pointer-events-none absolute -top-1 z-20 ${overlay ? 'sm:hidden' : ''}`}
            style={{
              left: `calc(1.75rem + (100% - 1.75rem) * ${(activeIndex + 0.5) / data.length})`,
              transform: `translate(${activeIndex < data.length * 0.2 ? '-15%' : activeIndex > data.length * 0.8 ? '-85%' : '-50%'}, -100%)`,
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-slate-200/80 bg-white/95 px-1.5 py-1 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
              <span className="block font-numeric text-[8px] leading-none text-slate-400">{active.dateLabel}</span>
              <span className="mt-0.5 block font-numeric text-[10px] font-bold leading-none text-slate-900 dark:text-white">
                {active.value > 0 ? `${formatK(active.value)}${unit}` : 'No log'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-renders only when its own props change (its data, the selected day,
// or its overlay), not whenever another chart on the page updates.
export default memo(MacroBarChart);
