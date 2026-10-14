'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, Eyebrow, fmt, cx } from '@/components/way/ui';

/** Last 7 days: calories as stacked protein/carbs/fat bars against the target line. */
export default function WeekCard({ wk, k, selectedDate, onSelect }) {
  return (
    <Card className="flex flex-col gap-3.5 p-[18px] lg:gap-4 lg:rounded-[20px] lg:p-[22px]">
      <div className="flex items-start justify-between">
        <Link href="/nutrition" className="group flex flex-col gap-1 lg:gap-1.5">
          <span className="flex items-center gap-1">
            <Eyebrow>Last 7 days</Eyebrow>
            <ChevronRight size={13} className="text-way-faint transition-colors group-hover:text-way-ink2 lg:hidden" />
          </span>
          <div className="flex items-baseline gap-[5px] lg:gap-1.5">
            <span className="font-mono text-xl font-semibold lg:text-[26px] lg:leading-none">{wk.avg}</span>
            <span className="font-mono text-[11px] font-medium text-way-dim lg:text-xs">kcal/day</span>
          </div>
        </Link>
        <span className="max-w-[150px] text-right text-[11px] text-way-mute lg:hidden">{wk.onTarget}</span>
        <Link href="/nutrition" className="hidden items-center gap-0.5 text-xs text-way-mute hover:text-way-ink lg:flex">
          Nutrition
          <ChevronRight size={13} />
        </Link>
      </div>
      <div className="relative flex h-[120px] items-end gap-2 lg:h-[150px] lg:gap-2.5">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-way-faint" style={{ bottom: `${wk.targetPct}%` }} />
        {wk.bars.map((b) => {
          const sel = b.date === selectedDate;
          return (
            <button
              key={b.date}
              type="button"
              title={b.title}
              onClick={() => onSelect(b.date)}
              className="flex h-full flex-1 flex-col justify-end transition-opacity duration-300"
              style={{ opacity: sel ? 1 : 0.4 }}
            >
              <div
                className="flex flex-col-reverse gap-px overflow-hidden rounded-[5px] transition-[height] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{ height: `${b.h * k}%` }}
              >
                <div style={{ flex: b.pk, background: '#34d399' }} />
                <div style={{ flex: b.ck, background: '#60a5fa' }} />
                <div style={{ flex: b.fk, background: '#a78bfa' }} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 lg:gap-2.5">
        {wk.bars.map((b) => (
          <span
            key={b.date}
            className={cx('flex-1 text-center font-mono text-[10px] font-semibold lg:text-[11px]', b.date === selectedDate ? 'text-way-ink' : 'text-way-dim')}
          >
            {b.label}
          </span>
        ))}
      </div>
      <div className="hidden border-t border-way-line pt-3 text-xs text-way-mute lg:block">{wk.onTarget} · dashed line = target</div>
    </Card>
  );
}

export function buildWeek(days, target, selectedDate) {
  const closed = days.filter((d) => !d.isToday && d.hasLogs);
  const max = Math.ceil((Math.max(...days.map((d) => d.calories), target) * 1.1) / 500) * 500 || 500;
  const onTarget = closed.filter((d) => Math.abs(d.calories - d.target) <= d.target * 0.1).length;
  return {
    avg: closed.length ? fmt(closed.reduce((s, d) => s + d.calories, 0) / closed.length) : '—',
    onTarget: closed.length ? `${onTarget} of ${closed.length} closed days on target` : 'No closed days logged yet',
    targetPct: (target / max) * 100,
    bars: days.map((d) => ({
      date: d.date,
      h: (d.calories / max) * 100,
      pk: d.protein * 4,
      ck: d.carbs * 4,
      fk: d.fat * 9,
      label: d.letter,
      title: `${d.short} ${d.num}: ${fmt(d.calories)} kcal`,
      selected: d.date === selectedDate,
    })),
  };
}
