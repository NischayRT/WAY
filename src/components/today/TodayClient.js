'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Pencil } from 'lucide-react';
import { resolveDateTargets } from '@/lib/weightTimeline';
import { groupMeals, dailyScore, dayDot, tileModel } from '@/lib/daily';
import { PAGE, Eyebrow, Btn, fmt, useMounted, cx } from '@/components/way/ui';
import { HealthTile, EditTilesDialog, useTileSelection, tileSpan } from '@/components/way/tiles';
import WeightLogDialog from '@/components/way/WeightLogDialog';
import { useJson } from '@/components/way/useJson';
import ScoreCard from './ScoreCard';
import BodyAgeCard from './BodyAgeCard';
import MealsSection from './MealsSection';
import WeekCard, { buildWeek } from './WeekCard';
import WeightCard from './WeightCard';
import StreakCard from './StreakCard';
import RankCard from './RankCard';
import HealthDataNotice from '@/components/way/HealthDataNotice';

const EXTRA_KEYS = ['heart', 'oxygen', 'floors', 'sleep', 'glucose'];
const EMPTY = { categories: [], overallTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 } };

function WeekStrip({ days, selectedDate, onSelect, variant }) {
  const desktop = variant === 'desktop';
  return (
    <div
      className={cx(
        'gap-1 rounded-2xl border border-way-line bg-way-card p-1',
        desktop ? 'hidden rounded-[14px] lg:flex' : 'grid grid-cols-7 lg:hidden'
      )}
    >
      {days.map((day) => {
        const sel = day.date === selectedDate;
        const dot = day.dot;
        const ring = dot.kind === 'open' ? `inset 0 0 0 1.2px ${sel ? '#090d16' : '#94a3b8'}` : 'none';
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelect(day.date)}
            aria-pressed={sel}
            className={cx(
              'flex items-center rounded-xl transition-colors duration-[250ms]',
              desktop ? 'gap-2 rounded-[10px] px-3 py-2' : 'flex-col gap-1 py-2 pb-[7px]',
              sel ? 'bg-way-ink text-way-page' : 'text-way-ink2 hover:bg-way-hover'
            )}
          >
            <span className={cx('font-heading font-bold uppercase opacity-70', desktop ? 'text-[11px] tracking-[0.08em]' : 'text-[10px] tracking-[0.1em]')}>
              {desktop ? day.short : day.letter}
            </span>
            <span className={cx('font-mono font-semibold leading-none', desktop ? 'text-[13px]' : 'text-[15px]')}>{day.num}</span>
            <span
              className="h-[5px] w-[5px] rounded-full"
              style={{ background: dot.color || 'transparent', boxShadow: ring }}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function TodayClient({
  profile,
  weightLogs,
  days,
  today,
  minDate,
  weekBreakdowns,
  initialSelectedDate,
  outOfRange,
  googleHealth = { connected: false },
  streak,
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [seenInitial, setSeenInitial] = useState(initialSelectedDate);
  const [editTiles, setEditTiles] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [tiles, saveTiles] = useTileSelection(profile?.id);
  const dateInput = useRef(null);
  const mounted = useMounted();
  const k = mounted ? 1 : 0;

  // A new ?date= from the server (e.g. after navigating) resets the selection.
  if (seenInitial !== initialSelectedDate) {
    setSeenInitial(initialSelectedDate);
    setSelectedDate(initialSelectedDate);
  }

  // Steps, distance and active calories for the day on screen.
  const steps = useJson(googleHealth.connected ? `/api/google-health/steps?date=${selectedDate}` : null);
  const bodyAge = useJson(googleHealth.connected ? '/api/body-age' : null);
  const load = useJson(googleHealth.connected ? `/api/google-health/daily-load?date=${selectedDate}` : null);
  const bodyAgeReady = !!(bodyAge.data?.eligible && bodyAge.data?.result);
  const health = useMemo(() => {
    const s = steps.data;
    return {
      loading: steps.loading,
      connected: googleHealth.connected ? (s ? !!s.connected : null) : false,
      data: s?.connected
        ? { steps: Number(s.steps) || 0, distanceKm: Number(s.distanceKm) || 0, activeCalories: Number(s.activeCalories) || 0 }
        : {},
    };
  }, [steps.data, steps.loading, googleHealth.connected]);

  // The optional tiles that are switched on, in one request.
  const extraKeys = useMemo(() => tiles.filter((t) => EXTRA_KEYS.includes(t)), [tiles]);
  const tileRes = useJson(
    googleHealth.connected && extraKeys.length ? `/api/google-health/tiles?date=${selectedDate}&keys=${extraKeys.join(',')}` : null
  );
  const extras = useMemo(() => {
    if (tileRes.loading || (!tileRes.data && !tileRes.error)) return {};
    return tileRes.data?.tiles || Object.fromEntries(extraKeys.map((key) => [key, { error: true }]));
  }, [tileRes.loading, tileRes.data, tileRes.error, extraKeys]);

  const handleSelectDate = (date) => {
    if (!date || date < minDate || date > today) return;
    setSelectedDate(date);
    const cached = Object.prototype.hasOwnProperty.call(weekBreakdowns, date) || outOfRange?.date === date;
    if (cached) {
      window.history.replaceState(null, '', date === today ? '/home' : `/home?date=${date}`);
      return;
    }
    startTransition(() => router.push(`/home?date=${date}`));
  };

  const targets = useMemo(
    () => resolveDateTargets({ profile, targetDateStr: selectedDate, weightLogs }),
    [profile, selectedDate, weightLogs]
  );
  const breakdown = weekBreakdowns[selectedDate] ?? (outOfRange?.date === selectedDate ? outOfRange.breakdown : EMPTY);
  const closed = selectedDate < today;
  const connected = health.connected === true;
  const goals = {
    steps: profile?.step_goal ?? null,
    distanceKm: profile?.distance_goal_km ? Number(profile.distance_goal_km) : null,
    burnKcal: profile?.burn_goal_kcal ?? null,
  };

  // ---- the day
  const d = useMemo(() => {
    const totals = breakdown.overallTotals;
    const meals = groupMeals(breakdown.categories, targets.targetCalories).map((m) => {
      const r = m.budget ? m.totals.calories / m.budget : 0;
      const over = r > 1.1;
      return {
        ...m,
        fill: Math.min(100, r * 100),
        barColor: over ? '#fb7185' : '#fbbf24',
        valColor: over ? '#fb7185' : m.totals.calories === 0 ? '#64748b' : r >= 0.9 ? '#34d399' : '#f1f5f9',
        countStr: m.items.length ? `${m.items.length} item${m.items.length > 1 ? 's' : ''}` : 'Empty',
      };
    });
    const sc = dailyScore({ totals, targets, closed, connected, activity: health.data, goals });
    const left = targets.targetCalories - totals.calories;
    const dev = targets.targetCalories ? (totals.calories - targets.targetCalories) / targets.targetCalories : 0;
    let sentence;
    if (!closed) {
      const biggest = meals.filter((m) => m.items.length === 0).sort((a, b) => b.budget - a.budget)[0];
      const stepsLeft = Math.max(0, (goals.steps || 10000) - (health.data.steps || 0));
      const pLeft = Math.max(0, Math.round(targets.proteinG - totals.protein));
      sentence =
        left >= 0
          ? `${fmt(left)} kcal${connected && stepsLeft ? ` and ${fmt(stepsLeft)} steps` : ''} to go.${
              biggest ? ` ${biggest.label} is your biggest open slot` : ''
            }${pLeft ? `${biggest ? '; aim' : ' Aim'} for ${pLeft} g more protein.` : biggest ? '.' : ''}`
          : `Over by ${fmt(-left)} kcal. A walk after dinner evens it out.`;
    } else if (totals.calories === 0) {
      sentence = 'Nothing was logged on this day.';
    } else {
      sentence =
        Math.abs(dev) <= 0.1
          ? `Closed at ${fmt(totals.calories)} kcal, on target. Protein ${Math.round((totals.protein / targets.proteinG) * 100)}% of goal.`
          : `Closed at ${fmt(totals.calories)} kcal, ${Math.abs(Math.round(dev * 100))}% ${dev < 0 ? 'under' : 'over'} target.`;
    }
    const mac = (label, v, t, color, more) => {
      const l = t - v;
      return { label, v, t, color, note: l > 0 ? `${Math.round(l)} g ${closed ? 'short' : 'left'}` : more ? 'Goal reached' : `${Math.round(-l)} g over` };
    };
    return {
      ...sc,
      connected,
      totals,
      targets,
      meals,
      sentence,
      leftStr: left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`,
      leftColor: left >= 0 ? '#94a3b8' : '#fb7185',
      macros: [
        mac('Protein', totals.protein, targets.proteinG, '#34d399', true),
        mac('Carbs', totals.carbs, targets.carbsG, '#60a5fa'),
        mac('Fat', totals.fat, targets.fatG, '#a78bfa'),
      ],
    };
    // goals is rebuilt each render from profile fields
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, targets, closed, connected, health.data, profile]);

  // ---- the week
  const week = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        dot: dayDot({ calories: day.calories, target: day.target, closed: !day.isToday, hasLogs: day.hasLogs }),
      })),
    [days]
  );
  const wk = useMemo(() => buildWeek(days, targets.targetCalories, selectedDate), [days, targets.targetCalories, selectedDate]);

  // ---- tiles
  const tileModels = tiles.map((key) => ({
    key,
    model: tileModel(key, { health: health.data, extra: extras[key], goals, loading: health.loading }),
  }));
  const goalTiles = tileModels.filter((t) => t.model.hasGoal || t.model.status === 'reached' || t.model.status === 'exceeded');
  const onTrack = tileModels.filter((t) => t.model.status === 'reached' || t.model.status === 'exceeded').length;
  const tilesSummary = `${onTrack} of ${goalTiles.length || tileModels.length} on track · ${tiles.length} tile${tiles.length > 1 ? 's' : ''}`;
  const connectHref = (scope) => `/api/google-health/connect?returnTo=%2Fhome${scope ? `&extra=${scope}` : ''}`;

  const [y, m, dd] = selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, dd);
  const title = selectedDate === today ? 'Today' : dateObj.toLocaleDateString('en-IN', { weekday: 'long' });
  const dateLong = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const initial = (profile?.full_name || 'W').trim().charAt(0).toUpperCase();

  return (
    <main className={PAGE}>
      <header className="flex items-center justify-between gap-3 px-0.5 md:gap-6">
        <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3.5">
          <h1 className="font-heading text-[28px] font-bold leading-none tracking-[-0.01em] md:text-[34px]">{title}</h1>
          <span className="font-mono text-[11px] font-medium text-way-dim md:text-xs">{dateLong}</span>
        </div>
        <div className="flex items-center gap-3">
          <WeekStrip days={week} selectedDate={selectedDate} onSelect={handleSelectDate} variant="desktop" />
          <button
            type="button"
            aria-label="Pick a date"
            title="Pick a date"
            onClick={() => (dateInput.current?.showPicker ? dateInput.current.showPicker() : dateInput.current?.click())}
            className="relative hidden h-[42px] w-[42px] items-center justify-center rounded-xl border border-way-line bg-way-card text-way-mute transition-colors hover:text-way-ink md:flex"
          >
            <Calendar size={17} />
          </button>
          <input
            ref={dateInput}
            type="date"
            aria-hidden="true"
            tabIndex={-1}
            min={minDate}
            max={today}
            value={selectedDate}
            onChange={(e) => handleSelectDate(e.target.value)}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
          />
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-way-line2 bg-way-track text-sm font-semibold md:hidden"
          >
            {initial}
          </Link>
        </div>
      </header>

      <WeekStrip days={week} selectedDate={selectedDate} onSelect={handleSelectDate} variant="mobile" />

      <div className={cx('grid grid-cols-1 gap-3.5 transition-opacity lg:grid-cols-12 lg:gap-5', isNavigating && 'opacity-60')}>
        {/* Competing with friends: a short-lived rank banner. */}
        <RankCard userId={profile?.id} today={today} className="lg:col-span-12" />

        {/* No Google Health: calories and macros only. With it: the Daily Score,
            and Body Age beside it once every stat it needs is available. */}
        <div className={bodyAgeReady ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <ScoreCard d={d} k={k} connectHref={connectHref()} showScore={!!googleHealth.connected} load={load.data?.connected ? load.data : null} />
          {!googleHealth.connected ? <HealthDataNotice className="mt-2 px-1" /> : null}
        </div>
        {bodyAgeReady ? <BodyAgeCard data={bodyAge.data} className="lg:col-span-4" /> : null}
        <div className="lg:hidden">
          <StreakCard streak={streak} k={k} />
        </div>

        {googleHealth.connected ? (
          <>
            <div className="flex items-center justify-between px-0.5 pt-1.5 lg:col-span-12 lg:-mb-1.5 lg:p-0">
              <div className="flex items-baseline gap-3">
                <Eyebrow>Health tiles</Eyebrow>
                <span className="hidden font-mono text-[11px] font-medium text-way-dim lg:inline">{tilesSummary}</span>
              </div>
              <Btn variant="outline" size="sm" onClick={() => setEditTiles(true)} className="rounded-full lg:px-3.5">
                <Pencil size={12} />
                Edit tiles
              </Btn>
            </div>
            <div className="grid grid-cols-2 gap-2.5 lg:col-span-12 lg:grid-cols-12 lg:gap-5">
              {tileModels.map((t, i) => (
                <div
                  key={t.key}
                  className="min-w-0 [grid-column:span_var(--sm)/span_var(--sm)] lg:[grid-column:span_var(--lg)/span_var(--lg)]"
                  style={{ '--sm': tiles.length % 2 === 1 && i === tiles.length - 1 ? 2 : 1, '--lg': tileSpan(i, tiles.length) }}
                >
                  {t.model.state ? (
                    <HealthTile tileKey={t.key} model={t.model} k={k} delay={120 + i * 60} connectHref={connectHref(t.key === 'sleep' ? 'sleep' : null)} />
                  ) : (
                    <Link
                      href={`/activity#stat-${t.key}`}
                      title="Open in Activity"
                      className="block h-full rounded-[18px] transition-transform duration-200 hover:-translate-y-0.5 md:rounded-[20px] [&>div]:h-full"
                    >
                      <HealthTile tileKey={t.key} model={t.model} k={k} delay={120 + i * 60} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="lg:col-span-8">
          <MealsSection meals={d.meals} k={k} selectedDate={selectedDate} today={today} minDate={minDate} />
        </div>

        <div className="flex flex-col gap-3.5 lg:col-span-4 lg:gap-5 lg:pt-[52px]">
          <div className="hidden lg:block">
            <StreakCard streak={streak} k={k} />
          </div>
          <div className="order-2 lg:order-1">
            <WeightCard
              profile={profile}
              weightLogs={weightLogs}
              selectedDate={selectedDate}
              today={today}
              currentWeight={targets.effectiveWeight}
              onLog={() => setWeightOpen(true)}
              k={k}
            />
          </div>
          <div className="order-1 lg:order-2">
            <WeekCard wk={wk} k={k} selectedDate={selectedDate} onSelect={handleSelectDate} />
          </div>
        </div>
      </div>

      <EditTilesDialog
        open={editTiles}
        onClose={() => setEditTiles(false)}
        current={tiles}
        onSave={(next) => {
          saveTiles(next);
          setEditTiles(false);
        }}
      />
      <WeightLogDialog
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        date={selectedDate}
        today={today}
        currentWeight={targets.effectiveWeight}
      />
    </main>
  );
}

