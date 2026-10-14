'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, Eyebrow, Btn, cx } from '@/components/way/ui';
import { useJson } from '@/components/way/useJson';

const SPAN = 10; // years either side shown on the dial

function pt(deg, r) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
}

/** 60-tick dial; ticks between 0 and the marker light up (green younger, amber older). */
function Dial({ size, markerDeg, on, dim }) {
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
          opacity: lit ? 1 : dim ? 0.1 : major ? 0.4 : 0.16,
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
 * Body Age from Google Health (lib/bodyAge.js via /api/body-age).
 * Locked without Google Health; while data builds up it shows how close it is.
 */
export default function BodyAgeCard({ connected, realAge, className = '', delay = 80 }) {
  const res = useJson(connected ? '/api/body-age' : null);
  const state = { loading: res.loading, data: res.data };
  const [swing, setSwing] = useState(false);

  const d = state.data;
  const result = d?.eligible ? d.result : null;
  useEffect(() => {
    if (!result) return undefined;
    const t = setTimeout(() => setSwing(true), 120);
    return () => clearTimeout(t);
  }, [result]);

  const real = result?.chronologicalAge ?? realAge;
  const diff = result ? result.bodyAge - result.chronologicalAge : 0;
  const markerDeg = (Math.max(-SPAN, Math.min(SPAN, diff)) / SPAN) * 180;
  const on = !!result && swing;

  let headline;
  let ageStr = '—';
  let numColor = '#475569';
  let windowLabel = 'Locked';
  if (!connected) {
    headline = 'Log in to Google Health to see your Body Age. Your health tiles appear here once you connect.';
  } else if (state.loading) {
    headline = 'Reading your last 7 days…';
    windowLabel = 'Last 7 days';
  } else if (result) {
    ageStr = result.bodyAge.toFixed(1);
    numColor = '#facc15';
    windowLabel = 'Last 7 days';
    const years = Math.abs(diff).toFixed(1);
    const pace =
      result.pace == null ? '' : result.pace < 1 ? ', and ageing slower than time' : result.pace > 1.05 ? ', but ageing faster than time right now' : ', ageing in step with time';
    headline =
      Math.abs(diff) < 0.3
        ? `Right on your real age${pace}.`
        : `${years} years ${diff < 0 ? 'younger' : 'older'} than your real age${pace}.`;
  } else if (d?.connected === false) {
    headline = 'Your Google Health session expired. Reconnect to see your Body Age.';
  } else if (d?.requirements) {
    const met = d.requirements.filter((r) => r.met).length;
    const next = d.requirements.find((r) => !r.met);
    windowLabel = `${met} of ${d.requirements.length} ready`;
    headline = next
      ? `Almost there. Body Age unlocks with more data: ${next.label.toLowerCase()} (${next.have} of ${next.need}).`
      : 'Body Age is getting ready.';
  } else {
    headline = 'Body Age couldn’t load right now. Try again later.';
  }

  const v = d?.vitals || {};
  const stats = connected && d
    ? [
        { v: v.readiness?.score != null ? String(Math.round(v.readiness.score)) : '—', label: 'Readiness' },
        { v: result?.pace != null ? `${result.pace.toFixed(1)}×` : '—', label: 'Pace' },
        { v: v.sleepConsistency != null ? `${Math.round(v.sleepConsistency)}%` : '—', label: 'Sleep' },
      ]
    : null;

  const connectHref = '/api/google-health/connect?returnTo=%2Fhome';
  const needsConnect = !connected || d?.connected === false;

  return (
    <Card rise delay={delay} className={cx('flex flex-col gap-4 p-[18px] lg:gap-[18px] lg:p-7', className)}>
      <div className="flex items-center justify-between">
        {connected ? (
          <Link href="/activity#body-age" className="group flex items-center gap-1">
            <Eyebrow>Body age</Eyebrow>
            <ChevronRight size={13} className="text-way-faint transition-colors group-hover:text-way-ink2" />
          </Link>
        ) : (
          <Eyebrow>Body age</Eyebrow>
        )}
        <span className="font-mono text-[11px] font-medium text-way-dim">{windowLabel}</span>
      </div>

      <div className="flex items-center gap-4 lg:flex-col lg:gap-[18px]">
        <div className="relative h-[132px] w-[132px] shrink-0 lg:h-[208px] lg:w-[208px]">
          <div className="lg:hidden">
            <Dial size={132} markerDeg={on ? markerDeg : 0} on={on} dim={!connected} />
          </div>
          <div className="hidden lg:block">
            <Dial size={208} markerDeg={on ? markerDeg : 0} on={on} dim={!connected} />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 lg:gap-1">
            <span className="font-brand text-[40px] leading-none lg:text-[64px]" style={{ color: numColor }}>
              {ageStr}
            </span>
            <span className="font-mono text-[9px] font-medium text-way-dim lg:text-[10px] lg:tracking-[0.08em]">
              REAL{' '}<span className="hidden lg:inline">AGE </span>
              {real ?? '—'}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 lg:items-center">
          <p className="text-sm leading-snug text-way-ink2 [text-wrap:pretty] lg:text-center lg:text-[15px]">{headline}</p>
          {needsConnect ? (
            <Btn as="a" href={connectHref} variant="primary" size="sm" className="self-start rounded-[10px] lg:hidden">
              Log in to Google Health
            </Btn>
          ) : null}
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-3 border-t border-way-line pt-3.5 lg:mt-auto lg:pt-[18px]">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-[3px]">
              <span className="font-mono text-[17px] font-semibold lg:text-xl">{s.v}</span>
              <span className="text-[11px] text-way-dim lg:text-xs">{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      {needsConnect ? (
        <Btn as="a" href={connectHref} variant="primary" size="lg" className="mt-auto hidden lg:inline-flex">
          Log in to Google Health
        </Btn>
      ) : null}
    </Card>
  );
}
