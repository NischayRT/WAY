'use client';

import Link from 'next/link';
import { Footprints, Navigation, Flame, Target, MapPin, ChevronRight, RefreshCw, CheckCircle2, Trophy, AlertTriangle, HeartPulse, Droplets, Wind, Building2, Moon, Activity as Pulse, ShieldCheck } from 'lucide-react';
import fx from './HealthTiles.module.css';
import FluidFill from './FluidFill';
import { activityStatus, ACTIVITY_BUFFER_PCT, CALORIE_BUFFER_KCAL } from '@/lib/goalState';

// Four dashboard metric cards (Steps, Distance, Burn, Consumed).
// Dark mode: deep-navy glass cards with a coloured icon disc, big number and a
// gradient progress bar. Light mode: white cards with the same accents.
// The chevron (top-right) links to the Activity page.
//
// Goal states:
//   activity tiles   progress -> REACHED (>= goal) -> EXCEEDED (>= goal + buffer)
//   calories eaten   progress -> ON TARGET (within +/- buffer of the target)
//                    -> OVER (more than the buffer above the target)
// Going well past a calorie target is a warning, not a win, so that tile's
// top state is styled as one.

// Buffers live in lib/goalState.js (shared with the orbit, meal targets and
// weight bar); re-exported here for anything that imported them from this file.
export { ACTIVITY_BUFFER_PCT, CALORIE_BUFFER_KCAL };

const THEMES = {
  sky: {
    disc: 'bg-sky-100 border-sky-200 text-sky-600 dark:bg-cyan-500/10 dark:border-cyan-400/30 dark:text-cyan-300',
    bar: 'bg-gradient-to-r from-sky-500 to-cyan-400',
    accent: 'text-sky-600 dark:text-cyan-300',
    glow: 'dark:hover:shadow-cyan-500/10',
    rgb: '14 165 233',
    rgb2: '34 211 238',
  },
  emerald: {
    disc: 'bg-emerald-100 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-300',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-300',
    accent: 'text-emerald-600 dark:text-emerald-300',
    glow: 'dark:hover:shadow-emerald-500/10',
    rgb: '16 185 129',
    rgb2: '94 234 212',
  },
  violet: {
    disc: 'bg-violet-100 border-violet-200 text-violet-600 dark:bg-violet-500/10 dark:border-violet-400/30 dark:text-violet-300',
    bar: 'bg-gradient-to-r from-violet-500 to-indigo-400',
    accent: 'text-violet-600 dark:text-violet-300',
    glow: 'dark:hover:shadow-violet-500/10',
    rgb: '139 92 246',
    rgb2: '129 140 248',
  },
  pink: {
    disc: 'bg-pink-100 border-pink-200 text-pink-600 dark:bg-pink-500/10 dark:border-pink-400/30 dark:text-pink-300',
    bar: 'bg-gradient-to-r from-pink-500 to-rose-400',
    accent: 'text-pink-600 dark:text-pink-300',
    glow: 'dark:hover:shadow-pink-500/10',
    rgb: '236 72 153',
    rgb2: '251 113 133',
  },
  rose: {
    disc: 'bg-rose-100 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-400/30 dark:text-rose-300',
    bar: 'bg-gradient-to-r from-rose-500 to-pink-400',
    accent: 'text-rose-600 dark:text-rose-300',
    glow: 'dark:hover:shadow-rose-500/10',
    rgb: '244 63 94',
    rgb2: '236 72 153',
  },
  amber: {
    disc: 'bg-amber-100 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-400/30 dark:text-amber-300',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-400',
    accent: 'text-amber-600 dark:text-amber-300',
    glow: 'dark:hover:shadow-amber-500/10',
    rgb: '245 158 11',
    rgb2: '251 146 60',
  },
  indigo: {
    disc: 'bg-indigo-100 border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-400/30 dark:text-indigo-300',
    bar: 'bg-gradient-to-r from-indigo-500 to-violet-400',
    accent: 'text-indigo-600 dark:text-indigo-300',
    glow: 'dark:hover:shadow-indigo-500/10',
    rgb: '99 102 241',
    rgb2: '167 139 250',
  },
  teal: {
    disc: 'bg-teal-100 border-teal-200 text-teal-600 dark:bg-teal-500/10 dark:border-teal-400/30 dark:text-teal-300',
    bar: 'bg-gradient-to-r from-teal-500 to-cyan-400',
    accent: 'text-teal-600 dark:text-teal-300',
    glow: 'dark:hover:shadow-teal-500/10',
    rgb: '20 184 166',
    rgb2: '34 211 238',
  },
  // calories consumed, on target
  success: {
    disc: 'bg-emerald-100 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-300',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-300',
    accent: 'text-emerald-600 dark:text-emerald-300',
    glow: 'dark:hover:shadow-emerald-500/10',
    rgb: '16 185 129',
    rgb2: '94 234 212',
  },
  // calories consumed, over target + buffer
  warn: {
    disc: 'bg-amber-100 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-400/30 dark:text-amber-300',
    bar: 'bg-gradient-to-r from-amber-500 to-rose-500',
    accent: 'text-amber-600 dark:text-amber-300',
    glow: 'dark:hover:shadow-amber-500/10',
    rgb: '245 158 11',
    rgb2: '244 63 94',
  },
};

const BADGES = {
  reached: { Icon: CheckCircle2, text: 'Goal reached' },
  exceeded: { Icon: Trophy, text: null }, // text supplied per tile ("+1,240 over")
  onTarget: { Icon: CheckCircle2, text: 'On target' },
  over: { Icon: AlertTriangle, text: null },
};

function MetricCard({
  theme,
  Icon,
  FooterIcon,
  title,
  value,
  sub,
  pct = 0,
  showBar = true,
  footerLabel,
  footerValue,
  loading = false,
  href = '/activity',
  footerExtra = null,
  status = 'progress', // 'progress' | 'reached' | 'exceeded' | 'onTarget' | 'over'
  badgeText = null,
  info = null, // optional tooltip explaining the numbers
}) {
  const t = THEMES[theme];
  const celebrate = status === 'reached' || status === 'exceeded' || status === 'onTarget';
  const badge = BADGES[status];
  const stateClass =
    status === 'exceeded' ? fx.exceeded : status === 'over' ? `${fx.over} ${fx.nudge}` : celebrate ? fx.reached : '';
  const barFx = status === 'exceeded' ? fx.barShimmer : celebrate ? fx.barShine : '';

  return (
    <div
      title={info || undefined}
      style={{ '--accent': t.rgb, '--accent2': t.rgb2 }}
      className={`group relative isolate flex h-full min-h-[190px] flex-col rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-lg dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] ${t.glow} ${stateClass}`}
    >
      {/* Liquid fill behind the content, as high as the progress */}
      {showBar && <FluidFill pct={pct} rgb={t.rgb} direction="up" strength={status === 'progress' ? 1 : 1.35} />}

      {status === 'exceeded' && (
        <span className={fx.sparkles} aria-hidden="true">
          <span>✦</span>
          <span>✦</span>
          <span>✦</span>
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${t.disc}`}>
            <Icon size={20} />
          </div>
          <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {loading && <RefreshCw size={12} className="animate-spin text-slate-400" />}
          <Link
            href={href}
            aria-label={`Open ${title} in Activity`}
            title="Open Activity"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronRight size={20} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <p
          className={`font-numeric text-[1.7rem] font-bold leading-none tracking-tight ${
            status === 'progress' ? 'text-slate-900 dark:text-white' : t.accent
          }`}
        >
          {value}
        </p>
        {badge && (badge.text || badgeText) && (
          <span
            key={status}
            className={`${fx.badge} inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.accent}`}
            style={{ borderColor: `rgb(${t.rgb} / 0.4)`, background: `rgb(${t.rgb} / 0.1)` }}
            role="status"
          >
            <badge.Icon size={11} />
            {badgeText || badge.text}
          </span>
        )}
      </div>
      <p className="font-numeric mt-1.5 min-h-[1.25rem] text-sm text-slate-500 dark:text-sky-200/60">{sub}</p>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
        {showBar && (
          <div
            className={`h-full rounded-full transition-all duration-700 ${t.bar} ${barFx}`}
            style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
          />
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
        <span className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-slate-400">
          <FooterIcon size={16} className={`shrink-0 ${t.accent}`} />
          <span className="truncate">{footerLabel}</span>
        </span>
        {footerExtra ?? <span className={`font-numeric shrink-0 text-sm font-bold ${t.accent}`}>{footerValue}</span>}
      </div>
    </div>
  );
}

function SetGoalLink() {
  return (
    <Link href="/settings" className="shrink-0 text-xs font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">
      Set a daily goal
    </Link>
  );
}

const pctOf = (v, goal) => (Number(goal) > 0 ? Math.min(Math.round((Number(v) / Number(goal)) * 100), 100) : 0);

const fmt = (n, d = 0) =>
  d ? Number(n).toFixed(d) : Math.round(Number(n)).toLocaleString('en-IN');

export function StepsWidget({ steps = 0, targetSteps = null, loading = false }) {
  const hasGoal = Number(targetSteps) > 0;
  const status = activityStatus(steps, targetSteps);
  return (
    <MetricCard
      theme="sky"
      Icon={Footprints}
      FooterIcon={Target}
      title="Step Count"
      value={fmt(steps)}
      sub={hasGoal ? `/ ${fmt(targetSteps)}` : 'steps today'}
      pct={pctOf(steps, targetSteps)}
      showBar={hasGoal}
      footerLabel="Steps Target"
      footerValue={hasGoal ? fmt(targetSteps) : null}
      footerExtra={hasGoal ? null : <SetGoalLink />}
      loading={loading}
      status={status}
      badgeText={status === 'exceeded' ? `+${fmt(steps - targetSteps)} over` : null}
    />
  );
}

export function DistanceWidget({ distanceKm = 0, targetKm = null, loading = false }) {
  const hasGoal = Number(targetKm) > 0;
  const status = activityStatus(distanceKm, targetKm);
  return (
    <MetricCard
      theme="emerald"
      Icon={Navigation}
      FooterIcon={MapPin}
      title="Distance Count"
      value={fmt(Number(distanceKm) || 0, 1)}
      sub={hasGoal ? `/ ${fmt(targetKm, 1)} km` : 'km today'}
      pct={pctOf(distanceKm, targetKm)}
      showBar={hasGoal}
      footerLabel="Distance Target"
      footerValue={hasGoal ? `${fmt(targetKm, 1)} km` : null}
      footerExtra={hasGoal ? null : <SetGoalLink />}
      loading={loading}
      status={status}
      badgeText={status === 'exceeded' ? `+${fmt(distanceKm - targetKm, 1)} km over` : null}
    />
  );
}

/**
 * Energy burned. The big number is TOTAL calories (resting + activity), the
 * same figure Google's app headlines. The burn goal (e.g. 400 kcal) is an
 * ACTIVE-calorie goal, so the bar, the goal states and the footer track
 * active calories.
 */
export function CaloriesBurnedWidget({ caloriesBurned = 0, activeCalories = 0, targetBurn = null, loading = false }) {
  const total = Math.max(0, Math.round(Number(caloriesBurned) || 0));
  const active = Math.max(0, Math.round(Number(activeCalories) || 0));
  const hasGoal = Number(targetBurn) > 0;
  const status = activityStatus(active, targetBurn);
  return (
    <MetricCard
      theme="violet"
      Icon={Flame}
      FooterIcon={Flame}
      title="Energy Burned"
      value={fmt(total)}
      sub="kcal burned today"
      pct={pctOf(active, targetBurn)}
      showBar={hasGoal}
      footerLabel={hasGoal ? 'Active vs goal' : `${fmt(active)} kcal active`}
      footerValue={hasGoal ? `${fmt(active)} / ${fmt(targetBurn)} kcal` : null}
      footerExtra={hasGoal ? null : <SetGoalLink />}
      info={`Total burned (${fmt(total)} kcal) = resting metabolism + activity, the same figure Google's app shows. Active (${fmt(active)} kcal) = calories from movement only; your daily burn goal and the fill track this.`}
      loading={loading}
      status={status}
      badgeText={status === 'exceeded' ? `+${fmt(active - targetBurn)} kcal` : null}
    />
  );
}

export function RemainingGoalWidget({ consumedCalories = 0, targetCalories = 0, bufferKcal = CALORIE_BUFFER_KCAL }) {
  const target = Math.max(0, Math.round(Number(targetCalories) || 0));
  const eaten = Math.max(0, Math.round(Number(consumedCalories) || 0));
  const left = Math.max(0, target - eaten);
  const overBy = eaten - target;

  let status = 'progress';
  if (target > 0 && eaten >= target - bufferKcal) status = overBy > bufferKcal ? 'over' : 'onTarget';

  const footerLabel = status === 'over' ? 'Over target' : status === 'onTarget' ? (overBy > 0 ? 'Just over' : 'Remaining') : 'Remaining';
  const footerValue =
    status === 'over' || (status === 'onTarget' && overBy > 0) ? `+${fmt(overBy)} kcal` : `${fmt(left)} kcal`;

  return (
    <MetricCard
      theme={status === 'over' ? 'warn' : status === 'onTarget' ? 'success' : 'pink'}
      Icon={status === 'over' ? AlertTriangle : Target}
      FooterIcon={Target}
      title="Calories Consumed"
      value={fmt(eaten)}
      sub={target > 0 ? `/ ${fmt(target)} kcal` : 'kcal'}
      pct={target > 0 ? Math.min(Math.round((eaten / target) * 100), 100) : 0}
      showBar
      footerLabel={footerLabel}
      footerValue={footerValue}
      status={status}
      badgeText={status === 'over' ? `Over by ${fmt(overBy)}` : null}
    />
  );
}


/* ------------------------------------------------------------------ */
/* Optional tiles (data from /api/google-health/tiles)                 */
/* ------------------------------------------------------------------ */

const shortDay = (dateStr, todayStr) => {
  if (!dateStr) return '';
  if (dateStr === todayStr) return 'today';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Card frame for tiles without a goal bar. `result` = { data } | { needsPermission } | { error }. */
function InfoCard({ theme, Icon, iconClass = '', title, loading, result, permissionHref, permissionText, emptyText, styleVars, children }) {
  const t = THEMES[theme];
  let body = children;
  if (result?.needsPermission) {
    body = (
      <div className="mt-4 flex flex-1 flex-col justify-between gap-3">
        <p className="text-sm leading-snug text-slate-500 dark:text-sky-200/60">{permissionText}</p>
        <a
          href={permissionHref}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Allow access
        </a>
      </div>
    );
  } else if (result?.error) {
    body = <p className="mt-4 text-sm text-slate-500 dark:text-sky-200/60">Couldn&apos;t load this from Google Health. It will retry next time.</p>;
  } else if (!loading && result && emptyText) {
    body = <p className="mt-4 text-sm leading-snug text-slate-500 dark:text-sky-200/60">{emptyText}</p>;
  }
  return (
    <div
      style={{ '--accent': t.rgb, ...styleVars }}
      className={`group relative isolate flex h-full min-h-[190px] flex-col rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-lg dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] ${t.glow}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${t.disc}`}>
            <Icon size={20} className={iconClass} />
          </div>
          <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {loading && <RefreshCw size={12} className="animate-spin text-slate-400" />}
          <Link
            href="/activity"
            aria-label="Open Activity"
            title="Open Activity"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronRight size={20} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
      {body}
    </div>
  );
}

/**
 * Heart rate: resting heart rate (headline, beating icon + ECG at that
 * rate), today's low and high, and irregular-rhythm notifications from the
 * last 7 days as a warning that expands on hover (or tap) into detail.
 */
export function HeartWidget({ result, loading, today, connectHref }) {
  const d = result?.data;
  const bpm = d?.restingBpm ?? null;
  const irr = d?.irregular;
  const hasIrr = irr && !irr.needsPermission && irr.count > 0;
  const beat = bpm ? `${(60 / bpm).toFixed(3)}s` : '1s';
  const empty = d && !bpm && d.todayMax == null ? 'No heart data in the last 7 days. Wear your watch or tracker, including overnight.' : null;

  return (
    <InfoCard
      theme="rose"
      Icon={HeartPulse}
      iconClass={bpm ? fx.heartbeat : ''}
      title="Heart Rate"
      loading={loading}
      result={result}
      permissionHref={connectHref()}
      permissionText="Reconnect Google Health to allow reading your heart rate."
      emptyText={empty}
      styleVars={{ '--beat': beat }}
    >
      {bpm && <span aria-hidden="true" className={fx.ecg} />}
      <p className="font-numeric mt-4 text-[1.7rem] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
        {bpm ?? '–'}
        <span className="ml-1 text-sm font-semibold text-slate-500 dark:text-sky-200/60">bpm</span>
      </p>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-sky-200/60">
        Resting{d?.restingDate ? ` · ${shortDay(d.restingDate, today)}` : ''}
      </p>

      <div className="mt-auto pt-3">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400" title={d?.todayAvg ? `Average today ${d.todayAvg} bpm` : undefined}>
          <span className="flex items-center justify-between gap-1 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-white/5">
            Low <b className="font-numeric text-sm text-sky-600 dark:text-sky-300">{d?.todayMin ?? '–'}</b>
          </span>
          <span className="flex items-center justify-between gap-1 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-white/5">
            High <b className="font-numeric text-sm text-rose-600 dark:text-rose-300">{d?.todayMax ?? '–'}</b>
          </span>
        </div>

        {/* Irregular rhythm: a warning that expands into detail on hover / focus / tap */}
        {hasIrr ? (
          <details className={`${fx.irregular} group/irr mt-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200`}>
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold">
              <AlertTriangle size={13} className="shrink-0" /> Irregular rhythm
              <span className="ml-auto font-normal opacity-75">{shortDay(irr.latestDate, today)}</span>
            </summary>
            <p className="px-2 pb-2 text-[11px] leading-snug">
              Your device sent {irr.count > 1 ? `${irr.count} irregular rhythm notifications` : 'an irregular rhythm notification'} in the last 7 days
              (signs that can suggest atrial fibrillation). This is not a diagnosis. If you haven&apos;t already, please talk to a doctor.
            </p>
          </details>
        ) : irr?.needsPermission ? (
          <a href={connectHref('irn')} className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">
            <ShieldCheck size={12} /> Turn on irregular rhythm alerts
          </a>
        ) : irr ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={12} /> No irregular rhythm alerts (7 days)
          </p>
        ) : null}
      </div>
    </InfoCard>
  );
}

export function OxygenFitnessWidget({ result, loading, today, connectHref }) {
  const d = result?.data;
  const spo2 = d?.spo2?.percent ?? null;
  const vo2 = d?.vo2Max?.value ?? null;
  const empty = d && !spo2 && !vo2 ? 'No SpO₂ or VO₂ max in the last 7 days. SpO₂ is measured while you sleep with your watch on.' : null;
  return (
    <InfoCard theme="teal" Icon={Droplets} title="SpO₂ & VO₂ max" loading={loading} result={result}
      permissionHref={connectHref()} permissionText="Reconnect Google Health to allow reading SpO₂ and VO₂ max." emptyText={empty}>
      <p className="font-numeric mt-4 text-[1.7rem] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
        {spo2 ?? '–'}
        <span className="ml-1 text-sm font-semibold text-slate-500 dark:text-sky-200/60">% SpO₂</span>
      </p>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-sky-200/60">
        Overnight average{d?.spo2?.date ? ` · ${shortDay(d.spo2.date, today)}` : ''}
      </p>
      {spo2 && (
        <p className={`mt-0.5 text-[11px] font-semibold ${spo2 >= 95 ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
          {spo2 >= 95 ? 'Typical range (95-100%)' : 'Below the typical 95%'}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-slate-500 dark:text-slate-400" title="VO₂ max (cardio fitness score), ml/kg/min">
        <span className="flex items-center gap-1.5">
          <Wind size={15} className="text-teal-600 dark:text-teal-300" /> VO₂ max
        </span>
        <span className="font-numeric text-sm font-bold text-teal-600 dark:text-teal-300">
          {vo2 ?? '–'}
          {vo2 && d?.vo2Max?.date ? <span className="ml-1 text-[10px] font-normal text-slate-400">{shortDay(d.vo2Max.date, today)}</span> : null}
        </span>
      </div>
    </InfoCard>
  );
}

/** Floors climbed, with a goal (10 floors is the common wearable default). */
export const FLOORS_GOAL = 10;
export function FloorsWidget({ result, loading, connectHref }) {
  if (!result?.data) {
    return <InfoCard theme="amber" Icon={Building2} title="Floors Climbed" loading={loading} result={result}
      permissionHref={connectHref()} permissionText="Reconnect Google Health to allow reading floors." />;
  }
  const floors = result.data.floors ?? 0;
  const status = activityStatus(floors, FLOORS_GOAL);
  return (
    <MetricCard
      theme="amber"
      Icon={Building2}
      FooterIcon={Target}
      title="Floors Climbed"
      value={fmt(floors)}
      sub={`/ ${FLOORS_GOAL} floors`}
      pct={pctOf(floors, FLOORS_GOAL)}
      showBar
      footerLabel="Daily target"
      footerValue={`${FLOORS_GOAL} floors`}
      loading={loading}
      status={status}
      badgeText={status === 'exceeded' ? `+${fmt(floors - FLOORS_GOAL)} floors` : null}
    />
  );
}

/** Sleep: last night's main sleep. Adults are advised 7-9 hours. */
const SLEEP_TARGET_MIN = 8 * 60;
const STAGE_STYLE = [
  ['DEEP', 'Deep', 'bg-indigo-600'],
  ['REM', 'REM', 'bg-violet-400'],
  ['LIGHT', 'Light', 'bg-sky-400'],
  ['ASLEEP', 'Asleep', 'bg-sky-400'],
  ['RESTLESS', 'Restless', 'bg-amber-400'],
  ['AWAKE', 'Awake', 'bg-rose-400'],
];
const hm = (min) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`;

export function SleepWidget({ result, loading, connectHref }) {
  const d = result?.data;
  const mins = d?.minutesAsleep ?? null;
  if (!d || mins == null) {
    return <InfoCard theme="indigo" Icon={Moon} title="Sleep" loading={loading} result={result}
      permissionHref={connectHref('sleep')} permissionText="Allow WAY to read your sleep from Google Health."
      emptyText={d ? 'No sleep recorded for last night. Wear your watch or tracker to bed.' : null} />;
  }
  const inRange = mins >= 7 * 60 && mins <= 9 * 60;
  const stages = STAGE_STYLE.filter(([k]) => d.stages?.[k] > 0);
  const total = stages.reduce((a, [k]) => a + d.stages[k], 0) || 1;
  return (
    <MetricCard
      theme="indigo"
      Icon={Moon}
      FooterIcon={Moon}
      title="Sleep"
      value={hm(mins)}
      sub={d.bedtime && d.wake ? `asleep · ${d.bedtime} → ${d.wake}` : 'asleep last night'}
      pct={pctOf(mins, SLEEP_TARGET_MIN)}
      showBar
      footerLabel="Stages"
      footerExtra={
        stages.length ? (
          <span className="flex h-2.5 w-28 shrink-0 overflow-hidden rounded-full" title={stages.map(([k, l]) => `${l} ${hm(d.stages[k])}`).join(' · ')}>
            {stages.map(([k, , c]) => (
              <span key={k} className={c} style={{ width: `${(d.stages[k] / total) * 100}%` }} />
            ))}
          </span>
        ) : (
          <span className="text-slate-400">–</span>
        )
      }
      loading={loading}
      status={inRange ? 'reached' : 'progress'}
      badgeText={inRange ? '7-9 h range' : null}
    />
  );
}

export function GlucoseWidget({ result, loading, connectHref }) {
  const d = result?.data;
  return (
    <InfoCard theme="teal" Icon={Pulse} title="Glucose" loading={loading} result={result}
      permissionHref={connectHref()} permissionText="Reconnect Google Health to allow reading glucose."
      emptyText={d && d.latest == null ? 'No glucose readings for this day. Readings logged in Google Health or from a connected meter show here.' : null}>
      <p className="font-numeric mt-4 text-[1.7rem] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
        {d?.latest ?? '–'}
        <span className="ml-1 text-sm font-semibold text-slate-500 dark:text-sky-200/60">mg/dL</span>
      </p>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-sky-200/60">
        Latest reading{d?.count ? ` · ${d.count} today` : ''}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-slate-500 dark:text-slate-400">
        <span>Day range</span>
        <span className="font-numeric text-sm font-bold text-teal-600 dark:text-teal-300">
          {d?.min != null ? `${d.min}-${d.max} mg/dL` : '–'}
        </span>
      </div>
    </InfoCard>
  );
}
