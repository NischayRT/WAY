'use client';

import Link from 'next/link';
import { Flame, Crown, Sparkles, ChevronRight } from 'lucide-react';
import { streakTier } from '@/lib/streak';
import { Card, Eyebrow, cx } from '@/components/way/ui';

/**
 * Login streak (days you opened WAY); opens the streak page. The look grows with the streak: a grey ember, a small
 * spark, then a glowing flame, a flickering fire, a blaze with a gradient
 * border, an inferno with a shimmer, and a gold crown at 100+ days.
 */
export default function StreakCard({ streak, k, className = '' }) {
  const n = streak?.current || 0;
  const t = streakTier(n);
  const lvl = t.level;
  const next = t.nextTier;
  const toNext = next ? next.min - n : 0;
  const pct = next ? ((n - t.min) / (next.min - t.min)) * 100 : 100;
  const pending = n > 0 && !streak.loggedToday;

  const line =
    n === 0
      ? 'Open WAY every day to build a streak.'
      : pending
        ? 'Check in today to keep it alive.'
        : next
          ? `${toNext} more day${toNext === 1 ? '' : 's'} to ${next.name}.`
          : 'Top tier. Every day adds to the legend.';

  const border =
    lvl >= 4
      ? { border: '1px solid transparent', background: `linear-gradient(#0f1420,#0f1420) padding-box, linear-gradient(135deg, ${t.color}, ${lvl >= 6 ? '#fb923c' : '#334155'}) border-box` }
      : lvl >= 2
        ? { borderColor: `${t.color}55` }
        : undefined;

  const Icon = lvl >= 6 ? Crown : Flame;

  return (
    <Card rise delay={60} as={Link} href="/streak" className={cx('group relative flex items-center gap-4 overflow-hidden p-4 transition-colors lg:p-5', className)} style={border}>
      {t.glow ? (
        <div
          className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full"
          style={{ background: `radial-gradient(circle, ${t.glow}, transparent 70%)` }}
        />
      ) : null}

      {/* Flame badge */}
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center lg:h-16 lg:w-16">
        {lvl >= 3 ? (
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: `conic-gradient(${t.color} ${Math.min(100, pct) * 3.6 * k}deg, #1a2130 0)`, transition: 'background 900ms' }}
          />
        ) : null}
        <div
          className={cx('relative flex items-center justify-center rounded-full', lvl >= 3 ? 'h-[46px] w-[46px] lg:h-[54px] lg:w-[54px]' : 'h-14 w-14 lg:h-16 lg:w-16')}
          style={{ background: lvl === 0 ? '#141b29' : `radial-gradient(circle at 50% 70%, ${t.color}33, #0f1420 75%)` }}
        >
          <Icon
            size={lvl >= 5 ? 28 : lvl >= 2 ? 26 : 22}
            className={cx(lvl >= 3 && !pending && 'way-flicker')}
            style={{ color: t.color, fill: lvl >= 2 ? `${t.color}55` : 'none', opacity: pending ? 0.55 : 1, filter: lvl >= 4 ? `drop-shadow(0 0 6px ${t.color})` : 'none' }}
          />
          {lvl >= 5 ? <Sparkles size={12} className="absolute -right-0.5 -top-0.5 text-way-gold" /> : null}
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Eyebrow>Login streak</Eyebrow>
          {n > 0 ? (
            <span
              className={cx('rounded-full px-2 py-px font-heading text-[10px] font-bold uppercase tracking-[0.12em]', lvl >= 5 && 'way-shimmer')}
              style={
                lvl >= 5
                  ? { color: '#0b0f17', backgroundImage: `linear-gradient(90deg, ${t.color}, #fde68a, ${t.color})` }
                  : { color: t.color, background: `${t.color}1f` }
              }
            >
              {t.name}
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={cx('font-brand text-[40px] leading-none lg:text-5xl', lvl >= 5 && 'way-shimmer bg-clip-text text-transparent')}
            style={lvl >= 5 ? { backgroundImage: `linear-gradient(90deg, ${t.color}, #fde68a, ${t.color})` } : { color: lvl === 0 ? '#475569' : '#f1f5f9' }}
          >
            {n}
          </span>
          <span className="font-mono text-xs font-medium text-way-dim">day{n === 1 ? '' : 's'}</span>
        </div>
        <span className={cx('text-xs [text-wrap:pretty]', pending ? 'text-amber-200' : 'text-way-mute')}>{line}</span>
      </div>

      {/* Last 7 days */}
      <div className="relative hidden flex-col items-end gap-2 sm:flex">
        <div className="flex gap-1">
          {(streak?.last7 || []).map((d) => (
            <span
              key={d.date}
              className="h-5 w-2 rounded-full transition-colors"
              style={{ background: d.on ? t.color : '#1a2130', boxShadow: d.on && lvl >= 3 ? `0 0 8px ${t.color}88` : 'none' }}
              title={d.date}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] text-way-dim">last 7 days</span>
      </div>
      <ChevronRight size={16} className="relative shrink-0 text-way-faint transition-colors group-hover:text-way-ink2" />
    </Card>
  );
}
