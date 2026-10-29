'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Flame, Crown, Sparkles, Lock, Check, Utensils, CalendarDays } from 'lucide-react';
import { STREAK_TIERS, streakTier } from '@/lib/streak';
import { addDays } from '@/lib/dateUtils';
import { PAGE, Card, Eyebrow, Btn, cx } from '@/components/way/ui';
import TapTips from '@/components/way/TapTips';

// Deterministic "random" so server and client render the same particles.
// Rounded, because Math.sin can differ in the last digits between server and browser.
const rnd = (i, s = 1) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
};

const MESSAGES = [
  ['Every streak starts with one day. Today can be that day.', 'Open WAY tomorrow and you have a streak.'],
  ['A spark is all it takes. Keep showing up.', 'Two days in a row is how habits begin.', 'Small check-ins add up faster than you think.'],
  ['You’re building momentum. Three days is a pattern.', 'Kindling catches. Don’t let it go out now.', 'Your future self is noticing.'],
  ['A full week. This is what consistency feels like.', 'On fire. Most people never get this far.', 'Seven days of choosing yourself. Keep going.'],
  ['Two weeks strong. It’s becoming who you are.', 'Blazing. Habits this old are hard to break.', 'You don’t need motivation now. You have rhythm.'],
  ['A month and counting. That’s real change.', 'Inferno. You’ve outlasted every excuse.', 'Thirty days of proof that you follow through.'],
  ['Legendary. A hundred days of showing up.', 'You’re in rare company now.', 'This isn’t a streak any more. It’s a lifestyle.'],
];

const BENEFITS = [
  ['Daily check-ins', 'Seeing your numbers every day keeps small slips from becoming big ones.'],
  ['Better targets', 'The more days WAY sees, the better your calorie and body predictions get.'],
  ['Unlock more', 'Long streaks light up new looks here, on Today and in Friends.'],
];

/** Background effects that grow with the tier. */
function Atmosphere({ lvl, color, burst }) {
  const embers = [4, 8, 14, 22, 30, 38, 52][lvl];
  const speed = [14, 12, 10, 8.5, 7.5, 6.5, 5.5][lvl];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden md:left-[76px]" aria-hidden="true">
      <div
        className="absolute left-1/2 top-[-20vh] h-[80vh] w-[120vw] -translate-x-1/2 rounded-full transition-[background] duration-1000 md:w-[80vw]"
        style={{ background: `radial-gradient(closest-side, ${color}${lvl >= 4 ? '30' : lvl >= 2 ? '22' : '14'}, transparent)` }}
      />
      {lvl >= 4 ? (
        <div
          className="way-spin absolute left-1/2 top-[8vh] h-[70vh] w-[70vh] -translate-x-1/2 rounded-full opacity-40 blur-2xl"
          style={{ background: `conic-gradient(from 0deg, transparent, ${color}55, transparent 30%, ${lvl >= 6 ? '#fde68a55' : `${color}33`}, transparent 65%)`, '--t': `${lvl >= 6 ? 14 : 22}s` }}
        />
      ) : null}
      {lvl >= 6
        ? Array.from({ length: 12 }, (_, i) => (
            <div
              key={`ray${i}`}
              className="way-spin absolute left-1/2 top-[30vh] h-[2px] w-[60vw] origin-left opacity-30"
              style={{ background: `linear-gradient(90deg, ${color}, transparent)`, transform: `rotate(${i * 30}deg)`, '--t': '40s' }}
            />
          ))
        : null}
      {Array.from({ length: embers }, (_, i) => {
        const size = 2 + rnd(i, 2) * (lvl >= 4 ? 5 : 3);
        return (
          <span
            key={i}
            className="way-ember absolute bottom-[-10px] rounded-full"
            style={{
              left: `${rnd(i) * 100}%`,
              width: size,
              height: size,
              background: i % 5 === 0 && lvl >= 5 ? '#fde68a' : color,
              boxShadow: `0 0 ${size * 3}px ${color}`,
              '--t': `${speed + rnd(i, 3) * 6}s`,
              '--d': `${-rnd(i, 4) * 12}s`,
              '--dx': `${(rnd(i, 5) - 0.5) * 120}px`,
              '--o': 0.5 + rnd(i, 6) * 0.5,
            }}
          />
        );
      })}
      {lvl >= 5
        ? Array.from({ length: 18 }, (_, i) => (
            <Sparkles
              key={`s${i}`}
              size={8 + rnd(i, 7) * 10}
              className="way-twinkle absolute"
              style={{ left: `${rnd(i, 8) * 100}%`, top: `${rnd(i, 9) * 70}%`, color: '#fde68a', '--d': `${rnd(i, 10) * 3}s`, '--t': `${1.8 + rnd(i, 11) * 2}s` }}
            />
          ))
        : null}
      {burst
        ? Array.from({ length: 70 }, (_, i) => (
            <span
              key={`c${i}`}
              className="way-confetti absolute top-0 h-2.5 w-1.5 rounded-[2px]"
              style={{
                left: `${rnd(i, 12) * 100}%`,
                background: ['#facc15', '#34d399', '#60a5fa', '#fb7185', '#c084fc', color][i % 6],
                '--dx': `${(rnd(i, 13) - 0.5) * 200}px`,
                '--r': `${360 + rnd(i, 14) * 720}deg`,
                '--d': `${rnd(i, 15) * 0.8}s`,
                '--t': `${2.4 + rnd(i, 16) * 1.8}s`,
              }}
            />
          ))
        : null}
    </div>
  );
}

/** Counts up from 0 to n when the page opens. */
function useCountUp(n, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(n * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  return v;
}

export default function StreakClient({ login, food, today, name }) {
  const n = login.current;
  const t = streakTier(n);
  const lvl = t.level;
  const next = t.nextTier;
  const shown = useCountUp(n);
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setK(1), 80);
    return () => clearTimeout(id);
  }, []);

  // Confetti when you land exactly on a new tier, and always at the top tiers.
  const burst = (n > 0 && STREAK_TIERS.some((x) => x.min === n)) || lvl >= 5;
  const pct = next ? ((n - t.min) / (next.min - t.min)) * 100 : 100;
  const msgs = MESSAGES[lvl];
  const dayNum = Math.floor(new Date(`${today}T00:00:00Z`).getTime() / 86400000);
  const message = msgs[dayNum % msgs.length];
  const Icon = lvl >= 6 ? Crown : Flame;
  const recent = new Set(login.recent || []);

  // 6-week calendar ending this week (Monday first).
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(today, -dow - 35);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <main className={cx(PAGE, 'relative')}>
      <Atmosphere lvl={lvl} color={t.color} burst={burst} />

      <header className="relative flex items-center justify-between gap-3 px-0.5">
        <Link href="/home" className="flex items-center gap-2 text-[13px] text-way-mute hover:text-way-ink">
          <ArrowLeft size={16} />
          Today
        </Link>
        <span className="font-mono text-[11px] text-way-dim">{login.source === 'visits' ? 'Days you opened WAY' : 'Days with food logged'}</span>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center gap-4 pb-2 pt-6 text-center md:pt-10">
        <div className="way-pop relative flex h-28 w-28 items-center justify-center md:h-36 md:w-36" style={{ '--d': '100ms' }}>
          {lvl >= 2 ? (
            <div
              className="absolute inset-0 rounded-full transition-[background] duration-1000"
              style={{ background: `conic-gradient(${t.color} ${pct * 3.6 * k}deg, #1a2130 0)`, transitionDuration: '1400ms' }}
            />
          ) : null}
          <div
            className="way-breathe relative flex h-[88%] w-[88%] items-center justify-center rounded-full"
            style={{ background: `radial-gradient(circle at 50% 65%, ${t.color}44, #0b101a 72%)`, boxShadow: lvl >= 3 ? `0 0 60px ${t.color}55` : 'none' }}
          >
            <Icon
              size={lvl >= 4 ? 60 : 52}
              className={cx(lvl >= 2 && 'way-flicker')}
              style={{ color: t.color, fill: lvl >= 1 ? `${t.color}55` : 'none', filter: lvl >= 4 ? `drop-shadow(0 0 12px ${t.color})` : 'none' }}
            />
          </div>
        </div>
        <div className="way-rise flex flex-col items-center gap-1" style={{ '--d': '250ms' }}>
          <span
            className={cx('font-brand text-[96px] leading-[.85] md:text-[140px]', lvl >= 5 && 'way-shimmer bg-clip-text text-transparent')}
            style={lvl >= 5 ? { backgroundImage: `linear-gradient(90deg, ${t.color}, #fde68a, ${t.color})` } : { color: lvl ? '#f1f5f9' : '#475569' }}
          >
            {shown}
          </span>
          <span className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-way-mute">day streak</span>
        </div>
        <span
          className={cx('way-pop rounded-full px-3.5 py-1 font-heading text-xs font-bold uppercase tracking-[0.16em]', lvl >= 5 && 'way-shimmer')}
          style={{
            '--d': '600ms',
            ...(lvl >= 5 ? { color: '#0b0f17', backgroundImage: `linear-gradient(90deg, ${t.color}, #fde68a, ${t.color})` } : { color: t.color, background: `${t.color}1f` }),
          }}
        >
          {t.name}
        </span>
        <p className="way-rise max-w-[460px] text-[15px] leading-normal text-way-ink2 [text-wrap:pretty] md:text-base" style={{ '--d': '700ms' }}>
          {name ? `${name}, ` : ''}
          {message.charAt(0).toLowerCase() + message.slice(1)}
        </p>
      </section>

      {/* Next milestone */}
      <Card rise delay={800} className="relative flex flex-col gap-3 p-5 md:p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>{next ? `Next: ${next.name}` : 'Top tier reached'}</Eyebrow>
          <span className="font-mono text-xs text-way-mute">{next ? `${next.min - n} day${next.min - n === 1 ? '' : 's'} to go` : `${n} days`}</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-way-track">
          <div
            className="h-full rounded-full transition-[width] duration-[1400ms] ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ width: `${pct * k}%`, background: next ? `linear-gradient(90deg, ${t.color}, ${next.color})` : t.color, boxShadow: `0 0 16px ${t.color}88` }}
          />
        </div>
        <span className="text-xs text-way-dim">
          {login.loggedToday ? 'Today is counted.' : 'Open WAY today to keep it going.'} Miss a day and the streak starts over.
        </span>
      </Card>

      {/* Tier ladder */}
      <Card rise delay={900} className="relative flex flex-col gap-4 p-5 md:p-6">
        <Eyebrow>Streak levels</Eyebrow>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {STREAK_TIERS.slice(1).map((tier, i) => {
            const got = n >= tier.min;
            const current = tier.key === t.key;
            const TIcon = tier.key === 'legend' ? Crown : Flame;
            return (
              <div
                key={tier.key}
                className={cx('way-rise relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center', current && 'way-breathe')}
                style={{
                  '--d': `${950 + i * 90}ms`,
                  borderColor: got ? `${tier.color}66` : '#1c2433',
                  background: got ? `${tier.color}12` : 'transparent',
                  boxShadow: current ? `0 0 24px ${tier.color}44` : 'none',
                }}
              >
                {got ? <TIcon size={20} style={{ color: tier.color, fill: `${tier.color}44` }} /> : <Lock size={18} className="text-way-faint" />}
                <span className="text-xs font-semibold" style={{ color: got ? '#f1f5f9' : '#7c8aa0' }}>
                  {tier.name}
                </span>
                <span className="font-mono text-[10px] text-way-dim">{tier.min}+ days</span>
                {got && !current ? <Check size={12} className="absolute right-2 top-2 text-way-protein" /> : null}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="relative grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
        {/* Calendar */}
        <Card rise delay={1000} className="flex flex-col gap-3.5 p-5 md:p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <Eyebrow>Last 6 weeks</Eyebrow>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-way-dim">
              <CalendarDays size={13} />
              {recent.size} of 42 days
            </span>
          </div>
          <TapTips className="mx-auto grid w-full max-w-[340px] grid-cols-7 gap-1.5">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i} className="text-center font-heading text-[10px] font-bold text-way-dim">
                {d}
              </span>
            ))}
            {cells.map((d, i) => {
              const on = recent.has(d);
              const future = d > today;
              return (
                <span
                  key={d}
                  data-tip={future ? undefined : `${new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}\n${on ? 'Opened WAY' : 'Missed'}`}
                  className={cx('way-pop aspect-square rounded-md', d === today && 'ring-2 ring-way-ink/60')}
                  style={{
                    '--d': `${1100 + i * 18}ms`,
                    background: future ? 'transparent' : on ? t.color : '#1a2130',
                    opacity: future ? 0.25 : 1,
                    boxShadow: on && lvl >= 3 ? `0 0 10px ${t.color}66` : 'none',
                    border: future ? '1px dashed #253044' : 'none',
                  }}
                />
              );
            })}
          </TapTips>
        </Card>

        {/* Food streak + why */}
        <div className="flex flex-col gap-3.5 lg:col-span-5 lg:gap-5">
          <Card rise delay={1100} className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/12">
              <Utensils size={20} className="text-way-kcal" />
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <Eyebrow>Food logging streak</Eyebrow>
              <span className="font-mono text-lg font-semibold">
                {food.current} day{food.current === 1 ? '' : 's'}
              </span>
            </div>
            <Btn as={Link} href="/log-food" variant="primary" size="sm">
              Log food
            </Btn>
          </Card>
          <Card rise delay={1200} className="flex flex-col gap-3 p-5">
            <Eyebrow>Why it matters</Eyebrow>
            {BENEFITS.map(([title, text]) => (
              <div key={title} className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{title}</span>
                <span className="text-xs text-way-mute [text-wrap:pretty]">{text}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </main>
  );
}
