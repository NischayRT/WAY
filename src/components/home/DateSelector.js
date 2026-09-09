'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ui } from '@/lib/ui';

function todayLocalDate() {
  return new Date().toISOString().split('T')[0];
}

export default function DateSelector({ selectedDate }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const today = todayLocalDate();

  const handleChange = (e) => {
    const date = e.target.value;
    router.push(date === today ? '/home' : `/home?date=${date}`);
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
