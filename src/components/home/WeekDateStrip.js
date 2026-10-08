"use client";

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Calendar as CalendarIcon, Settings } from 'lucide-react';
import ThemeToggle from '@/components/layout/ThemeToggle';

// "Today, 2 Oct" for today, "Thu, 1 Oct" for any other selected day.
function formatPillDate(dateStr, isToday) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dayMonth = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (isToday) return `Today, ${dayMonth}`;
  return `${dt.toLocaleDateString('en-IN', { weekday: 'short' })}, ${dayMonth}`;
}

function ProfileMenu({ firstName }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      // Hover-open only for a real mouse. On touch, a tap fires a synthetic
      // mouseenter AND a click, which opened then immediately closed the menu.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-sm sm:text-md font-semibold text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-[0.98] max-w-[120px] @min-[760px]:max-w-[180px] max-[375px]:px-2"
      >
        <span className="truncate">Hi, {firstName}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`absolute left-0 top-full z-30 @min-[760px]:left-auto @min-[760px]:right-0 mt-2 w-44 border rounded-2xl transition-shadow hover:shadow-lg dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] bg-white border-slate-200/90 p-1.5 shadow-xl backdrop-blur-md transition ${open ? 'block' : 'hidden'}`} role="menu">
        <Link href="/settings" onClick={() => setOpen(false)} role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900"><Settings size={14} /></span>
          Settings
        </Link>
      </div>
    </div>
  );
}

/**
 * Calendar button that opens the native date picker on every platform.
 *
 * iOS Safari will not open a picker for an input that is hidden (0x0,
 * pointer-events: none) via showPicker() or click(), which is why the old
 * button did nothing on iPhone. Here the real <input type="date"> is laid
 * invisibly over the icon, so the tap lands on the input itself and iOS /
 * Android open their pickers natively. Desktop browsers, which only open the
 * picker from the small calendar glyph, get showPicker() on click.
 */
function CalendarButton({ className, value, min, max, onPick }) {
  return (
    <label className={`relative cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500/60 ${className}`} title="Open calendar">
      <CalendarIcon size={16} aria-hidden="true" />
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        aria-label="Pick a date"
        onChange={(e) => onPick(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            /* already open, or not allowed: the native tap behaviour still applies */
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 text-base"
      />
    </label>
  );
}

export default function WeekDateStrip({
  days,
  selectedDate,
  onSelectDate,
  today,
  minDate,
  reversed = false,
  userName,
  middle = null, // optional: content placed between the strip and the profile menu (the weight bar)
}) {
  const trackRef = useRef(null);
  const selectedRef = useRef(null);
  const displayDays = reversed ? [...days].reverse() : days;
  const calBtn =
    'h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition active:scale-95';

  // Today selected -> the whole week. Any other day -> only that day (it may be
  // outside the loaded week, so build it when it isn't in `days`).
  let visibleDays = displayDays;
  if (selectedDate !== today) {
    const found = displayDays.find((d) => d.date === selectedDate);
    const dayNum = Number(selectedDate.split('-')[2]);
    visibleDays = [found ?? { date: selectedDate, isToday: false, isBeforeMinDate: false, dateLabel: dayNum }];
  }
  const rawName = (userName || '').trim();
  const firstName = rawName ? rawName.split(/\s+/)[0] : 'there';

  // Keep the selected pill (normally Today, the last day) in view whenever
  // the strip is narrower than the week. The old version scrolled once, on
  // date change, which could run before layout settled and never re-ran when
  // the strip's width changed, so Today often sat off-screen.
  // Centring is clamped by the browser, so for the last day this lands at the
  // far right, keeping Today AND the calendar button visible.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const keepSelectedInView = (behavior) => {
      const el = selectedRef.current;
      if (!el || track.scrollWidth <= track.clientWidth) return;
      track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior });
    };
    const frame = requestAnimationFrame(() => keepSelectedInView('auto'));
    const ro = new ResizeObserver(() => keepSelectedInView('auto'));
    ro.observe(track);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const el = selectedRef.current;
    if (!track || !el || track.scrollWidth <= track.clientWidth) return;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [selectedDate]);

  const handlePick = (picked) => {
    if (picked && picked >= minDate && picked <= today) onSelectDate(picked);
  };

  const themeBtnClass = 'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-[#14305a] bg-white dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 transition-shadow hover:shadow-lg active:scale-95';

  /* Three zones laid out with CONTAINER queries (the width this header
     actually gets, not the window), so it adapts to any screen and to the
     sidebar/padding around it:
       < 760px    profile | date strip | theme              / weight bar (full width)
       760-911px  date strip | profile | theme              / weight bar (full width)
       >= 912px   date strip | weight bar | profile | theme (one row, no wasted space)
     Header widths map to windows of 856px and 1024px (after the 64px sidebar
     and the page padding).
     In the one-row layout the strip column is minmax(0, max-content) and the
     weight bar's is minmax(340px, 1fr): the weight bar keeps at least 340px,
     and when that leaves too little for the whole week the strip scrolls
     (Today stays in view, see above). On wider screens the strip grows back
     to the full week and the weight bar takes the rest. */
  return (
    <div className="@container w-full">
      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-2 [grid-template-areas:'profile_strip_theme'_'weight_weight_weight'] @min-[760px]:grid-cols-[minmax(0,1fr)_auto_auto] @min-[760px]:gap-x-2 @min-[760px]:gap-y-3 @min-[760px]:[grid-template-areas:'strip_profile_theme'_'weight_weight_weight'] @min-[912px]:grid-cols-[minmax(0,max-content)_minmax(340px,1fr)_auto_auto] @min-[912px]:gap-x-3 @min-[912px]:[grid-template-areas:'strip_weight_profile_theme']">
        <div className="flex min-w-0 items-center [grid-area:profile] @min-[760px]:border-l @min-[760px]:border-slate-200 @min-[760px]:pl-2 @min-[760px]:dark:border-slate-800">
          <ProfileMenu firstName={firstName} />
        </div>

        <div className="flex items-center justify-end [grid-area:theme]">
          <ThemeToggle className={themeBtnClass} iconSize={16} />
        </div>

        <div className="flex min-w-0 items-center justify-center [grid-area:strip] @min-[760px]:justify-start">
          {/* Pill track. Fits its content (no stretching) and holds the calendar button:
              - >375px, today selected: the 7 days, calendar right after the last pill.
              - >375px, another day selected: just that day + calendar.
              - <=375px: calendar first, then only the selected day. */}
          <div
            ref={trackRef}
            className="relative flex w-fit max-w-full items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none min-w-0 rounded-full border border-slate-200/90 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 p-1 sm:p-1.5 max-[375px]:w-full"
          >
            {/* Calendar - small screens: before the day */}
            <CalendarButton
              className={`${calBtn} hidden max-[375px]:flex`}
              value={selectedDate}
              min={minDate}
              max={today}
              onPick={handlePick}
            />

            {visibleDays.map((day, i) => {
              const isSelected = day.date === selectedDate;
              const isDisabled = day.isBeforeMinDate;
              const isEdge = i === 0 || i === visibleDays.length - 1;
              const base =
                'shrink-0 rounded-full text-center tabular-nums whitespace-nowrap transition-all duration-200 active:scale-[0.97]';

              let state;
              if (isSelected) {
                state =
                  'bg-white text-slate-900 shadow-[0_2px_10px_rgba(15,23,42,0.12)] dark:bg-white dark:text-slate-900 dark:shadow-[0_2px_14px_rgba(0,0,0,0.5)] px-5 sm:px-7 py-2 sm:py-2.5 text-xs sm:text-sm font-bold max-[375px]:flex-1 max-[375px]:px-3';
              } else if (isDisabled) {
                state =
                  'max-[375px]:hidden opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-600 px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold';
              } else {
                state = `max-[375px]:hidden px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold hover:bg-white/70 dark:hover:bg-slate-800 ${
                  isEdge
                    ? 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                    : 'text-slate-800 dark:text-slate-200'
                }`;
              }

              return (
                <button
                  key={day.date}
                  ref={isSelected ? selectedRef : null}
                  type="button"
                  disabled={isDisabled}
                  aria-current={isSelected ? 'date' : undefined}
                  aria-label={formatPillDate(day.date, day.isToday)}
                  title={formatPillDate(day.date, day.isToday)}
                  onClick={() => onSelectDate(day.date)}
                  className={`${base} ${state}`}
                >
                  {isSelected ? formatPillDate(day.date, day.isToday) : day.dateLabel}
                </button>
              );
            })}

            {/* Calendar - larger screens: right after the last (selected) pill */}
            <CalendarButton
              className={`${calBtn} flex max-[375px]:hidden`}
              value={selectedDate}
              min={minDate}
              max={today}
              onPick={handlePick}
            />
          </div>
        </div>

        {middle && <div className="min-w-0 [grid-area:weight]">{middle}</div>}
      </div>
    </div>
  );
}