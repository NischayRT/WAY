'use client';

import { Crown, UserPlus, Swords, Check, LayoutGrid, ChevronRight, Trophy, Plus, Hourglass } from 'lucide-react';
import { FIELDS, COMPETE_KEYS, PERIODS, FRIEND_LIMIT, fmtVal, displayName } from '@/lib/friends';
import { Card, Eyebrow, Btn, Segmented, cx } from '@/components/way/ui';
import { Avatar, FIELD_ICONS, ICONS } from './parts';
import Leaderboard from './Leaderboard';
import { ChallengePanel, ChallengeHistory } from './challenges';

const EASE = 'transition-[width] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]';
const PERIOD_LABEL = { today: 'today', week: '7 days', month: '30 days' };


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

/** Every stat at once. Tap a stat to open its board. */
function AllBoards({ m, period, setMetric, k }) {
  const keys = COMPETE_KEYS.filter((key) => m.competitors.some((c) => c.fields.includes(key)));
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
    </div>
  );
}

/** No friends yet: what the Arena is, and the way in. */
function ArenaWelcome({ m, onAdd, onOpenFriends }) {
  const waiting = m.outgoing.filter((x) => x.kind === 'conn' && x.item.kind === 'compete');
  const slots = Array.from({ length: FRIEND_LIMIT }, (_, i) => waiting[i] || null);
  return (
    <Card className="relative flex flex-col gap-6 overflow-hidden px-5 py-8 lg:px-10 lg:py-12">
      <div className="pointer-events-none absolute left-1/2 top-[-80px] h-[280px] w-[460px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.10),transparent_70%)]" />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="font-heading text-[11px] font-bold tracking-[0.16em] text-way-gold">{waiting.length ? 'ALMOST THERE' : 'THE ARENA'}</span>
        <span className="font-heading text-2xl font-bold md:text-[28px]">
          {waiting.length ? `Waiting for ${waiting.map((x) => displayName(x.to)).join(' and ')}` : 'Compete with up to 4 friends'}
        </span>
        <span className="max-w-[460px] text-sm text-way-mute [text-wrap:pretty]">
          {waiting.length
            ? 'Your invite is in their Inbox. The moment someone accepts, your leaderboard and challenges open here.'
            : 'Add a friend by their exact username. Once they accept, you race them two ways:'}
        </span>
      </div>
      <div className="relative flex justify-center gap-3">
        {slots.map((x, i) =>
          x ? (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Avatar person={x.to} size={52} className="opacity-70" ring="0 0 0 3px #0f1420, 0 0 0 5px rgba(56,189,248,.5)" />
              <span className="flex items-center gap-1 text-[11px] text-sky-300">
                <Hourglass size={10} />
                invited
              </span>
            </div>
          ) : (
            <button
              key={i}
              type="button"
              onClick={onAdd}
              aria-label="Add a friend"
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-way-line3 text-way-dim transition-colors hover:border-way-dim hover:text-way-ink2"
            >
              <Plus size={18} />
            </button>
          )
        )}
      </div>
      {!waiting.length ? (
        <div className="relative grid gap-3 sm:grid-cols-2">
          {[
            [Trophy, '#facc15', 'Leaderboard', 'Always on. You and every friend, ranked for today, 7 days or 30 days on the stats you agree on.'],
            [Swords, '#fb7185', 'Challenges', 'A race with a finish line. Pick friends, stats and a last day. Everyone who joined gets the podium at the end.'],
          ].map(([Icon, color, title, text]) => (
            <div key={title} className="flex gap-3 rounded-2xl border border-way-line bg-way-rail p-4">
              <Icon size={18} style={{ color }} className="mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{title}</span>
                <span className="text-xs text-way-mute [text-wrap:pretty]">{text}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="relative flex flex-wrap justify-center gap-2">
        <Btn variant="primary" onClick={onAdd}>
          <UserPlus size={14} />
          {waiting.length ? 'Add another friend' : 'Add your first friend'}
        </Btn>
        {waiting.length ? (
          <Btn variant="outline" onClick={onOpenFriends}>
            Manage invites
          </Btn>
        ) : null}
      </div>
    </Card>
  );
}

/** Friends, but nobody else has numbers yet: no fake "#1 of 1". */
function WarmingUp({ m, period, k }) {
  const key = 'steps';
  const days = PERIOD_LABEL[period];
  const people = [m.me.id, ...m.competitors.map((c) => c.id)];
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex flex-col gap-1.5 px-5 pb-4 pt-6 lg:px-8 lg:pt-8">
        <span className="font-heading text-[11px] font-bold tracking-[0.16em] text-sky-300">LEADERBOARD WARMING UP</span>
        <span className="font-heading text-xl font-bold md:text-2xl">Rankings start when a friend’s numbers arrive</span>
        <span className="text-[13px] text-way-mute [text-wrap:pretty]">
          Each person’s numbers come in when they open WAY (at most every 30 minutes). Until then there’s no one to rank against, so nobody is #1 yet.
        </span>
      </div>
      <div className="border-t border-way-line">
        {people.map((id, i) => {
          const isMe = id === m.me.id;
          const v = m.board(key, period).ranked.find((r) => r.id === id)?.v ?? null;
          return (
            <div key={id} className={cx('way-in-right flex items-center gap-3 px-5 py-3 lg:px-8', i && 'border-t border-way-line')} style={{ '--d': `${i * 90 * k}ms` }}>
              <Avatar person={m.person(id)} isMe={isMe} size={34} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{isMe ? 'You' : displayName(m.person(id))}</span>
              {v != null ? (
                <span className="flex items-center gap-2 font-mono text-xs text-way-ink2">
                  <Check size={13} className="text-way-protein" />
                  {fmtVal(v)} steps · {days}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-way-dim">
                  <Hourglass size={12} />
                  waiting for first sync
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * The Arena: everything competitive in one place. The main card is the
 * always-on leaderboard (or what to do before there is one); the side
 * column is challenges, worded for the situation you're in.
 */
export function ArenaTab({ m, metric, setMetric, period, setPeriod, k, onClaim, onAdd, onOpenFriends, panel }) {
  const hasFriends = m.competitors.length > 0;
  const shared = COMPETE_KEYS.filter((key) => m.competitors.some((c) => c.fields.includes(key)));
  const othersRanked = shared.some((key) => ['today', 'week', 'month'].some((p) => m.board(key, p).ranked.some((r) => r.id !== m.me.id)));
  const ready = hasFriends && othersRanked;
  const all = metric === 'all' || !shared.includes(metric);
  const f = all ? null : FIELDS[metric];
  const board = all ? null : m.board(metric, period);
  const ranked = board?.ranked || [];
  const people = board ? ranked.length + board.missing.length : 0;

  // Your rank (one stat) or standings (all stats)
  let rankCard = null;
  if (ready && !all) {
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
  } else if (ready) {
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

  const progress = (
    <div className={cx('grid grid-cols-1 gap-3.5 lg:gap-5', !m.ch.hasHistory && 'md:grid-cols-2')}>
        <Card className="flex flex-col overflow-hidden pt-[18px] lg:pb-2 lg:pt-[22px]">
          <div className="flex items-center justify-between px-4 pb-3 lg:px-[22px]">
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

        {/* Badges */}
        <Card className="flex flex-col gap-4 p-[18px] lg:p-[22px]">
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
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:items-start lg:gap-5">
      {/* Main column: the leaderboard (or what comes before it), then history.
          Below 1024px both columns dissolve into one flow. */}
      <div className="contents lg:col-span-8 lg:flex lg:flex-col lg:gap-5">
      {!hasFriends ? (
        <ArenaWelcome m={m} onAdd={onAdd} onOpenFriends={onOpenFriends} />
      ) : !ready ? (
        <WarmingUp m={m} period={period} k={k} />
      ) : (
        <>
          <div className="flex flex-col gap-3.5 lg:hidden">
            {chips}
            {periods}
          </div>
          <Card className="relative flex flex-col overflow-hidden">
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
                <Leaderboard m={m} ranked={ranked} missing={board.missing} f={f} k={k} />
              )}
            </div>
            <div className="hidden border-t border-way-line px-6 pb-4 pt-3 text-[11px] text-way-dim lg:block">
              Leaderboard · always on · only stats you both agreed on are compared · numbers update when each person opens WAY (at most every 30 min)
              {f?.agg === 'avg' ? ' · sleep is an average per night' : ''}
            </div>
          </Card>
        </>
      )}

        {m.ch.hasHistory ? <ChallengeHistory m={m} onOpen={panel.onOpen} /> : progress}
      </div>
      {/* Side column. Below 1024px its cards join the page flow, with
          challenges first: they're the most time-sensitive thing here. */}
      <div className="contents lg:col-span-4 lg:flex lg:flex-col lg:gap-5">
        <div className={cx(m.ch.invites.length || m.ch.state === 'live' ? 'order-first' : '', 'lg:order-none')}>
          <ChallengePanel m={m} k={k} onAddFriend={onAdd} {...panel} />
        </div>
        {rankCard}
        {m.ch.hasHistory ? progress : null}
      </div>

    </div>
  );
}
