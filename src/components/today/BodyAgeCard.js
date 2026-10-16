'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, Circle, Lock, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, Eyebrow, cx } from '@/components/way/ui';

const SPAN = 10; // years either side shown on the dial

// Rounded so server and browser render identical coordinates.
function pt(deg, r) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [Math.round((100 + r * Math.cos(a)) * 100) / 100, Math.round((100 + r * Math.sin(a)) * 100) / 100];
}

/** 60-tick dial; ticks between 0 and the marker light up (green younger, amber older). */
function Dial({ size, markerDeg, on }) {
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const deg = i * 6;
    const t = deg > 180 ? deg - 360 : deg;
    const major = i % 5 === 0;
    const lit = on && (markerDeg <= 0 ? t <= 0 && t >= markerDeg : t >= 0 && t <= markerDeg);
    const [x1, y1] = pt(deg, 94);
    const [x2, y2] = pt(deg, 94 - (major ? 13 : 7));
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeLinecap="round"
        style={{
          stroke: lit ? (markerDeg <= 0 ? '#6ee7b7' : '#fcd34d') : '#ffffff',
          strokeWidth: major ? 2.2 : 1.5,
          opacity: lit ? 1 : major ? 0.4 : 0.16,
          transition: 'opacity .4s, stroke .4s',
          transitionDelay: `${Math.min(i, 60 - i) * 14}ms`,
        }}
      />
    );
  });
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="block">
      {ticks}
      {on ? (
        <line
          x1="100"
          y1="1"
          x2="100"
          y2="26"
          strokeLinecap="round"
          style={{
            stroke: '#facc15',
            strokeWidth: 4,
            transformOrigin: '100px 100px',
            transition: 'transform 1.4s cubic-bezier(.22,1.2,.36,1)',
            transform: `rotate(${markerDeg}deg)`,
          }}
        />
      ) : null}
    </svg>
  );
}

/**
 * Body Age from Google Health (lib/bodyAge.js via /api/body-age). Today only
 * shows it once every input it needs is there; `data` is that response.
 */
export default function BodyAgeCard({ data, className = '', delay = 80 }) {
  const result = data?.result;
  const [swing, setSwing] = useState(false);
  useEffect(() => {
    if (!result) return undefined;
    const t = setTimeout(() => setSwing(true), 120);
    return () => clearTimeout(t);
  }, [result]);
  if (!result) return null;

  const diff = result.bodyAge - result.chronologicalAge;
  const younger = diff <= 0;
  const markerDeg = (Math.max(-SPAN, Math.min(SPAN, diff)) / SPAN) * 180;
  const tone = Math.abs(diff) < 0.3 ? '#cbd5e1' : younger ? '#34d399' : '#fbbf24';
  const pace =
    result.pace == null
      ? null
      : result.pace < 0.97
        ? 'Ageing slower than time'
        : result.pace > 1.05
          ? 'Ageing faster than time right now'
          : 'Ageing in step with time';
  const v = data.vitals || {};
  const stats = [
    { v: v.readiness?.score != null ? String(Math.round(v.readiness.score)) : '—', label: 'Readiness' },
    { v: result.pace != null ? `${result.pace.toFixed(2)}×` : '—', label: 'Pace' },
    { v: v.hrv?.value != null ? `${v.hrv.value}` : '—', label: 'HRV ms' },
    { v: v.sleepConsistency != null ? `${Math.round(v.sleepConsistency)}%` : '—', label: 'Sleep' },
  ];

  return (
    <Card
      rise
      delay={delay}
      className={cx('relative flex flex-col gap-4 overflow-hidden p-[18px] lg:gap-5 lg:p-7', className)}
      style={{ background: `radial-gradient(120% 70% at 50% 0%, ${tone}14, transparent 60%), #0f1420` }}
    >
      <div className="flex items-center justify-between">
        <Link href="/activity#body-age" className="group flex items-center gap-1">
          <Eyebrow>Body age</Eyebrow>
          <ChevronRight size={13} className="text-way-faint transition-colors group-hover:text-way-ink2" />
        </Link>
        <span className="font-mono text-[11px] font-medium text-way-dim">Last 7 days</span>
      </div>

      <div className="flex items-center gap-4 lg:flex-col lg:gap-4">
        <div className="relative h-[132px] w-[132px] shrink-0 lg:h-[196px] lg:w-[196px]">
          <div className="lg:hidden">
            <Dial size={132} markerDeg={swing ? markerDeg : 0} on={swing} />
          </div>
          <div className="hidden lg:block">
            <Dial size={196} markerDeg={swing ? markerDeg : 0} on={swing} />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="font-brand text-[40px] leading-none text-way-gold lg:text-[60px]">{result.bodyAge.toFixed(1)}</span>
            <span className="font-mono text-[10px] font-medium tracking-[0.08em] text-way-dim">REAL {result.chronologicalAge}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 lg:items-center">
          <span
            className="way-pop flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[13px] font-semibold lg:self-center"
            style={{ color: tone, background: `${tone}1a`, '--d': '700ms' }}
          >
            {younger ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            {Math.abs(diff) < 0.3 ? 'Right on your real age' : `${Math.abs(diff).toFixed(1)} years ${younger ? 'younger' : 'older'}`}
          </span>
          {pace ? <span className="text-[13px] text-way-mute lg:text-center">{pace}.</span> : null}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-4 gap-1 border-t border-way-line pt-3.5 lg:pt-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-0.5">
            <span className="font-mono text-[15px] font-semibold lg:text-[17px]">{s.v}</span>
            <span className="text-[10px] text-way-dim lg:text-[11px]">{s.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const lockedActions = (returnTo) => ({
  'allow-sleep': { href: `/api/google-health/connect?returnTo=${encodeURIComponent(returnTo)}&extra=sleep`, text: 'Allow sleep' },
  measurements: { href: '/body', text: 'Add measurements' },
  profile: { href: '/settings', text: 'Complete profile' },
});

/**
 * Body Age while it's still locked: what it needs and how far along each
 * input is, so the card is never just missing. `data` = /api/body-age reply.
 */
export function BodyAgeLocked({ data, returnTo = '/activity', id, className = '', delay = 80 }) {
  const reqs = data?.requirements || [];
  if (!reqs.length) return null;
  const met = reqs.filter((r) => r.met).length;
  const actions = lockedActions(returnTo);
  return (
    <Card id={id} rise delay={delay} className={cx('flex scroll-mt-6 flex-col gap-4 p-[18px] lg:p-7', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Lock size={13} className="text-way-faint" />
          <Eyebrow>Body age</Eyebrow>
        </span>
        <span className="font-mono text-[11px] font-medium text-way-dim">
          {met}/{reqs.length} ready{data.window?.days ? ` · ${data.window.days} days` : ''}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-way-ink2 [text-wrap:pretty]">Unlocks once every input below is in. It updates on its own as your watch syncs.</span>
        <div className="h-1.5 overflow-hidden rounded-full bg-way-line">
          <div className="h-full rounded-full bg-way-gold transition-[width] duration-700" style={{ width: `${(met / reqs.length) * 100}%` }} />
        </div>
      </div>
      <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
        {reqs.map((r) => {
          const a = !r.met && r.action ? actions[r.action] : null;
          return (
            <li key={r.key} className="flex items-start gap-2.5 text-[13px]">
              {r.met ? (
                <CheckCircle2 size={16} className="mt-px shrink-0 text-emerald-400" />
              ) : (
                <Circle size={16} className="mt-px shrink-0 text-way-faint" />
              )}
              <span className={cx('min-w-0 flex-1 leading-snug [text-wrap:pretty]', r.met ? 'text-way-mute' : 'text-way-ink2')}>{r.label}</span>
              {!r.met && r.need > 1 ? (
                <span className="shrink-0 font-mono text-[12px] text-way-dim">
                  {r.have}/{r.need}
                </span>
              ) : null}
              {a ? (
                <a href={a.href} className="shrink-0 text-[12px] font-semibold text-way-gold underline underline-offset-2">
                  {a.text}
                </a>
              ) : null}
              {!r.met && r.action === 'read-error' ? <span className="shrink-0 text-[12px] font-semibold text-rose-300">Couldn’t read</span> : null}
              {!r.met && r.action === 'sleep-blocked' ? <span className="shrink-0 text-[12px] font-semibold text-amber-300">Blocked by Google</span> : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
