'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, CheckCircle2, Circle, Info } from 'lucide-react';
import DotMatrix from './DotMatrix';
import fx from '@/components/home/HealthTiles.module.css';

/**
 * Healthspan panel (home tile `compact`, full panel on the Activity page).
 *
 *   Main dial   Body Age (last 30 days, recalculated weekly) in dot-matrix
 *               digits inside a ring of ticks centred on your real age;
 *               HRV and resting HR in the corners, recovery status below.
 *   Cards       Readiness (today), Pace of Aging, Sleep consistency,
 *               Recovery (7-day readiness).
 *
 * Body Age: lib/bodyAge.js. Readiness / Recovery / Sleep consistency:
 * lib/readiness.js (a proxy for Google's readiness, which the API doesn't
 * expose). One request: /api/body-age.
 */

let cache = null;
function useHealthspan() {
  const [state, setState] = useState(cache || { loading: true });
  useEffect(() => {
    if (cache) return undefined;
    let alive = true;
    fetch('/api/body-age')
      .then((r) => r.json())
      .then((d) => {
        cache = { loading: false, ...d };
        if (alive) setState(cache);
      })
      .catch(() => alive && setState({ loading: false, error: true }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

const YELLOW = '#facc15';
const fmt1 = (n) => (n == null ? '--' : Number(n).toFixed(1));

/* ------------------------------------------------------------------ */
/* Tick ring: top = your real age; clockwise older, anticlockwise younger */
/* ------------------------------------------------------------------ */
const SPAN = 10; // years shown each side (half the ring)
const TICKS = 72;

function TickRing({ age, bodyAge, size = 300 }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const c = 150;
  const d = bodyAge == null ? 0 : Math.max(-SPAN, Math.min(SPAN, bodyAge - age));
  const markerDeg = (d / SPAN) * 180; // -180..180, 0 = top
  const tickDeg = 360 / TICKS;
  const lit = (deg) => {
    // ticks between the top (real age) and the marker light up
    const t = deg > 180 ? deg - 360 : deg;
    return bodyAge != null && on && (markerDeg >= 0 ? t >= 0 && t <= markerDeg : t <= 0 && t >= markerDeg);
  };
  return (
    <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: size }} className="block" aria-hidden="true">
      {Array.from({ length: TICKS }, (_, i) => {
        const deg = i * tickDeg;
        const major = i % 6 === 0;
        const len = major ? 16 : 9;
        const rad = ((deg - 90) * Math.PI) / 180;
        const r1 = 134;
        const r2 = r1 - len;
        const isLit = lit(deg);
        return (
          <line
            key={i}
            x1={c + r1 * Math.cos(rad)}
            y1={c + r1 * Math.sin(rad)}
            x2={c + r2 * Math.cos(rad)}
            y2={c + r2 * Math.sin(rad)}
            stroke={isLit ? (d <= 0 ? '#6ee7b7' : '#fcd34d') : '#ffffff'}
            strokeOpacity={isLit ? 0.95 : major ? 0.45 : 0.18}
            strokeWidth={major ? 2 : 1.4}
            strokeLinecap="round"
            style={{ transition: `stroke-opacity 400ms ${Math.min(i, TICKS - i) * 12}ms` }}
          />
        );
      })}
      {/* real age: a small notch at the top */}
      <line x1={c} y1={c - 140} x2={c} y2={c - 112} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      {/* Body Age marker (yellow), sweeps from the top */}
      {bodyAge != null && (
        <g style={{ transform: `rotate(${on ? markerDeg : 0}deg)`, transformOrigin: `${c}px ${c}px`, transition: 'transform 1.4s cubic-bezier(0.22, 1.2, 0.36, 1)' }}>
          <line x1={c} y1={c - 140} x2={c} y2={c - 108} stroke={YELLOW} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Small cards                                                         */
/* ------------------------------------------------------------------ */
function CardShell({ title, className = '', children }) {
  return (
    <div className={`relative flex min-h-[150px] min-w-0 flex-col overflow-hidden rounded-[1.75rem] p-3.5 sm:p-4 ${className}`}>
      <p className="text-sm font-semibold text-white/90">{title}</p>
      {children}
    </div>
  );
}

function ReadinessCard({ r }) {
  const score = r?.score ?? null;
  return (
    <CardShell title="Readiness" className="bg-gradient-to-b from-[#2a2a2e] to-[#18181b] ring-1 ring-white/10">
      <div className="mt-3 flex min-w-0 items-center justify-center gap-2 sm:gap-3">
        <span className="font-numeric shrink-0 text-[10px] text-white/35" title="Yesterday">{r?.yesterday ?? ''}</span>
        <DotMatrix text={score == null ? '--' : String(score)} dot={5} gap={2} label={`Readiness ${score ?? 'not available'}`} />
        <span className="font-numeric shrink-0 text-[10px] text-white/35">{r?.band?.label ?? ''}</span>
      </div>
      {/* slider: 0 - 100 */}
      <div className="relative mt-auto pt-4">
        <div className="relative h-px w-full border-t border-dotted border-white/30">
          <span className="absolute left-0 top-[-1px] h-0.5 rounded-full" style={{ width: `${score ?? 0}%`, background: YELLOW }} />
          {score != null && (
            <span className="absolute -top-[7px] h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent" style={{ left: `${score}%`, borderTopColor: YELLOW }} />
          )}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-white/40">
          <span>Rest</span>
          <span>Ready</span>
        </div>
      </div>
      {!r && <p className="mt-1 text-[10px] text-white/40">Needs a week of HRV and resting heart rate.</p>}
    </CardShell>
  );
}

function PaceCard({ pace }) {
  // ring: -1 .. 3, yellow arc to the pace; 1.0 marked
  const p = pace == null ? null : Math.max(-1, Math.min(3, pace));
  const frac = p == null ? 0 : (p + 1) / 4;
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <CardShell title="Pace of Aging" className="bg-gradient-to-br from-[#c084fc] via-[#9333ea] to-[#6b21a8] shadow-lg shadow-purple-900/30">
      <div className="mt-2 flex flex-1 items-center justify-between gap-2">
        <p className="text-[11px] leading-snug text-white/80">
          {p == null ? 'Unlocks with Body Age' : p <= 0 ? 'Getting younger' : p < 0.9 ? 'Slower than time' : p <= 1.1 ? 'In step with time' : 'Faster than time'}
        </p>
        <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden="true">
          <circle cx="32" cy="32" r={R} fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="1.5 2.5" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={YELLOW}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${frac * C} ${C}`}
            transform="rotate(-90 32 32)"
            style={{ transition: 'stroke-dasharray 1.2s ease-out' }}
          />
          <text x="32" y="35.5" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">
            {p == null ? '--' : `${p.toFixed(1)}×`}
          </text>
        </svg>
      </div>
    </CardShell>
  );
}

function SleepCard({ pct }) {
  const onTrack = pct != null && pct >= 70;
  return (
    <CardShell title="Sleep consistency" className="bg-gradient-to-br from-[#312e81] via-[#1e1b4b] to-[#0f0a2e] ring-1 ring-indigo-300/20">
      <div className="mt-3 flex flex-1 items-end justify-between gap-2">
        <DotMatrix text={pct == null ? '--' : `${pct}%`} dot={5} gap={1.8} className="min-w-0" label={`Sleep consistency ${pct ?? 'not available'}`} />
        {/* toggle: on when 70%+ (the target) */}
        <span
          className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition sm:h-7 sm:w-12 ${onTrack ? 'bg-emerald-400/30' : 'bg-white/10'}`}
          role="img"
          aria-label={onTrack ? 'On track' : 'Irregular'}
        >
          <span className={`absolute h-4 w-4 rounded-full bg-white shadow transition-all sm:h-5 sm:w-5 ${onTrack ? 'left-5 sm:left-6' : 'left-1'}`} />
        </span>
      </div>
      <p className="mt-2 text-[10px] text-white/50">{pct == null ? 'Needs a week of sleep' : onTrack ? 'Regular bed and wake times' : 'Target 70%+: steadier sleep times'}</p>
    </CardShell>
  );
}

function RecoveryCard({ rec }) {
  const s = rec?.score ?? null;
  return (
    <CardShell title="Recovery" className="bg-gradient-to-br from-[#134e4a] via-[#0f2f2d] to-[#0a1514] ring-1 ring-teal-300/15">
      <div className="mt-3 flex items-end justify-between gap-2">
        <DotMatrix text={s == null ? '--' : String(s)} dot={5} gap={1.8} className="min-w-0" label={`Recovery ${s ?? 'not available'}`} />
        {rec?.change != null && (
          <span className={`font-numeric text-[11px] font-bold ${rec.change >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
            {rec.change >= 0 ? '+' : ''}
            {rec.change} vs last wk
          </span>
        )}
      </div>
      {/* 7 days of readiness */}
      <div className="mt-auto flex h-8 items-end gap-1 pt-3" aria-hidden="true">
        {(rec?.daily ?? Array.from({ length: 7 }, () => ({ score: null }))).map((x, i) => (
          <span key={x.date ?? i} className="flex-1 rounded-sm" style={{ height: `${x.score == null ? 8 : Math.max(8, x.score)}%`, background: x.score == null ? 'rgba(255,255,255,.08)' : x.score >= 65 ? '#5eead4' : x.score >= 30 ? '#fcd34d' : '#fb7185' }} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-white/50">{rec ? `${rec.band.label} · 7-day readiness` : 'Needs a few days of readiness'}</p>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Locked checklist                                                    */
/* ------------------------------------------------------------------ */
const ACTIONS = {
  'allow-sleep': { href: '/api/google-health/connect?returnTo=%2Fhome&extra=sleep', text: 'Allow sleep access' },
  measurements: { href: '/body', text: 'Add measurements' },
  profile: { href: '/settings', text: 'Complete profile' },
};

function Checklist({ reqs }) {
  return (
    <ul className="space-y-1.5">
      {reqs.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-xs text-white/70">
          {r.met ? <CheckCircle2 size={14} className="shrink-0 text-emerald-300" /> : <Circle size={14} className="shrink-0 text-white/25" />}
          <span className="min-w-0 flex-1">{r.label}</span>
          {!r.met && r.need > 1 && (
            <span className="font-numeric shrink-0 text-[11px] text-white/40">
              {r.have}/{r.need}
            </span>
          )}
          {!r.met && r.action && ACTIONS[r.action] && (
            <a href={ACTIONS[r.action].href} className="shrink-0 text-[11px] font-semibold text-yellow-300 underline underline-offset-2">
              {ACTIONS[r.action].text}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
export default function BodyAgeCard({ compact = false }) {
  const data = useHealthspan();
  const [open, setOpen] = useState(false);
  const r = data.eligible ? data.result : null;
  const v = data.vitals || {};
  const reqs = data.requirements || [];
  const met = reqs.filter((x) => x.met).length;
  const status = v.recovery?.band?.key === 'high' ? 'Well recovered' : v.recovery?.band?.key === 'low' ? 'Needs rest' : v.recovery ? 'Recovering' : '';
  const trendFirst = r?.trend?.find((t) => t.bodyAge != null)?.bodyAge ?? null;

  const panelBg =
    'relative isolate overflow-hidden rounded-[2rem] bg-[#09090b] text-white ring-1 ring-white/10 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:14px_14px]';

  /* ---- the main dial (shared by tile and panel) ---- */
  const dial = (big) => (
    <div className="relative mx-auto w-full" style={{ maxWidth: big ? 380 : 230 }}>
      <TickRing age={r?.chronologicalAge ?? data.age ?? 30} bodyAge={r ? r.bodyAge : null} size={big ? 380 : 230} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3">
          {big && <span className="font-numeric text-[11px] text-white/35" title="4 weeks ago">{trendFirst != null ? fmt1(trendFirst) : ''}</span>}
          <DotMatrix text={r ? fmt1(r.bodyAge) : '--'} dot={big ? 7 : 4.5} gap={big ? 2.5 : 1.8} label={r ? `Body Age ${fmt1(r.bodyAge)}` : 'Body Age locked'} />
          {big && <span className="font-numeric text-[11px] text-white/35" title="Your age">{r ? r.chronologicalAge : ''}</span>}
        </div>
        <p className="mt-2 text-center text-[11px] text-white/60 sm:text-xs">
          {r
            ? `${r.difference < 0 ? `${Math.abs(r.difference).toFixed(1)} yrs younger` : r.difference > 0 ? `${r.difference.toFixed(1)} yrs older` : 'Right at your age'} · ±${r.range}`
            : data.loading
              ? 'Calculating…'
              : `Body Age · ${met}/${reqs.length || 8} to unlock`}
        </p>
      </div>
    </div>
  );

  /* ---- compact home tile ---- */
  if (compact) {
    return (
      <div className={`${panelBg} flex h-full min-h-[190px] flex-col p-4`}>
        <div className="flex items-center justify-between text-[10px] text-white/50">
          <span>{v.hrv ? `HRV ${v.hrv.value} ms` : 'Healthspan'}</span>
          <Link href="/activity#body-age" aria-label="Open Healthspan" className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">
            <ArrowRight size={16} />
          </Link>
        </div>
        {dial(false)}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px]">
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">
            Readiness <b className="font-numeric">{v.readiness?.score ?? '--'}</b>
          </span>
          <span className="rounded-full px-2 py-0.5 font-semibold text-black" style={{ background: YELLOW }}>
            Pace {r ? `${r.pace.toFixed(1)}×` : '--'}
          </span>
        </div>
      </div>
    );
  }

  /* ---- full panel (Activity page) ---- */
  return (
    <section id="body-age" aria-label="Healthspan" className={`${panelBg} p-4 sm:p-6`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
        {/* main dial with corner readouts */}
        <div className="relative px-1 pb-6 pt-6">
          <span className="absolute left-1 top-0 text-[11px] text-white/55">{v.hrv ? <>HRV <b className="text-white">{v.hrv.value}</b> ms</> : 'Healthspan'}</span>
          <span className="absolute right-1 top-0 text-[11px] text-white/55">{v.rhr ? <>RHR <b className="text-white">{v.rhr.value}</b> bpm</> : ''}</span>
          {dial(true)}
          <span className="absolute bottom-0 left-1 text-[11px] text-white/70">{status}</span>
          <span className="absolute bottom-0 right-1 text-[11px] text-white/35">30 days · weekly</span>
        </div>

        {/* cards: 2 x 2 */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <ReadinessCard r={v.readiness} />
          <PaceCard pace={r?.pace ?? null} />
          <SleepCard pct={v.sleepConsistency ?? null} />
          <RecoveryCard rec={v.recovery} />
        </div>
      </div>

      {/* unlock checklist, or the breakdown */}
      {!data.loading && !data.eligible && reqs.length > 0 && (
        <div className={`mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 ${fx.bodyAgeLocked}`}>
          <p className="mb-2 text-xs font-semibold text-white/80">
            Body Age unlocks when all {reqs.length} are met · {met}/{reqs.length}
          </p>
          <Checklist reqs={reqs} />
          <p className="mt-2 text-[11px] text-white/40">Readiness, sleep consistency and recovery above work already.</p>
        </div>
      )}

      {r && (
        <div className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-xs font-semibold text-white/85">
            What&apos;s adding and taking away years
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <div className="mt-3 space-y-1.5">
            {r.groups.map((g) => (
              <div key={g.key} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-2 text-xs">
                <span className="truncate text-white/65">{g.label}</span>
                <span className="relative h-1.5 rounded-full bg-white/10">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
                  <span
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      background: g.years <= 0 ? '#6ee7b7' : '#fcd34d',
                      ...(g.years <= 0 ? { right: '50%', width: `${Math.min(50, (Math.abs(g.years) / 4) * 50)}%` } : { left: '50%', width: `${Math.min(50, (g.years / 4) * 50)}%` }),
                    }}
                  />
                </span>
                <span className={`font-numeric text-right font-semibold ${g.years <= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {g.years <= 0 ? '−' : '+'}
                  {Math.abs(g.years).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
          {open && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="py-1 pr-2 font-semibold">Metric</th>
                    <th className="py-1 pr-2 font-semibold">30 days</th>
                    <th className="py-1 pr-2 font-semibold">This week</th>
                    <th className="py-1 pr-2 font-semibold">Target</th>
                    <th className="py-1 text-right font-semibold">Years</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {r.contributors.map((c) => (
                    <tr key={c.key}>
                      <td className="py-1.5 pr-2 text-white/80">{c.label}</td>
                      <td className="font-numeric py-1.5 pr-2 text-white/70">
                        {Number(c.value).toFixed(c.decimals)} <span className="text-white/40">{c.unit}</span>
                      </td>
                      <td className="font-numeric py-1.5 pr-2 text-white/50">{c.recent != null ? Number(c.recent).toFixed(c.decimals) : '–'}</td>
                      <td className="font-numeric py-1.5 pr-2 text-white/50">{c.target}</td>
                      <td className={`font-numeric py-1.5 text-right font-semibold ${c.years <= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {c.years <= 0 ? '−' : '+'}
                        {Math.abs(c.years).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 flex gap-1.5 text-[11px] leading-snug text-white/45">
                <Info size={12} className="mt-0.5 shrink-0" />
                Body Age: each metric&apos;s risk versus a healthy target (published studies), converted to years with the Gompertz law (about 10% more
                risk ≈ 1 year), overlap discounted; last 30 days, recalculated weekly. Readiness is our estimate from HRV, resting heart rate and sleep
                against your own baseline (Google&apos;s readiness isn&apos;t available to apps); it isn&apos;t used in Body Age. Lifestyle estimates, not
                medical tests.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
