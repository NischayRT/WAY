'use client';
import { useState, useRef } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { ui } from '@/lib/ui';
export default function DateSelector({ selectedDate, today, minDate, onSelectDate }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const handleChange = (e) => { const val = e.target.value; if (val && val >= minDate && val <= today) { onSelectDate(val); setOpen(false); } };
  const handleOpen = () => { setOpen(true); requestAnimationFrame(() => { try { inputRef.current?.showPicker?.(); } catch {} }); };
  if (!open) {
    return (
      <button type="button" onClick={handleOpen} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#14305a] bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-[#050e22] px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-shadow hover:shadow-lg shrink-0" title="Jump to date">
        <CalendarDays size={14} className="text-slate-400" />
        <span className="hidden sm:inline">Jump to</span><span className="sm:hidden">Date</span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input ref={inputRef} type="date" value={selectedDate} min={minDate} max={today} onChange={handleChange} autoFocus className={`${ui.input} !mt-0 py-1.5 text-xs min-w-[140px]`} />
      <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" aria-label="Close date picker"><X size={14} /></button>
    </div>
  );
}
