'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight, Plus, UtensilsCrossed } from 'lucide-react';
import { PAGE, PageHeader, Card, Eyebrow, Segmented, Btn, Dot, fmt, useMounted, cx } from '@/components/way/ui';

const RANGES = [7, 14, 30];
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const info = (date) => {
  const d = new Date(`${date}T00:00:00`);
  const wd = d.getDay();
  return {
    wd,
    long: WD[wd],
    short: WD[wd].slice(0, 3),
    letter: WD[wd][0],
    dom: d.getDate(),
    dateStr: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  };
};

/** Bars that pick a day when clicked; the selected one is lit, the rest dimmed. */
function Bars({ bars, height, gap, rounded = 'rounded-[4px_4px_2px_2px]', children, showVal = false }) {
  return (
    <div className="relative flex items-end" style={{ height, gap }}>
      {children}
      {bars.map((b) => (
        <button
          key={b.key}
          type="button"
          title={b.title}
          onClick={b.onClick}
          className="relative flex h-full min-w-0 flex-1 flex-col items-stretch justify-end transition-opacity duration-[250ms] hover:opacity-100"
          style={{ opacity: b.op }}
        >
          {showVal && b.valStr ? (
            <span className="whitespace-nowrap pb-[5px] text-center font-mono text-[11px] font-semibold text-way-ink">{b.valStr}</span>
          ) : null}
          <div
            className={cx('box-border transition-[height] duration-[800ms] ease-[cubic-bezier(.2,.8,.2,1)]', rounded)}
            style={{ height: `${b.h}%`, minHeight: b.minH, background: b.color, border: b.border, boxShadow: b.glow }}
          />
        </button>
      ))}
    </div>
  );
}

function Line({ pct, className, children }) {
  return (
    <div className={cx('pointer-events-none absolute inset-x-0 border-t', className)} style={{ bottom: `${pct}%` }}>
      {children}
    </div>
  );
}

/**
 * Nutrition over 7, 14 or 30 days. The server sends 30 days at once and the
 * range just slices them. One selected day is shared by every chart and the
 * Day panel.
 */
export default function NutritionClient({ days: allDays, targets }) {
  const [range, setRange] = useState(7);
  const [selRaw, setSel] = useState(null);
  const k = useMounted() ? 1 : 0;

  const T = { kcal: targets.targetCalories, p: targets.proteinG, c: targets.carbsG, f: targets.fatG };
  const days = allDays.slice(-range).map((d, i, arr) => ({ ...d, ...info(d.date), off: arr.length - 1 - i }));
  const n = days.length;
  const sel = selRaw == null || selRaw >= n ? n - 1 : selRaw;
  const pick = (i) => () => setSel(i);

  const logged = days.filter((d) => d.calories > 0);
  const closedLogged = logged.filter((d) => d.off > 0);
  const avg = logged.reduce((s, d) => s + d.calories, 0) / Math.max(1, logged.length);
  const onT = closedLogged.filter((d) => Math.abs(d.calories - T.kcal) <= T.kcal * 0.1).length;
  let streak = 0;
  for (let i = n - 1; i >= 0; i -= 1) {
    if (days[i].calories > 0) streak += 1;
    else if (i === n - 1) continue; // nothing logged yet today doesn't break the streak
    else break;
  }
  const mean = (a, key) => a.reduce((s, d) => s + d[key], 0) / Math.max(1, a.length);
  const we = logged.filter((d) => d.wd === 0 || d.wd === 6);
  const wk = logged.filter((d) => d.wd > 0 && d.wd < 6);
  const insight =
    we.length && wk.length
      ? `Weekdays average ${fmt(mean(wk, 'calories'))} kcal, weekends ${fmt(mean(we, 'calories'))}. ${
          mean(we, 'calories') > mean(wk, 'calories') * 1.05
            ? 'Weekends are where the surplus comes from.'
            : mean(we, 'calories') < mean(wk, 'calories') * 0.95
              ? 'Weekends run lighter than weekdays.'
              : 'Steady through the week.'
        }`
      : `${logged.length} logged day${logged.length === 1 ? '' : 's'} in this range.`;
  const trio = [
    {
      label: 'Avg intake',
      v: logged.length ? fmt(avg) : '—',
      unit: 'kcal',
      sub: logged.length ? `${Math.round((avg / T.kcal) * 100)}% of target` : 'nothing logged',
      color: '#fbbf24',
    },
    { label: 'On target', v: String(onT), unit: `/ ${closedLogged.length}`, sub: 'within ±10%', color: '#f1f5f9' },
    { label: 'Streak', v: String(streak), unit: 'days', sub: 'logged in a row', color: '#f1f5f9' },
  ];

  const labelFor = (d, i, mobile) => {
    if (range === 7) return mobile ? d.letter : d.short;
    if (range === 14) return i % 2 === (n - 1) % 2 ? (mobile ? String(d.dom) : `${d.short.slice(0, 2)} ${d.dom}`) : '';
    return (n - 1 - i) % (mobile ? 7 : 5) === 0 ? String(d.dom) : '';
  };
  const bar = (d, i, v, max, color, overT) => {
    const isSel = i === sel;
    const empty = d.calories === 0;
    const over = overT != null && v > overT * 1.1;
    return {
      key: d.date,
      h: empty ? 0 : (v / max) * 100 * k,
      minH: empty ? 6 : 0,
      color: empty ? 'transparent' : over ? '#fb7185' : color,
      border: empty ? '1px dashed #334155' : '0',
      op: isSel ? 1 : 0.42,
      glow: isSel && !empty ? `0 0 18px ${over ? 'rgba(251,113,133,.35)' : `${color}55`}` : 'none',
      onClick: pick(i),
      title: `${d.short} ${d.dateStr}: ${empty ? 'not logged' : fmt(v)}`,
    };
  };
  const calMax = Math.ceil((Math.max(...days.map((d) => d.calories), T.kcal) * 1.12) / 500) * 500;
  const gapD = range === 7 ? 18 : range === 14 ? 10 : 5;
  const gapM = range === 7 ? 10 : range === 14 ? 5 : 2;
  const calBars = days.map((d, i) => ({
    ...bar(d, i, d.calories, calMax, '#fbbf24', T.kcal),
    valStr: range === 7 && d.calories > 0 ? fmt(d.calories) : '',
  }));

  const MAC = [
    ['protein', 'Protein', '#34d399', T.p, 'more'],
    ['carbs', 'Carbs', '#60a5fa', T.c, 'band'],
    ['fat', 'Fat', '#a78bfa', T.f, 'band'],
  ];
  const macros = MAC.map(([key, label, color, t, rule], mi) => {
    const max = Math.max(...days.map((d) => d[key]), t) * 1.15;
    const hits = closedLogged.filter((d) => (rule === 'more' ? d[key] >= t * 0.9 : Math.abs(d[key] - t) <= t * 0.15)).length;
    const a = mean(logged, key);
    const diff = a - t;
    const note = !logged.length
      ? 'Log a few days to see how this averages out.'
      : rule === 'more'
        ? diff >= 0
          ? `Averaging ${fmt(diff)} g above goal.`
          : `Short by ${fmt(-diff)} g a day on average. A bowl of dal or curd closes some of it.`
        : Math.abs(diff) <= t * 0.08
          ? 'Close to target on average.'
          : `Averaging ${fmt(Math.abs(diff))} g ${diff > 0 ? 'above' : 'below'} target per day.`;
    return {
      key,
      label,
      color,
      t,
      avg: logged.length ? fmt(a) : '—',
      delay: 120 + mi * 70,
      hit: `${hits}/${closedLogged.length}`,
      hitLabel: rule === 'more' ? 'days ≥ 90% goal' : 'days within ±15%',
      hitColor: closedLogged.length && hits / closedLogged.length >= 0.6 ? '#34d399' : '#f1f5f9',
      targetPct: (t / max) * 100,
      note,
      bars: days.map((d, i) => bar(d, i, d[key], max, color, rule === 'more' ? null : t)),
    };
  });

  const d = days[sel];
  const pc = (v, t) => (t ? Math.round((v / t) * 100) : 0);
  const row = (label, v, t, unit, color, more) => {
    const p = pc(v, t);
    const over = !more && p > 110;
    return {
      label,
      v: fmt(v),
      t: fmt(t),
      unit,
      pct: p,
      fill: Math.min(100, p) * k,
      color: over ? '#fb7185' : color,
      pctColor: over ? '#fb7185' : p >= 90 ? '#34d399' : '#94a3b8',
    };
  };
  const tp = T.p * 4;
  const tc = T.c * 4;
  const tf = T.f * 9;
  const tt = tp + tc + tf || 1;
  const dp = d.protein * 4;
  const dc = d.carbs * 4;
  const dfat = d.fat * 9;
  const dt = dp + dc + dfat || 1;
  const dev = T.kcal ? (d.calories - T.kcal) / T.kcal : 0;
  const day = {
    title: `${d.short}, ${d.dateStr}`,
    tag:
      d.off === 0
        ? 'TODAY · IN PROGRESS'
        : d.calories === 0
          ? 'NOT LOGGED'
          : Math.abs(dev) <= 0.1
            ? 'ON TARGET'
            : dev > 0
              ? `${Math.round(dev * 100)}% OVER`
              : `${Math.round(-dev * 100)}% UNDER`,
    tagColor: d.off === 0 ? '#94a3b8' : d.calories === 0 ? '#64748b' : Math.abs(dev) <= 0.1 ? '#34d399' : dev > 0 ? '#fb7185' : '#fbbf24',
    logged: d.calories > 0,
    rows: [
      row('Calories', d.calories, T.kcal, ' kcal', '#fbbf24'),
      row('Protein', d.protein, T.p, ' g', '#34d399', true),
      row('Carbs', d.carbs, T.c, ' g', '#60a5fa'),
      row('Fat', d.fat, T.f, ' g', '#a78bfa'),
    ],
    splits: [
      { label: 'Day', p: dp, c: dc, f: dfat, str: `${Math.round((dp / dt) * 100)} · ${Math.round((dc / dt) * 100)} · ${Math.round((dfat / dt) * 100)}` },
      { label: 'Target', p: tp, c: tc, f: tf, str: `${Math.round((tp / tt) * 100)} · ${Math.round((tc / tt) * 100)} · ${Math.round((tf / tt) * 100)}` },
    ],
  };
  const todayHref = d.off === 0 ? '/home' : `/home?date=${d.date}`;
  const logHref = `/log-food?date=${d.date}`;
  const navBtn =
    'flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-way-line2 text-way-mute transition-colors hover:bg-way-hover disabled:opacity-35 lg:h-9 lg:w-9';
  const prev = () => setSel(Math.max(0, sel - 1));
  const next = () => setSel(Math.min(n - 1, sel + 1));

  return (
    <main className={PAGE}>
      <PageHeader
        title="Nutrition"
        sub={
          <>
            <span className="hidden md:inline">
              {days[0].dateStr} – {days[n - 1].dateStr} ·{' '}
            </span>
            {logged.length} of {n} days logged
          </>
        }
        right={
          <Segmented
            mono
            size="sm"
            value={range}
            onChange={(r) => {
              setRange(r);
              setSel(null);
            }}
            options={RANGES.map((r) => ({
              value: r,
              label: (
                <>
                  <span className="md:hidden">{r}D</span>
                  <span className="hidden md:inline">{r} days</span>
                </>
              ),
            }))}
          />
        }
      />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
        {/* Calories */}
        <Card id="calories" rise className="flex scroll-mt-6 flex-col gap-4 p-[18px] lg:col-span-8 lg:gap-[22px] lg:p-7">
          <div className="flex items-center justify-between lg:items-start lg:gap-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-[7px] lg:gap-2">
                <Dot color="#fbbf24" size={8} />
                <Eyebrow>Calories</Eyebrow>
              </div>
              <span className="hidden max-w-[360px] text-sm text-way-ink2 [text-wrap:pretty] lg:block">{insight}</span>
            </div>
            <span className="font-mono text-[11px] font-medium text-way-dim lg:hidden">target {fmt(T.kcal)}</span>
            <div className="hidden lg:grid lg:grid-cols-[repeat(3,auto)]">
              {trio.map((t, i) => (
                <div key={t.label} className={cx('flex flex-col gap-1 px-[22px]', i && 'border-l border-way-line')}>
                  <span className="text-xs text-way-mute">{t.label}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-[28px] font-semibold leading-none" style={{ color: t.color }}>
                      {t.v}
                    </span>
                    <span className="font-mono text-xs font-medium text-way-dim">{t.unit}</span>
                  </div>
                  <span className="text-[11px] text-way-dim">{t.sub}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 lg:hidden">
            {trio.map((t) => (
              <div key={t.label} className="flex flex-col gap-[3px]">
                <span className="text-[11px] text-way-mute">{t.label}</span>
                <div className="flex items-baseline gap-[3px]">
                  <span className="font-mono text-lg font-semibold leading-none" style={{ color: t.color }}>
                    {t.v}
                  </span>
                  <span className="font-mono text-[10px] font-medium text-way-dim">{t.unit}</span>
                </div>
                <span className="text-[10px] text-way-dim">{t.sub}</span>
              </div>
            ))}
          </div>

          {/* Phone chart */}
          <div className="flex flex-col gap-2 lg:hidden">
            <Bars bars={calBars.map((b) => ({ ...b, valStr: '' }))} height={150} gap={gapM}>
              <Line pct={(T.kcal / calMax) * 100} className="border-dashed border-way-dim" />
              {logged.length ? <Line pct={(avg / calMax) * 100} className="border-dotted border-way-kcal opacity-60" /> : null}
            </Bars>
            <div className="flex" style={{ gap: gapM }}>
              {days.map((dd, i) => (
                <span
                  key={dd.date}
                  className={cx('min-w-0 flex-1 whitespace-nowrap text-center font-mono text-[10px] font-semibold', i === sel ? 'text-way-ink' : 'text-way-dim')}
                >
                  {labelFor(dd, i, true)}
                </span>
              ))}
            </div>
            <div className="flex gap-3.5 text-[11px] text-way-dim">
              <span className="flex items-center gap-[5px]">
                <span className="w-3.5 border-t border-dashed border-way-dim" />
                Target
              </span>
              <span className="flex items-center gap-[5px]">
                <span className="w-3.5 border-t border-dotted border-way-kcal" />
                Average
              </span>
            </div>
          </div>

          {/* Desktop chart */}
          <div className="hidden gap-3 lg:flex">
            <div className="relative h-[260px] w-11 shrink-0">
              {[0, 0.5, 1].map((f) => (
                <span key={f} className="absolute right-0 translate-y-1/2 font-mono text-[10px] font-medium text-way-faint" style={{ bottom: `${f * 100}%` }}>
                  {fmt(calMax * f)}
                </span>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <Bars bars={calBars} height={260} gap={gapD} rounded="rounded-[5px_5px_2px_2px]" showVal>
                {[0, 0.5, 1].map((f) => (
                  <Line key={f} pct={f * 100} className="border-[#151c2a]" />
                ))}
                <Line pct={(T.kcal / calMax) * 100} className="z-[1] border-dashed border-way-dim">
                  <span className="absolute bottom-[3px] right-0 bg-way-card pl-1.5 font-mono text-[10px] font-semibold text-way-mute">
                    TARGET {fmt(T.kcal)}
                  </span>
                </Line>
                {logged.length ? (
                  <Line pct={(avg / calMax) * 100} className="z-[1] border-dotted border-way-kcal">
                    <span className="absolute left-0 top-[3px] bg-way-card pr-1.5 font-mono text-[10px] font-semibold text-way-kcal">AVG {fmt(avg)}</span>
                  </Line>
                ) : null}
              </Bars>
              <div className="flex" style={{ gap: gapD }}>
                {days.map((dd, i) => (
                  <span
                    key={dd.date}
                    className={cx('min-w-0 flex-1 whitespace-nowrap text-center font-mono text-[11px] font-semibold', i === sel ? 'text-way-ink' : 'text-way-dim')}
                  >
                    {labelFor(dd, i, false)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Day panel */}
        <Card id="day" rise delay={80} className="flex scroll-mt-6 flex-col gap-3.5 border-way-line2 p-[18px] lg:col-span-4 lg:gap-[22px] lg:p-7">
          <div className="flex items-center justify-between gap-2.5">
            <button type="button" onClick={prev} disabled={sel === 0} aria-label="Previous day" className={cx(navBtn, 'lg:hidden')}>
              <ChevronLeft size={15} />
            </button>
            <div className="flex flex-col items-center gap-0.5 lg:items-start lg:gap-1">
              <Eyebrow className="hidden lg:block">Day</Eyebrow>
              <span className="text-[15px] font-semibold lg:font-heading lg:text-[26px] lg:font-bold lg:leading-none">{day.title}</span>
              <span className="font-mono text-[10px] font-medium lg:text-[11px]" style={{ color: day.tagColor }}>
                {day.tag}
              </span>
            </div>
            <button type="button" onClick={next} disabled={sel === n - 1} aria-label="Next day" className={cx(navBtn, 'lg:hidden')}>
              <ChevronRight size={15} />
            </button>
            <div className="hidden gap-1.5 lg:flex">
              <button type="button" onClick={prev} disabled={sel === 0} title="Previous day" aria-label="Previous day" className={navBtn}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={next} disabled={sel === n - 1} title="Next day" aria-label="Next day" className={navBtn}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {day.logged ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 lg:flex lg:flex-col lg:gap-[18px]">
                {day.rows.map((r) => (
                  <div key={r.label} className="flex flex-col gap-[5px] lg:gap-[7px]">
                    <div className="flex items-baseline justify-between">
                      <span className="flex items-center gap-[7px] text-[11px] text-way-mute lg:text-[13px]">
                        <span className="hidden lg:inline-flex">
                          <Dot color={r.color} size={7} />
                        </span>
                        {r.label}
                      </span>
                      <span className="font-mono text-[10px] font-semibold lg:hidden" style={{ color: r.pctColor }}>
                        {r.pct}%
                      </span>
                      <span className="hidden font-mono text-sm font-semibold lg:inline">
                        {r.v}
                        <span className="text-[11px] text-way-dim">
                          {' '}
                          / {r.t}
                          {r.unit}
                        </span>
                        <span className="ml-2 text-[11px]" style={{ color: r.pctColor }}>
                          {r.pct}%
                        </span>
                      </span>
                    </div>
                    <span className="font-mono text-[15px] font-semibold lg:hidden">
                      {r.v}
                      <span className="text-[10px] text-way-dim">
                        {' '}
                        / {r.t}
                        {r.unit}
                      </span>
                    </span>
                    <div className="h-1 overflow-hidden rounded-full bg-way-track lg:h-1.5">
                      <div
                        className="h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                        style={{ width: `${r.fill}%`, background: r.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-[7px] border-t border-way-line pt-3 lg:gap-[9px] lg:pt-[18px]">
                <div className="flex justify-between text-[11px] text-way-mute lg:text-xs">
                  <span>
                    Energy split<span className="lg:hidden"> · day vs target</span>
                  </span>
                  <span className="hidden font-mono text-[11px] text-way-dim lg:inline">P · C · F</span>
                </div>
                {day.splits.map((sp) => (
                  <div key={sp.label} className="flex items-center gap-2 lg:gap-2.5">
                    <span className="w-[42px] font-mono text-[10px] font-medium text-way-dim lg:w-12 lg:text-[11px]">{sp.label}</span>
                    <div className="flex h-2 flex-1 gap-0.5 overflow-hidden rounded lg:h-2.5">
                      <div className="transition-[flex] duration-[600ms]" style={{ flex: sp.p, background: '#34d399' }} />
                      <div className="transition-[flex] duration-[600ms]" style={{ flex: sp.c, background: '#60a5fa' }} />
                      <div className="transition-[flex] duration-[600ms]" style={{ flex: sp.f, background: '#a78bfa' }} />
                    </div>
                    <span className="hidden w-[88px] text-right font-mono text-[11px] font-medium text-way-mute lg:inline">{sp.str}</span>
                  </div>
                ))}
              </div>
              <Link
                href={todayHref}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-way-line2 p-2.5 text-[13px] font-medium text-way-ink2 transition-colors hover:bg-way-hover lg:mt-auto lg:p-3"
              >
                <span className="lg:hidden">Open day</span>
                <span className="hidden lg:inline">Open this day in Today</span>
                <ArrowRight size={13} />
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2.5 pb-1 pt-2.5 lg:flex-1 lg:justify-center lg:gap-3.5 lg:rounded-2xl lg:border lg:border-dashed lg:border-way-line2 lg:p-7">
              <UtensilsCrossed size={22} className="hidden text-way-faint lg:block" />
              <span className="text-center text-[13px] text-way-mute lg:text-sm">
                No food logged on this day.<span className="hidden lg:inline"> It&apos;s left out of your averages.</span>
              </span>
              <Btn as={Link} href={logHref} variant="primary" className="h-auto rounded-[10px] px-3.5 py-[9px] text-xs lg:px-4 lg:py-2.5 lg:text-[13px]">
                <Plus size={13} />
                Log food<span className="hidden lg:inline"> for this day</span>
              </Btn>
            </div>
          )}
        </Card>

        {/* Protein, carbs and fat */}
        {macros.map((m) => (
          <Card key={m.key} id={m.key === macros[0].key ? 'macros' : `macro-${m.key}`} rise delay={m.delay} className="flex scroll-mt-6 flex-col gap-3 px-[18px] py-4 lg:col-span-4 lg:gap-[18px] lg:p-6">
            <div className="flex items-start justify-between gap-2.5 lg:gap-3">
              <div className="flex flex-col gap-1 lg:gap-2">
                <div className="flex items-center gap-[7px] lg:gap-2">
                  <Dot color={m.color} size={8} />
                  <Eyebrow>{m.label}</Eyebrow>
                </div>
                <div className="flex items-baseline gap-1 lg:gap-[5px]">
                  <span className="font-mono text-xl font-semibold leading-none lg:text-3xl">{m.avg}</span>
                  <span className="font-mono text-[11px] font-medium text-way-dim lg:text-xs">/ {m.t} g avg</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 lg:gap-[3px] lg:pt-0.5">
                <span className="font-mono text-[13px] font-semibold lg:text-[15px]" style={{ color: m.hitColor }}>
                  {m.hit}
                </span>
                <span className="text-[10px] text-way-dim lg:text-[11px]">{m.hitLabel}</span>
              </div>
            </div>
            <div className="lg:hidden">
              <Bars bars={m.bars} height={64} gap={gapM} rounded="rounded-[3px_3px_1px_1px]">
                <Line pct={m.targetPct} className="border-dashed border-way-dim" />
              </Bars>
            </div>
            <div className="hidden lg:block">
              <Bars bars={m.bars} height={120} gap={gapM} rounded="rounded-[3px_3px_1px_1px]">
                <Line pct={m.targetPct} className="border-dashed border-way-dim" />
              </Bars>
            </div>
            <div className="hidden border-t border-way-line pt-3.5 text-xs text-way-mute [text-wrap:pretty] lg:block">{m.note}</div>
          </Card>
        ))}
      </div>
      <p className="px-3 text-center text-[11px] text-way-dim [text-wrap:pretty] lg:text-xs">
        <span className="lg:hidden">Tap a bar in any chart to open that day. Averages skip days with nothing logged.</span>
        <span className="hidden lg:inline">
          Click a bar in any chart to open that day · dashed = target · dotted = your average · averages skip days with nothing logged
        </span>
      </p>
    </main>
  );
}
