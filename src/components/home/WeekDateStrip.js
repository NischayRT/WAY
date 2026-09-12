'use client';

import { useRef } from 'react';
import { ChevronDown, Calendar as CalendarIcon } from 'lucide-react';

export default function WeekDateStrip({ days, selectedDate, onSelectDate }) {
  const dateInputRef = useRef(null);

  const handleCustomDateChange = (e) => {
    const picked = e.target.value;
    if (picked) onSelectDate(picked);
  };

  const openCalendarPicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
  };

  return (
    <div className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none relative items-center">
      <input
        ref={dateInputRef}
        type="date"
        value={selectedDate}
        onChange={handleCustomDateChange}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
      />

      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
            className={`flex flex-col items-center justify-center shrink-0 w-12 md:w-full py-2.5 px-1 rounded-xl text-center border transition-all active:scale-95 ${
              isSelected
                ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-300 dark:shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                : 'border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold tracking-wider ${
                isSelected ? 'text-slate-300 dark:text-amber-300' : 'text-slate-400 dark:text-slate-400'
              }`}
            >
              {day.dayLabel}
            </span>
            <span className="font-numeric text-sm font-bold mt-0.5">{day.dateLabel}</span>
            {day.isToday && (
              <span
                className={`h-1.5 w-1.5 rounded-full mt-1 ${
                  isSelected ? 'bg-amber-400' : 'bg-slate-900 dark:bg-amber-400'
                }`}
              />
            )}
          </button>
        );
      })}

      {/* Calendar trigger box */}
      <button
        type="button"
        onClick={openCalendarPicker}
        title="Open calendar to choose date"
        className="flex flex-col items-center justify-center shrink-0 w-12 md:w-full py-2 px-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 dark:hover:border-slate-500 transition-all shadow-2xs group active:scale-95 cursor-pointer"
      >
        <CalendarIcon size={13} className="text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition" />
        <ChevronDown size={14} className="mt-0.5 text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition" />
      </button>
    </div>
  );
}