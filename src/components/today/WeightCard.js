'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Scale, PersonStanding, ChevronDown } from 'lucide-react';
import { weightProgress } from '@/lib/goalState';
import { buildBodyModel } from '@/lib/bodyPreview';
import { Card, Eyebrow, Btn, polyPoints, f1 } from '@/components/way/ui';

// three.js is downloaded the first time the body view opens.
const WeightBodyCanvas = dynamic(() => import('@/components/body/WeightBodyCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[11px] text-way-dim">Loading 3D bodies…</div>
  ),
});

const shortDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Weight: today's number, progress to the goal, and "Body comparison", the
 * split 3D render (goal body from the top down to your progress, current
 * body below). Log weight is the main action, at the top.
 */
export default function WeightCard({ profile, weightLogs, selectedDate, today, currentWeight, onLog, k }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const toggle = () => {
    setEverOpened(true);
    setOpen((o) => !o);
  };

  const targetKg = profile?.dream_target_weight_kg ? Number(profile.dream_target_weight_kg) : null;
  const now = Number(currentWeight) || 0;
  const p = weightProgress({ weightLogs, currentKg: now, targetKg });
  const pct = p == null ? 0 : Math.round(p * 100);
  const start = weightLogs.length ? Number(weightLogs[weightLogs.length - 1].weight_kg) : now;
  const losing = targetKg != null && targetKg < start;
  const moved = Math.max(0, losing ? start - now : now - start);
  const left = targetKg != null ? Math.abs(now - targetKg) : 0;
  const by = profile?.dream_target_date
    ? new Date(`${String(profile.dream_target_date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const loggedOnDay = weightLogs.find((w) => w.logged_at === selectedDate);
  const nearest = useMemo(() => {
    if (!weightLogs.length) return null;
    const t = new Date(`${selectedDate}T00:00:00Z`).getTime();
    return weightLogs.reduce((best, w) => {
      const d = Math.abs(new Date(`${w.logged_at}T00:00:00Z`).getTime() - t);
      return !best || d < best.d ? { d, w } : best;
    }, null)?.w;
  }, [weightLogs, selectedDate]);
  const note = loggedOnDay
    ? selectedDate === today
      ? 'Logged today'
      : `Logged ${shortDate(selectedDate)}`
    : nearest
      ? `Nearest entry · ${shortDate(nearest.logged_at)}`
      : 'No weigh-ins yet';

  const model = useMemo(() => buildBodyModel(profile, now), [profile, now]);

  // Last 30 days up to the latest weigh-in, oldest first.
  const series = useMemo(() => {
    if (!weightLogs.length) return [];
    const latest = new Date(`${weightLogs[0].logged_at}T00:00:00Z`);
    latest.setUTCDate(latest.getUTCDate() - 29);
    const from = latest.toISOString().slice(0, 10);
    return weightLogs.filter((w) => w.logged_at >= from).map((w) => Number(w.weight_kg)).reverse();
  }, [weightLogs]);
  const points = polyPoints(series, { w: 300, h: 60, pad: 2 });

  return (
    <Card className="flex flex-col gap-3.5 p-[18px] lg:rounded-[20px] lg:p-[22px]">
      <div className="flex items-center justify-between gap-2.5 lg:items-start">
        <div className="flex flex-col gap-[3px]">
          <Eyebrow>Weight</Eyebrow>
          <span className="font-mono text-[11px] font-medium text-way-dim">{note}</span>
        </div>
        <Btn variant="primary" size="sm" onClick={onLog} className="h-9 px-3.5 lg:h-8 lg:rounded-[10px] lg:px-[13px]">
          <Scale size={13} />
          {loggedOnDay ? 'Update' : 'Log weight'}
        </Btn>
      </div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-[5px] lg:gap-1.5">
          <span className="font-brand text-[40px] leading-none lg:text-5xl">{now ? f1(now) : '—'}</span>
          <span className="font-mono text-xs font-medium text-way-dim">kg</span>
        </div>
        {targetKg != null ? (
          <span className="font-mono text-xs font-semibold text-way-protein lg:text-[13px]">→ {targetKg} kg</span>
        ) : (
          <Link href="/settings?tab=body&sub=goal" className="text-xs font-semibold text-way-protein">
            Set a goal →
          </Link>
        )}
      </div>

      {targetKg != null ? (
        <>
          <div className="relative h-1.5 rounded-full bg-way-track">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ width: `${pct * k}%`, background: 'linear-gradient(90deg,#64748b,#34d399)' }}
            />
          </div>
          <div className="flex justify-between gap-2 font-mono text-[11px] font-medium text-way-dim">
            <span>
              {f1(moved)} kg {losing ? 'lost' : 'gained'} · {f1(left)} to go
            </span>
            <span>
              {pct}%{by ? ` · by ${by}` : ''}
            </span>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-11 items-center justify-between rounded-xl border border-way-line2 px-3 py-[11px] text-[13px] font-medium text-way-ink2 transition-colors hover:bg-way-hover"
      >
        <span className="flex items-center gap-2">
          <PersonStanding size={15} className="text-way-protein" />
          Body comparison
        </span>
        <ChevronDown size={15} className="text-way-dim transition-transform duration-300" style={{ transform: `rotate(${open ? 180 : 0}deg)` }} />
      </button>

      <div className={`grid transition-[grid-template-rows] duration-[400ms] ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 pt-0.5">
            <div className="flex justify-between font-mono text-[11px] font-medium">
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-[10px] font-bold tracking-[0.12em] text-way-dim">NOW</span>
                <span className="text-way-ink2">
                  {f1(now)} kg · {model.bodyFatPct}% fat
                </span>
              </div>
              {model.targetData ? (
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="font-heading text-[10px] font-bold tracking-[0.12em] text-way-protein">GOAL</span>
                  <span className="text-emerald-300">
                    {model.targetKg} kg · {model.targetData.bodyFatPct}% fat
                  </span>
                </div>
              ) : null}
            </div>
            <div className="relative h-[300px] overflow-hidden rounded-[14px] border border-way-line bg-way-rail lg:h-[340px]">
              {everOpened ? (
                <WeightBodyCanvas
                  currentData={model.currentData}
                  targetData={model.targetData}
                  progress={p ?? 0}
                  active={open}
                  height="100%"
                  pctLabel={model.targetData ? `${pct}% there` : null}
                />
              ) : null}
            </div>
            {!model.targetData ? (
              <p className="text-center text-xs text-way-mute">Set a goal weight to see your goal body above the cut.</p>
            ) : null}
            {series.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[11px] text-way-dim">
                  <span>Last 30 days</span>
                  <span className="font-mono">
                    {f1(series[0])} → {f1(series[series.length - 1])} kg
                  </span>
                </div>
                <svg viewBox="0 0 300 60" width="100%" height="60" preserveAspectRatio="none" className="block">
                  <polyline
                    points={points}
                    style={{ fill: 'none', stroke: '#34d399', strokeWidth: 2, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' }}
                  />
                </svg>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Btn as={Link} href="/settings?tab=body&sub=goal" variant="outline" className="h-auto flex-1 rounded-[10px] py-[9px] text-xs font-medium">
                Change goal
              </Btn>
              <Btn as={Link} href="/activity" variant="outline" className="h-auto flex-1 rounded-[10px] py-[9px] text-xs font-medium">
                Full history
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
