'use client';

import { useState } from 'react';
import { ui } from '@/lib/ui';

export default function DateSelector({ selectedDate, today, onSelectDate }) {
  const [open, setOpen] = useState(false);

  const handleChange = (e) => {
    onSelectDate(e.target.value);
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
      <input type="date" value={selectedDate} max={today} onChange={handleChange} className={ui.input} />
      <button type="button" onClick={() => setOpen(false)} className={ui.linkMuted}>
        Close
      </button>
    </div>
  );
}