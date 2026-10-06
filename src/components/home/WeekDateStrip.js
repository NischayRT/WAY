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
    <div ref={wrapRef} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-sm sm:text-md font-semibold text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-[0.98] max-w-[150px] sm:max-w-none"
      >
        <span className="truncate">Hi, {firstName}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`absolute right-0 top-full z-30 mt-2 w-44 border rounded-2xl transition-shadow hover:shadow-lg dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] bg-white border-slate-200/90 p-1.5 shadow-xl backdrop-blur-md transition max-md:left-0 max-md:right-auto ${open ? 'block' : 'hidden'}`} role="menu">
        <Link href="/settings" onClick={() => setOpen(false)} role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900"><Settings size={14} /></span>
          Settings
        </Link>
      </div>
    </div>
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
}) {
  const dateInputRef = useRef(null);
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

  // Keep the selected pill in view when the strip overflows (small screens).
  useEffect(() => {
    const track = trackRef.current;
    const el = selectedRef.current;
    if (!track || !el) return;
    track.scrollTo({
      left: el.offsetLeft - track.clientWidth / 2 + el.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [selectedDate]);

  const handleCustomDateChange = (e) => {
    const picked = e.target.value;
    if (picked && picked >= minDate && picked <= today) onSelectDate(picked);
  };

  const openCalendarPicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') dateInputRef.current.showPicker();
      else dateInputRef.current.click();
    }
  };

  const themeBtnClass = 'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-[#14305a] bg-white dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 transition-shadow hover:shadow-lg active:scale-95';

  return (
    <div className="flex w-full flex-col gap-2 md:flex-row md:items-center lg:gap-3">
      <div className="flex w-full items-center justify-between gap-2 md:hidden">
        <ProfileMenu firstName={firstName} />
        <ThemeToggle className={themeBtnClass} iconSize={16} />
      </div>
      <div className="flex flex-1 items-center w-full min-w-0">
        {/* Pill track. Fits its content (no stretching) and holds the calendar button:
            - >375px, today selected: the 7 days, calendar right after the last pill.
            - >375px, another day selected: just that day + calendar.
            - <=375px: calendar first, then only the selected day. */}
        <div
          ref={trackRef}
          className="relative flex w-fit max-w-full items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none min-w-0 rounded-full border border-slate-200/90 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 p-1 sm:p-1.5 max-[375px]:w-full"
        >
          <input ref={dateInputRef} type="date" value={selectedDate} min={minDate} max={today} onChange={handleCustomDateChange} className="absolute left-0 bottom-0 opacity-0 pointer-events-none w-0 h-0" tabIndex={-1} />

          {/* Calendar - small screens: before the day */}
          <button type="button" onClick={openCalendarPicker} title="Open calendar" aria-label="Open calendar" className={`${calBtn} hidden max-[375px]:flex`}>
            <CalendarIcon size={16} />
          </button>

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
          <button type="button" onClick={openCalendarPicker} title="Open calendar" aria-label="Open calendar" className={`${calBtn} flex max-[375px]:hidden`}>
            <CalendarIcon size={16} />
          </button>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-3 ml-1">
        <ProfileMenu firstName={firstName} />
        <ThemeToggle className={themeBtnClass} iconSize={16} />
      </div>
    </div>
  );
}