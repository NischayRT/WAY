'use client';

import { useState } from 'react';
import { ui } from '@/lib/ui';

export default function DateSelector({ selectedDate, today, minDate, onSelectDate }) {
  const [open, setOpen] = useState(false);

  const handleChange = (e) => {
    const val = e.target.value;
    if (val && val >= minDate && val <= today) {
      onSelectDate(val);
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ui.linkMuted}>
        Pick another date
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={selectedDate}
        min={minDate}
        max={today}
        onChange={handleChange}
        className={ui.input}
      />
      <button type="button" onClick={() => setOpen(false)} className={ui.linkMuted}>
        Close
      </button>
    </div>
  );
}