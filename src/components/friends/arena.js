'use client';

import { Crown, UserPlus, Swords, Check, PartyPopper, LayoutGrid, ChevronRight } from 'lucide-react';
import { FIELDS, COMPETE_KEYS, PERIODS, fmtVal, displayName, relDay } from '@/lib/friends';
import { Card, Eyebrow, Btn, Segmented, cx } from '@/components/way/ui';
import { Avatar, FIELD_ICONS, ICONS } from './parts';

const MEDAL = ['#facc15', '#cbd5e1', '#d97706'];
const EASE = 'transition-[width] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]';
const PERIOD_LABEL = { today: 'today', week: '7 days', month: '30 days' };

function Section({ title, right, className = '' }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 px-0.5', className)}>
      <Eyebrow>{title}</Eyebrow>
      {right ? <span className="font-mono text-[11px] font-medium text-way-dim">{right}</span> : null}
    </div>
  );
}

const moveOf = (r) => (r.move > 0 ? { s: `▲ ${r.move}`, c: '#34d399' } : r.move < 0 ? { s: `▼ ${-r.move}`, c: '#fb7185' } : { s: '', c: '#7c8aa0' });

/** No competitors yet: no leaderboard at all, just the way in. */
function EmptyArena({ onAdd }) {
  return (
    <Card className="relative flex flex-col items-center gap-4 overflow-hidden px-6 py-10 text-center lg:col-span-8 lg:py-16">
      <div className="pointer-events-none absolute left-1/2 top-[-60px] h-[260px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.10),transparent_70%)]" />
      <div className="way-pop relative flex h-16 w-16 items-center justify-center rounded-2xl border border-way-line2 bg-way-rail">
        <Swords size={28} className="text-way-gold" />
      </div>
      <div className="relative flex max-w-[420px] flex-col gap-1.5">
        <span className="font-heading text-2xl font-bold">Your arena is empty</span>
        <span className="text-sm text-way-mute [text-wrap:pretty]">
          Add up to 3 friends to compete with. The leaderboard appears once someone accepts, and you only compare the stats you both agree on.
        </span>
      </div>
      <Btn variant="primary" onClick={onAdd} className="relative">
        <UserPlus size={14} />
        Add a friend
      </Btn>
    </Card>
  );
}

/** Two people: a head-to-head. Sides slide in, the VS pops, the bar tugs. */
function HeadToHead({ m, ranked, missing, f, k }) {
  const ids = [...ranked.map((r) => r.id), ...missing];
  const meId = m.me.id;
  const themId = ids.find((id) => id !== meId);
  const you = ranked.find((r) => r.id === meId)?.v ?? null;
  const them = ranked.find((r) => r.id === themId)?.v ?? null;
  const total = (you || 0) + (them || 0);
  const share = total ? ((you || 0) / total) * 100 : 50;
  const lead = you != null && them != null ? (you > them ? 'you' : you < them ? 'them' : 'tie') : null;
  const p = m.person(themId);
  const side = (who, v, isMe, cls, d) => (
    <div className={cx('flex flex-col items-center gap-2.5', cls)} style={{ '--d': `${d}ms` }}>
      <div className="relative">
        {lead === (isMe ? 'you' : 'them') ? <Crown size={20} className="way-drop absolute -top-6 left-1/2 -translate-x-1/2 text-way-gold" style={{ '--d': '900ms' }} /> : null}
        <Avatar person={who} isMe={isMe} size={72} ring={`0 0 0 4px #0f1420, 0 0 0 6px ${isMe ? '#34d399' : f.color}`} />
      </div>
      <span className="max-w-[140px] truncate text-sm font-semibold">{isMe ? 'You' : displayName(who)}</span>
      <span className="font-mono text-2xl font-semibold" style={{ color: isMe ? '#34d399' : f.color }}>
        {v == null ? '—' : fmtVal(v, f.dec)}
      </span>
      <span className="font-mono text-[11px] text-way-dim">{f.unit}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-6 px-4 pb-6 pt-8 lg:px-12">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {side(m.me, you, true, 'way-in-left', 0)}
        <span className="way-pop font-heading text-3xl font-bold tracking-[0.12em] text-way-faint" style={{ '--d': '450ms' }}>
          VS
        </span>
        {side(p, them, false, 'way-in-right', 0)}
      </div>
      <div className="relative h-3 overflow-hidden rounded-full" style={{ background: `${f.color}55` }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#10b981,#34d399)] transition-[width] duration-[1200ms] ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ width: `${k ? share : 50}%` }}
        />
        <div className="absolute -bottom-1 -top-1 left-1/2 w-0.5 bg-way-page" />
      </div>
      <p className="text-center text-[13px] text-way-mute">
        {lead == null
          ? 'Waiting for both of you to sync.'
          : lead === 'tie'
            ? 'Dead even. Next step decides it.'
            : lead === 'you'
              ? `You lead by ${fmtVal(you - them, f.dec)} ${f.unit}.`
              : `${displayName(p)} leads by ${fmtVal(them - you, f.dec)} ${f.unit}.`}
      </p>
    </div>
  );
}

/** Three or four people: a podium. Columns rise one by one; with four, a light sweeps it and the fourth slides in below. */
function Podium({ m, ranked, missing, f, k }) {
  const four = ranked.length + missing.length >= 4;
  const podium = [1, 0, 2].map((i) => ranked[i] || null);
  const rest = [...ranked.slice(3), ...missing.map((id) => ({ id, v: null }))];
  const max = ranked[0]?.v || 1;
  return (
    <>
      <div className="relative overflow-hidden px-3 pt-[22px] lg:px-[60px] lg:pt-8">
        <div className="pointer-events-none absolute left-1/2 top-[-40px] h-[200px] w-[260px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.14),rgba(250,204,21,0)_70%)] lg:h-[340px] lg:w-[520px]" />
        {four ? <div className="way-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)]" /> : null}
        <div className="relative grid grid-cols-3 items-end gap-2 lg:gap-[18px]">
          {podium.map((r, slot) => {
            const pi = [1, 0, 2][slot];
            const first = pi === 0;
            const p = r ? m.person(r.id) : null;
            const mv = r ? moveOf(r) : null;
            // Third rises first, then second, then the winner.
            const delay = [350, 700, 0][slot];
            const hM = (first ? 92 : pi === 1 ? 70 : 52) + 12;
            const hD = (first ? 150 : pi === 1 ? 112 : 84) + 20;
            return (
              <div key={slot} className="flex min-w-0 flex-col items-center gap-2 lg:gap-2.5">
                {r ? (
                  <div className="way-drop flex min-w-0 max-w-full flex-col items-center gap-2" style={{ '--d': `${delay + 450}ms` }}>
                    {first ? <Crown size={22} className="text-way-gold" /> : null}
                    <Avatar person={p} isMe={r.id === m.me.id} size={first ? 54 : 44} className="lg:hidden" ring={`0 0 0 3px #0f1420, 0 0 0 5px ${MEDAL[pi]}`} />
                    <Avatar
                      person={p}
                      isMe={r.id === m.me.id}
                      size={first ? 84 : 68}
                      className="hidden lg:flex"
                      ring={`0 0 0 4px #0f1420, 0 0 0 6px ${MEDAL[pi]}, 0 0 30px ${first ? 'rgba(250,204,21,.35)' : 'transparent'}`}
                    />
                    <span className="max-w-full truncate text-xs font-semibold lg:text-[15px]">{r.id === m.me.id ? 'You' : displayName(p)}</span>
                    <span className="font-mono text-xs font-semibold lg:text-lg" style={{ color: MEDAL[pi] }}>
                      {fmtVal(r.v, f.dec)}
                      <span className="hidden text-[11px] text-way-dim lg:inline"> {f.unit}</span>
                    </span>
                    <span className="hidden font-mono text-[10px] font-semibold lg:block" style={{ color: mv.c }}>
                      {mv.s}
                    </span>
                  </div>
                ) : (
                  <div className="h-11 w-11 rounded-full border border-dashed border-way-line2 lg:h-[68px] lg:w-[68px]" />
                )}
                <div
                  className="way-column flex w-full items-start justify-center rounded-t-[10px] border border-b-0 pt-2 lg:rounded-t-[14px] lg:pt-3 lg:[height:var(--hd)]"
                  style={{
                    height: hM,
                    '--hd': `${hD}px`,
                    '--d': `${delay}ms`,
                    background: first ? 'linear-gradient(180deg, rgba(250,204,21,.18), rgba(250,204,21,.03))' : 'linear-gradient(180deg, rgba(148,163,184,.12), rgba(148,163,184,.02))',
                    borderColor: first ? 'rgba(250,204,21,.35)' : '#253044',
                  }}
                >
                  <span className="font-brand text-[30px] leading-none lg:text-[54px]" style={{ color: MEDAL[pi] }}>
                    {pi + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {rest.length ? (
        <div className="border-t border-way-line2">
          {rest.map((r, i) => {
            const p = m.person(r.id);
            const isMe = r.id === m.me.id;
            const above = r.v != null ? ranked[r.rank - 2] : null;
            return (
              <div
                key={r.id}
                className={cx('way-in-right flex items-center gap-3 px-4 py-3 lg:px-6', i && 'border-t border-way-line', isMe && 'bg-emerald-500/7')}
                style={{ '--d': `${1300 + i * 120}ms` }}
              >
                <span className="w-6 font-mono text-[13px] font-semibold text-way-dim">{r.v == null ? '–' : String(r.rank).padStart(2, '0')}</span>
                <Avatar person={p} isMe={isMe} size={32} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[13px] font-semibold">{isMe ? 'You' : displayName(p)}</span>
                  <div className="h-[4px] overflow-hidden rounded-full bg-way-track">
                    <div className={cx('h-full rounded-full', EASE)} style={{ width: `${r.v == null ? 0 : (r.v / max) * 100 * k}%`, background: isMe ? '#34d399' : f.color }} />
                  </div>
                  <span className="text-[11px] text-way-dim">
                    {r.v == null ? 'Hasn’t synced yet' : `${fmtVal(above.v - r.v, f.dec)} ${f.unit} behind ${above.id === m.me.id ? 'you' : displayName(m.person(above.id))}`}
                  </span>
                </div>
                <span className={cx('font-mono text-sm font-semibold', r.v == null ? 'text-way-faint' : 'text-way-ink')}>{r.v == null ? 'no data' : fmtVal(r.v, f.dec)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/** Every stat at once, plus live duels. Tap a stat to open its board. */
function AllBoards({ m, period, setMetric, k }) {
  const keys = COMPETE_KEYS.filter((key) => m.competitors.some((c) => c.fields.includes(key)));
  const live = m.duels.filter((d) => !d.finished);
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:p-5">
      {keys.map((key, ki) => {
        const f = FIELDS[key];
        const Icon = FIELD_ICONS[key];
        const { ranked } = m.board(key, period);
        const max = ranked[0]?.v || 1;
        const myRank = ranked.findIndex((r) => r.id === m.me.id) + 1;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setMetric(key)}
            className="way-rise group flex flex-col gap-3 rounded-[18px] border border-way-line bg-way-rail p-4 text-left transition-colors hover:border-way-line3"
            style={{ '--d': `${ki * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: f.color }}>
                <Icon size={15} />
                {f.label}
              </span>
              <span className="flex items-center gap-1 font-mono text-xs text-way-mute">
                {myRank ? (
                  <>
                    <span className={myRank === 1 ? 'text-way-gold' : 'text-way-ink'}>#{myRank}</span> of {ranked.length}
                  </>
                ) : (
                  'no data'
                )}
                <ChevronRight size={13} className="text-way-faint group-hover:text-way-ink2" />
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {ranked.slice(0, 4).map((r, i) => {
                const isMe = r.id === m.me.id;
                return (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="w-3 font-mono text-[11px] text-way-dim">{i + 1}</span>
                    <Avatar person={m.person(r.id)} isMe={isMe} size={20} />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-way-track">
                      <div className={cx('h-full rounded-full', EASE)} style={{ width: `${(r.v / max) * 100 * k}%`, background: isMe ? '#34d399' : f.color }} />
                    </div>
                    <span className="w-14 text-right font-mono text-[11px] text-way-ink2">{fmtVal(r.v, f.dec)}</span>
                  </div>
                );
              })}
              {!ranked.length ? <span className="text-xs text-way-dim">No numbers yet.</span> : null}
            </div>
          </button>
        );
      })}
      {live.length ? (
        <div className="way-rise flex flex-col gap-2.5 rounded-[18px] border border-rose-400/25 bg-way-rail p-4 sm:col-span-2" style={{ '--d': `${keys.length * 80}ms` }}>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-way-over">
            <Swords size={15} />
            Live duels
          </span>
          {live.map((d) => {
            const f = FIELDS[d.duel.metric];
            const lead = d.you >= d.theirs;
            return (
              <div key={d.duel.id} className="flex items-center gap-2.5 text-[13px]">
                <Avatar person={d.them} size={22} />
                <span className="min-w-0 flex-1 truncate">
                  vs {displayName(d.them)} · <span className="text-way-dim">{f.label}</span>
                </span>
                <span className="font-mono text-xs" style={{ color: d.you === d.theirs ? '#94a3b8' : lead ? '#34d399' : '#fb7185' }}>
                  {fmtVal(d.you, f.dec)} – {fmtVal(d.theirs, f.dec)}
                </span>
                <span className="font-mono text-[11px] text-way-dim">{d.left}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ArenaTab({ m, metric, setMetric, period, setPeriod, k, onCheer, onCheerPerson, onClaim, onAdd, onOpenFamily }) {
  const hasArena = m.competitors.length > 0;
  const shared = COMPETE_KEYS.filter((key) => m.competitors.some((c) => c.fields.includes(key)));
  const all = metric === 'all' || !shared.includes(metric);
  const f = all ? null : FIELDS[metric];
  const board = all ? null : m.board(metric, period);
  const ranked = board?.ranked || [];
  const people = board ? ranked.length + board.missing.length : 0;

  // Your rank (one stat) or standings (all stats)
  let rankCard = null;
  if (hasArena && !all) {
    const i = ranked.findIndex((r) => r.id === m.me.id);
    const mine = ranked[i];
    const ahead = i > 0 ? ranked[i - 1] : null;
    const days = PERIODS[period];
    const my = !mine
      ? { rank: '—', headline: 'No numbers yet', sub: 'Your numbers appear once WAY syncs your day.', pass: 0 }
      : ahead
        ? {
            rank: `#${i + 1}`,
            headline: `${fmtVal(ahead.v - mine.v, f.dec)} ${f.unit} to pass ${displayName(m.person(ahead.id))}`,
            sub: f.agg === 'avg' ? `Beat ${fmtVal(ahead.v, 1)} ${f.unit} on average to move up.` : `About ${fmtVal((ahead.v - mine.v) / days, f.dec)} extra ${f.unit} a day gets you there.`,
            pass: (mine.v / ahead.v) * 100,
          }
        : { rank: '#1', headline: ranked.length > 1 ? 'You hold the crown' : 'Waiting for friends to sync', sub: ranked.length > 1 ? 'Defend it. People are close behind.' : 'Their numbers show up once they open WAY.', pass: 100 };
    rankCard = (
      <Card className="relative flex items-center gap-3.5 overflow-hidden border-[rgba(250,204,21,.3)] p-4 lg:flex-col lg:items-stretch lg:gap-4 lg:p-6">
        <div className="hidden items-center justify-between lg:flex">
          <Eyebrow>Your rank</Eyebrow>
          <span className="font-mono text-[11px] font-medium text-way-dim">
            {f.label} · {PERIOD_LABEL[period]}
          </span>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="font-brand text-5xl leading-none text-way-gold lg:text-[76px] lg:leading-[.85]">{my.rank}</span>
          <span className="hidden whitespace-nowrap font-mono text-[13px] font-medium text-way-dim lg:inline">of {people}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-[3px] lg:gap-1.5">
          <span className="text-[13px] font-semibold lg:text-xs lg:font-normal lg:text-way-ink2">{my.headline}</span>
          <div className="hidden h-1.5 overflow-hidden rounded-full bg-way-track lg:block">
            <div className={cx('h-full rounded-full bg-way-gold', EASE)} style={{ width: `${Math.min(100, my.pass) * k}%` }} />
          </div>
          <span className="text-xs text-way-mute [text-wrap:pretty]">{my.sub}</span>
        </div>
      </Card>
    );
  } else if (hasArena) {
    const standings = shared.map((key) => {
      const r = m.board(key, period).ranked;
      return { key, rank: r.findIndex((x) => x.id === m.me.id) + 1, of: r.length };
    });
    const crowns = standings.filter((s) => s.rank === 1 && s.of > 1).length;
    rankCard = (
      <Card className="flex flex-col gap-3 border-[rgba(250,204,21,.3)] p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Your standings</Eyebrow>
          <span className="font-mono text-[11px] font-medium text-way-dim">{PERIOD_LABEL[period]}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-brand text-5xl leading-none text-way-gold">{crowns}</span>
          <span className="text-[13px] text-way-mute">crown{crowns === 1 ? '' : 's'} held</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {standings.map((s) => {
            const Icon = FIELD_ICONS[s.key];
            return (
              <button key={s.key} type="button" onClick={() => setMetric(s.key)} className="flex items-center gap-2 rounded-lg px-1 py-1 text-left text-[13px] hover:bg-way-hover">
                <Icon size={14} style={{ color: FIELDS[s.key].color }} />
                <span className="flex-1 text-way-ink2">{FIELDS[s.key].label}</span>
                <span className={cx('font-mono text-xs font-semibold', s.rank === 1 ? 'text-way-gold' : 'text-way-ink')}>{s.rank ? `#${s.rank}` : '—'}</span>
                <span className="w-10 font-mono text-[11px] text-way-dim">of {s.of}</span>
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  const chips = (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      {[['all', 'All', LayoutGrid, '#f1f5f9'], ...shared.map((key) => [key, FIELDS[key].label, FIELD_ICONS[key], FIELDS[key].color])].map(([key, label, Icon, color]) => {
        const on = key === 'all' ? all : key === metric;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setMetric(key)}
            aria-pressed={on}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-[7px] text-xs font-semibold transition-colors"
            style={on ? { background: color, color: '#090d16', borderColor: color } : { color: '#94a3b8', borderColor: '#253044' }}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
  const periods = (
    <Segmented
      mono
      size="sm"
      stretch
      className="rounded-xl p-[3px] md:shrink-0 md:bg-way-rail"
      value={period}
      onChange={setPeriod}
      options={Object.keys(PERIODS).map((p) => ({ value: p, label: { today: 'Today', week: '7D', month: '30D' }[p] }))}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
      {hasArena ? (
        <>
          <div className="flex flex-col gap-3.5 lg:hidden">
            {chips}
            {periods}
          </div>
          <Card className="relative flex flex-col overflow-hidden lg:col-span-8">
            <div className="relative z-[1] hidden items-center justify-between gap-4 px-6 pt-[22px] lg:flex">
              {chips}
              {periods}
            </div>
            <div key={`${metric}-${period}`}>
              {all ? (
                <AllBoards m={m} period={period} setMetric={setMetric} k={k} />
              ) : people <= 2 ? (
                <HeadToHead m={m} ranked={ranked} missing={board.missing} f={f} k={k} />
              ) : (
                <Podium m={m} ranked={ranked} missing={board.missing} f={f} k={k} />
              )}
            </div>
            <div className="hidden border-t border-way-line px-6 pb-4 pt-3 text-[11px] text-way-dim lg:block">
              Only stats you both agreed on are compared · numbers update when each person opens WAY (at most every 30 min)
              {f?.agg === 'avg' ? ' · sleep is an average per night' : ''}
            </div>
          </Card>
        </>
      ) : (
        <EmptyArena onAdd={onAdd} />
      )}

      <div className="flex flex-col gap-3.5 lg:col-span-4 lg:gap-5">
        {rankCard}

        <Section title="Weekly quests" right={m.season.left} className="lg:hidden" />
        <Card className="flex flex-col overflow-hidden lg:pb-2 lg:pt-[22px]">
          <div className="hidden items-center justify-between px-[22px] pb-3 lg:flex">
            <Eyebrow>Weekly quests</Eyebrow>
            <span className="font-mono text-[11px] font-medium text-way-dim">{m.season.left}</span>
          </div>
          {m.quests.map((q, i) => {
            const Icon = q.claimed ? Check : ICONS[q.icon];
            const tone = q.claimed ? ['rgba(52,211,153,.14)', '#34d399', '#34d399'] : q.done ? ['rgba(250,204,21,.16)', '#facc15', '#facc15'] : ['#1a2130', '#94a3b8', '#7c8aa0'];
            return (
              <div key={q.id} className={cx('flex items-center gap-3 px-3.5 py-[13px] lg:px-[22px] lg:py-3', (i || true) && i ? 'border-t border-way-line' : 'lg:border-t lg:border-way-line')}>
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] transition-colors lg:h-9 lg:w-9" style={{ background: tone[0], color: tone[1] }}>
                  <Icon size={16} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                  <div className="flex justify-between gap-1.5">
                    <span className="text-[13px] font-medium">{q.label}</span>
                    <span className="whitespace-nowrap font-mono text-[11px] font-semibold text-way-dim">{q.progStr}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-way-track">
                    <div className={cx('h-full', EASE)} style={{ width: `${q.pct * k}%`, background: tone[2] }} />
                  </div>
                </div>
                {q.done && !q.claimed ? (
                  <button
                    type="button"
                    onClick={() => onClaim(q)}
                    className="whitespace-nowrap rounded-[9px] bg-way-gold px-2.5 py-[7px] text-[11px] font-semibold text-[#1a1300] shadow-[0_0_16px_rgba(250,204,21,.4)]"
                  >
                    Claim {q.xp}
                  </button>
                ) : (
                  <span className={cx('w-[62px] text-right font-mono text-[11px] font-semibold', q.claimed ? 'text-way-protein' : 'text-way-dim')}>
                    {q.claimed ? 'Claimed' : `+${q.xp} XP`}
                  </span>
                )}
              </div>
            );
          })}
        </Card>
      </div>

      {/* Your people: everyone you're connected with, with a direct cheer */}
      {m.friends.length ? (
        <Card className="flex flex-col pb-2 pt-[18px] lg:col-span-12 lg:pt-[22px]">
          <div className="flex items-center justify-between gap-3 px-4 pb-3 lg:px-6">
            <Eyebrow>Your people · {m.friends.length}</Eyebrow>
            <span className="font-mono text-[11px] font-medium text-way-dim">
              {m.cheersInWeek ? `${m.cheersInWeek} cheer${m.cheersInWeek === 1 ? '' : 's'} for you this week` : 'Cheer once a day each'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {m.friends.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border-t border-way-line px-4 py-3 lg:px-6">
                <Avatar person={f.person} size={38} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-semibold lg:text-sm">
                    {displayName(f.person)}
                    {f.person.username ? <span className="font-normal text-way-dim"> @{f.person.username}</span> : null}
                  </span>
                  <span className="truncate text-xs text-way-mute">
                    {f.rels.join(' · ')} · {f.line}
                    {f.cheeredYou ? <span className="text-way-gold"> · cheered you{f.cheeredYou > 1 ? ` ×${f.cheeredYou}` : ''}</span> : null}
                  </span>
                </div>
                {f.canCheer ? (
                  <button
                    type="button"
                    onClick={() => onCheerPerson(f)}
                    aria-pressed={f.cheered}
                    title={f.cheered ? 'Cheered today · tap to undo' : `Cheer ${displayName(f.person)}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[background,color,border-color,transform] duration-200"
                    style={
                      f.cheered
                        ? { background: 'rgba(250,204,21,.14)', color: '#facc15', borderColor: 'rgba(250,204,21,.4)', transform: 'scale(1.04)' }
                        : { color: '#cbd5e1', borderColor: '#253044' }
                    }
                  >
                    <PartyPopper size={13} />
                    {f.cheered ? 'Cheered' : 'Cheer'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenFamily}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-way-line2 px-3 py-1.5 text-xs font-semibold text-way-ink2 hover:bg-way-hover"
                  >
                    View
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Feed */}
      <Card className="flex flex-col pb-2 pt-[18px] lg:col-span-8 lg:pt-[22px]">
        <div className="flex items-center justify-between px-4 pb-3 lg:px-6">
          <Eyebrow>Live feed</Eyebrow>
          <span className="font-mono text-[11px] font-medium text-way-dim">Competitors only · no private data</span>
        </div>
        {m.feed.length ? (
          m.feed.map((e) => {
            const p = m.person(e.personId);
            const Icon = ICONS[e.icon] || PartyPopper;
            return (
              <div key={e.key} className="flex items-center gap-3 border-t border-way-line px-4 py-3 lg:gap-3.5 lg:px-6">
                <Avatar person={p} size={36}>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-way-card" style={{ background: e.iconBg }}>
                    <Icon size={10} className="text-way-page" />
                  </span>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] lg:text-sm">
                    <strong className="font-semibold">{displayName(p)}</strong> {e.text}
                  </span>
                  <span className="font-mono text-[11px] font-medium text-way-dim">{relDay(e.day, m.today)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onCheer(e)}
                  aria-pressed={e.mine}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[background,color,border-color,transform] duration-200"
                  style={
                    e.mine
                      ? { background: 'rgba(250,204,21,.14)', color: '#facc15', borderColor: 'rgba(250,204,21,.4)', transform: 'scale(1.06)' }
                      : { color: '#94a3b8', borderColor: '#253044' }
                  }
                >
                  <PartyPopper size={13} />
                  {e.count}
                </button>
              </div>
            );
          })
        ) : (
          <p className="border-t border-way-line px-6 py-6 text-center text-[13px] text-way-dim">
            Wins from people you compete with show up here: 10k-step days, big climbs, long nights of sleep.
          </p>
        )}
      </Card>

      {/* Badges */}
      <Card className="flex flex-col gap-4 p-[18px] lg:col-span-4 lg:p-[22px]">
        <div className="flex items-center justify-between">
          <Eyebrow>Badges</Eyebrow>
          <span className="font-mono text-[11px] font-medium text-way-dim">
            {m.badges.filter((b) => b.got).length} of {m.badges.length} earned
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {m.badges.map((b) => {
            const Icon = ICONS[b.icon] || Swords;
            return (
              <div
                key={b.id}
                title={b.got ? `${b.label}: earned` : `${b.label}: ${b.prog}`}
                className="flex flex-col items-center gap-[7px] rounded-2xl border px-1.5 py-3"
                style={{ background: b.got ? `${b.color}0d` : 'transparent', borderColor: b.got ? `${b.color}40` : '#1c2433' }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `conic-gradient(${b.color} ${b.p * 360 * k}deg, #1f2937 0)` }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: b.got ? `linear-gradient(${b.color}2e, ${b.color}2e), #0f1420` : '#0f1420' }}>
                    <Icon size={18} style={{ color: b.got ? b.color : '#475569' }} />
                  </div>
                </div>
                <span className="text-center text-[11px] font-semibold" style={{ color: b.got ? '#f1f5f9' : '#7c8aa0' }}>
                  {b.label}
                </span>
                <span className="font-mono text-[10px] font-medium text-way-dim">{b.got ? 'Earned' : b.prog}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

