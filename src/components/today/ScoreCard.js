'use client';

import Link from 'next/link';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import { Card, Eyebrow, Dot, fmt, cx } from '@/components/way/ui';

const EASE = 'transition-[width] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]';

function SplitBars({ split, k, className = '' }) {
  return (
    <div className={cx('flex flex-col gap-2.5 lg:gap-3', className)}>
      {split.map((s) => (
        <div key={s.label} className="flex flex-col gap-[5px] lg:gap-1.5">
          <div className="flex justify-between text-[11px] text-way-mute lg:text-xs">
            <span>{s.label}</span>
            <span className="font-mono font-semibold text-way-ink">{Math.round(s.val)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-way-track">
            <div className={cx('h-full rounded-full', EASE)} style={{ width: `${s.val * k}%`, background: s.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One hero for the day: the score (food + activity), one sentence on what's
 * left, calories split by meal budget, then protein, carbs and fat once each.
 * Without Google Health there's no score: just calories and the macro split.
 * The calories and macros open the Nutrition page.
 */
export default function ScoreCard({ d, k, connectHref, showScore = true }) {
  const split = [{ label: 'Food', val: d.food, color: '#fbbf24' }];
  if (d.connected) split.push({ label: 'Activity', val: d.act, color: '#60a5fa' });

  const nudge = !d.connected ? (
    <a
      href={connectHref}
      className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-way-line2 px-3 py-2.5 text-left text-xs text-way-mute transition-colors hover:text-way-ink lg:rounded-[10px]"
    >
      <span>
        <span className="lg:hidden">
          {showScore ? 'Activity isn’t counted yet. Log in to Google Health to add it.' : 'Log in to Google Health for your Daily Score and activity.'}
        </span>
        <span className="hidden lg:inline">
          {showScore ? 'Log in to Google Health to count activity →' : 'Log in to Google Health to unlock your Daily Score →'}
        </span>
      </span>
      <ChevronRight size={14} className="shrink-0 lg:hidden" />
    </a>
  ) : null;

  // Calories by meal + macros
  const nutrition = (
    <div className="flex flex-col gap-[18px] lg:justify-between lg:gap-[26px]">
      <Link href="/nutrition#calories" className="group -m-2 flex flex-col gap-2.5 rounded-2xl p-2 transition-colors hover:bg-way-hover/60 lg:gap-3.5">
        <div className={cx('items-baseline justify-between', showScore ? 'hidden lg:flex' : 'flex')}>
          <span className="flex items-center gap-1.5">
            <Eyebrow>{showScore ? 'Calories by meal' : 'Calories & nutrition'}</Eyebrow>
            <ArrowUpRight size={13} className="text-way-faint transition-colors group-hover:text-way-ink2" />
          </span>
          <span className="font-mono text-[13px] font-semibold" style={{ color: d.leftColor }}>
            {d.leftStr}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5 lg:gap-2">
            <span className="font-mono text-[22px] font-semibold text-way-kcal lg:text-4xl lg:leading-none">{fmt(d.totals.calories)}</span>
            <span className="font-mono text-xs font-medium text-way-dim lg:text-sm">/ {fmt(d.targets.targetCalories)} kcal</span>
          </div>
          <span className={cx('font-mono text-xs font-semibold lg:hidden', !showScore && 'hidden')} style={{ color: d.leftColor }}>
            {d.leftStr}
          </span>
        </div>
        <div className="flex h-2.5 gap-[3px] lg:h-3.5 lg:gap-1">
          {d.meals.map((m) => (
            <div key={m.key} className="overflow-hidden rounded-[3px] bg-way-track lg:rounded" style={{ flex: m.frac * 100 }}>
              <div className={cx('h-full', EASE)} style={{ width: `${m.fill * k}%`, background: m.barColor }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5 lg:gap-3">
          {d.meals.map((m) => (
            <div key={m.key} className="flex flex-col gap-px lg:gap-0.5">
              <span className="text-[11px] text-way-mute lg:text-xs">{m.label}</span>
              <span className="font-mono text-[11px] font-semibold lg:text-xs" style={{ color: m.valColor }}>
                {fmt(m.totals.calories)}
                <span className="text-way-faint">/{fmt(m.budget)}</span>
              </span>
            </div>
          ))}
        </div>
      </Link>
      <div className="hidden h-px bg-way-line lg:block" />
      <Link href="/nutrition#macros" className="-m-2 grid grid-cols-3 gap-3.5 rounded-2xl p-2 transition-colors hover:bg-way-hover/60 lg:gap-6">
        {d.macros.map((m) => (
          <div key={m.label} className="flex flex-col gap-1.5 lg:gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-way-mute lg:gap-[7px] lg:text-xs">
              <Dot color={m.color} />
              {m.label}
            </div>
            <div className="flex items-baseline gap-[3px] lg:gap-1">
              <span className="font-mono text-lg font-semibold lg:text-[26px]">{Math.round(m.v)}</span>
              <span className="font-mono text-[11px] font-medium text-way-dim lg:text-xs">/{m.t}g</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-way-track lg:h-[5px]">
              <div className={cx('h-full rounded-full', EASE)} style={{ width: `${Math.min(100, (m.v / m.t) * 100) * k}%`, background: m.color }} />
            </div>
            <span className="hidden text-xs text-way-dim lg:block">{m.note}</span>
          </div>
        ))}
      </Link>
    </div>
  );

  if (!showScore) {
    return (
      <Card rise className="flex flex-col gap-[18px] p-[18px] lg:gap-6 lg:p-7">
        {nutrition}
        <p className="text-sm leading-[1.45] text-way-ink2 [text-wrap:pretty]">{d.sentence}</p>
        {nudge}
      </Card>
    );
  }

  return (
    <Card rise className="flex flex-col gap-[18px] p-[18px] lg:grid lg:grid-cols-[300px_1px_minmax(0,1fr)] lg:gap-7 lg:p-7">
      {/* Score */}
      <div className="flex flex-col gap-[18px] lg:gap-4">
        <div className="flex items-end justify-between gap-3 lg:block">
          <div className="flex flex-col gap-1.5 lg:gap-4">
            <div className="flex items-center gap-1.5 whitespace-nowrap lg:gap-2">
              <Eyebrow>Daily score</Eyebrow>
              <span
                className="whitespace-nowrap rounded-full border px-[7px] py-0.5 font-mono text-[10px] font-semibold"
                style={{ color: d.tone, borderColor: `${d.tone}55` }}
              >
                {d.tag}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-1 lg:gap-2 lg:pt-0">
              <span
                className="font-brand text-[84px] leading-[.85] transition-colors duration-[400ms] lg:text-[128px] lg:leading-[.8]"
                style={{ color: d.tone }}
              >
                {d.score}
              </span>
              <span className="font-mono text-xs font-medium text-way-dim lg:text-[13px]">/100</span>
            </div>
          </div>
          <SplitBars split={split} k={k} className="w-28 shrink-0 pb-1.5 lg:hidden" />
        </div>
        <p className="text-sm leading-[1.45] text-way-ink2 [text-wrap:pretty] lg:text-[15px] lg:leading-normal">{d.sentence}</p>
        <div className="lg:hidden">{nudge}</div>
        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          <SplitBars split={split} k={k} />
          {nudge}
        </div>
      </div>

      <div className="h-px bg-way-line lg:h-auto" />

      {nutrition}
    </Card>
  );
}
