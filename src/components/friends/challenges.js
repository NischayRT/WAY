'use client';

import { Timer, Swords, Trophy, Plus, ChevronRight, Smile, Megaphone, Check, Medal, RotateCcw, LogOut, Lock, UserPlus, Sparkles, Hourglass, Crown } from 'lucide-react';
import { FIELDS, fmtVal, displayName } from '@/lib/friends';
import { shortDay, weekdayDay, deadlineOf } from '@/lib/challenges';
import { addDays } from '@/lib/dateUtils';
import { Card, Eyebrow, Btn, Modal, Segmented, cx } from '@/components/way/ui';
import { Avatar, FIELD_ICONS } from './parts';
import Leaderboard, { MEDAL } from './Leaderboard';
import { useState } from 'react';

const EASE = 'transition-[width] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]';
export const nameOf = (m, id) => (id === m.me.id ? 'You' : displayName(m.person(id)));
const listNames = (m, ids, max = 3) => {
  const names = ids.map((id) => nameOf(m, id));
  return names.length > max ? `${names.slice(0, max).join(', ')} +${names.length - max}` : names.join(', ');
};
const statsLabel = (x) => (x.multi ? x.metrics.map((k) => FIELDS[k].label).join(' + ') : x.f.label);
const daysLabel = (n) => `${n} day${n === 1 ? '' : 's'}`;

/** Time until a challenge's first day begins (midnight, India time). */
function startsIn(startsOn, now = new Date()) {
  const ms = deadlineOf(addDays(startsOn, -1)) - now;
  if (ms <= 0) return 'Starting now';
  const h = Math.floor(ms / 3600000);
  const mnt = Math.max(1, Math.floor((ms % 3600000) / 60000));
  return h >= 24 ? `Starts ${shortDay(startsOn)}` : h ? `Starts in ${h}h ${mnt}m` : `Starts in ${mnt}m`;
}

/** One line: where you stand in this challenge. Wording follows its phase. */
export function standing(m, x) {
  if (x.phase === 'upcoming') {
    return `${x.people} in${x.invited.length ? `, ${x.invited.length} yet to answer` : ''}. Day one is ${weekdayDay(x.c.starts_on)}.`;
  }
  const of = x.ranked.length + x.missing.length;
  if (!x.myRank) return x.phase === 'live' ? 'Your numbers show once WAY syncs your day.' : 'No numbers from you for this one.';
  if (x.multi) {
    const won = x.ranked.find((r) => r.id === m.me.id)?.v ?? 0;
    const lead = `${won} of ${x.metrics.length} stats`;
    if (x.phase === 'ended') return x.myRank === 1 ? `You won, taking ${lead}.` : `You finished #${x.myRank} of ${of}, taking ${lead}.`;
    return x.myRank === 1 ? `#1 overall · leading ${lead}` : `#${x.myRank} of ${of} overall · leading ${lead}`;
  }
  const f = x.f;
  if (x.phase === 'ended') return x.myRank === 1 ? (of > 1 ? `You won, out of ${of}.` : 'Nobody else synced.') : `You finished #${x.myRank} of ${of}.`;
  if (x.above) return `#${x.myRank} of ${of} · ${fmtVal(x.above.v - x.myValue, f.dec)} ${f.unit} to pass ${nameOf(m, x.above.id)}`;
  const next = x.ranked[1];
  return next ? `#1 of ${of} · ahead by ${fmtVal(x.myValue - next.v, f.dec)} ${f.unit}` : `#1 of ${of} · waiting for the others to sync`;
}

function StatIcons({ x, size = 14 }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {x.metrics.map((k) => {
        const Icon = FIELD_ICONS[k] || Swords;
        return <Icon key={k} size={size} style={{ color: FIELDS[k].color }} />;
      })}
    </span>
  );
}

/** Compact standings: the top three plus you. Several stats: place per stat. */
function MiniBoard({ m, x, k }) {
  const f = x.f;
  const max = x.ranked[0]?.v || 1;
  const rows = x.ranked.slice(0, 3);
  const meRow = x.ranked.find((r) => r.id === m.me.id);
  if (meRow && !rows.includes(meRow)) rows.push(meRow);
  if (!rows.length) return <span className="text-xs text-way-dim">No numbers yet. The board fills in as people sync.</span>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const isMe = r.id === m.me.id;
        return (
          <div key={r.id} className="flex items-center gap-2">
            <span className="w-4 font-mono text-[11px] font-semibold" style={{ color: r.rank <= 3 ? MEDAL[r.rank - 1] : '#7c8aa0' }}>
              {r.rank}
            </span>
            <Avatar person={m.person(r.id)} isMe={isMe} size={20} />
            <span className={cx('min-w-0 flex-1 truncate text-xs sm:w-[72px] sm:flex-none', isMe ? 'font-semibold text-way-ink' : 'text-way-ink2')}>{nameOf(m, r.id)}</span>
            {x.multi ? (
              <span className="flex flex-1 items-center justify-end gap-1">
                {r.places.map((pl) => (
                  <span
                    key={pl.metric}
                    title={`${FIELDS[pl.metric].label}: ${pl.rank ? `#${pl.rank}` : 'no data'}`}
                    className="flex h-5 min-w-5 items-center justify-center rounded-md px-1 font-mono text-[10px] font-semibold"
                    style={pl.rank === 1 ? { background: FIELDS[pl.metric].color, color: '#090d16' } : { background: `${FIELDS[pl.metric].color}1f`, color: FIELDS[pl.metric].color }}
                  >
                    {pl.rank || '–'}
                  </span>
                ))}
              </span>
            ) : (
              <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-way-track sm:block">
                <div className={cx('h-full rounded-full', EASE)} style={{ width: `${(r.v / max) * 100 * k}%`, background: isMe ? '#34d399' : f.color }} />
              </div>
            )}
            <span className="w-14 text-right font-mono text-[11px] text-way-ink2">{x.multi ? `${r.v}/${x.metrics.length}` : fmtVal(r.v, f.dec)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Head({ x }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold" style={{ color: x.multi ? '#f1f5f9' : x.f.color }}>
        <StatIcons x={x} size={15} />
        <span className="truncate">
          {x.multi ? `${x.metrics.length} stats` : x.f.label} · {daysLabel(x.len)}
        </span>
      </span>
      <span
        className={cx(
          'flex shrink-0 items-center gap-[5px] rounded-full px-[9px] py-1 font-mono text-[11px] font-semibold',
          x.phase === 'live' ? 'bg-rose-400/12 text-way-over' : x.phase === 'upcoming' ? 'bg-sky-400/12 text-sky-300' : 'bg-way-track text-way-ink2'
        )}
      >
        {x.phase === 'live' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-way-over" /> : x.phase === 'upcoming' ? <Hourglass size={12} /> : <Timer size={12} />}
        {x.phase === 'upcoming' ? startsIn(x.c.starts_on) : x.left}
      </span>
    </div>
  );
}

/** A challenge as a tappable row/card. */
function ChallengeTile({ m, x, k, onOpen, className = '' }) {
  return (
    <button type="button" onClick={() => onOpen(x)} className={cx('group flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-way-hover lg:px-[22px]', className)}>
      <Head x={x} />
      {x.phase === 'upcoming' ? (
        <div className="flex items-center gap-1.5">
          {x.joined.map((id) => (
            <Avatar key={id} person={m.person(id)} isMe={id === m.me.id} size={26} ring="0 0 0 2px #0f1420" />
          ))}
          {x.invited.map((id) => (
            <span key={id} className="relative">
              <Avatar person={m.person(id)} size={26} className="opacity-35" />
            </span>
          ))}
        </div>
      ) : (
        <MiniBoard m={m} x={x} k={k} />
      )}
      <span className="flex items-center justify-between gap-2 text-xs text-way-mute">
        <span className="[text-wrap:pretty]">{standing(m, x)}</span>
        <ChevronRight size={14} className="shrink-0 text-way-faint group-hover:text-way-ink2" />
      </span>
    </button>
  );
}

/** Invites to you, answerable in place. */
function InviteRows({ m, onReview, onDecline }) {
  return m.ch.invites.map((x) => {
    const from = m.person(x.creatorId);
    return (
      <div key={`inv-${x.id}`} className="mx-4 flex flex-col gap-2.5 rounded-2xl border border-rose-400/35 bg-rose-400/[.06] p-3 lg:mx-[22px]">
        <div className="flex items-center gap-2.5">
          <Avatar person={from} size={32} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px]">
              <strong className="font-semibold">{displayName(from)}</strong> challenged you
            </span>
            <span className="flex items-center gap-1.5 truncate text-[11px] text-way-mute">
              <StatIcons x={x} size={11} />
              {statsLabel(x)} · {daysLabel(x.len)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" onClick={() => onDecline(x)} className="flex-1">
            Decline
          </Btn>
          <button type="button" onClick={() => onReview(x)} className="h-8 flex-[1.4] rounded-[10px] bg-way-over text-xs font-semibold text-[#1a0508]">
            See and join
          </button>
        </div>
      </div>
    );
  });
}

/** The latest finished challenge as a tiny podium (between challenges). */
function LastResult({ m, x, onOpen, onRematch }) {
  const top = x.ranked.slice(0, 3);
  const order = [1, 0, 2].map((i) => top[i]).filter(Boolean);
  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-2 lg:px-[22px]">
      <button type="button" onClick={() => onOpen(x)} className="flex flex-col gap-3 rounded-2xl border border-way-line bg-way-rail p-3 text-left transition-colors hover:border-way-line3">
        <span className="flex items-center justify-between text-xs text-way-mute">
          <span className="flex items-center gap-1.5">
            <StatIcons x={x} size={12} />
            {statsLabel(x)} · {x.span}
          </span>
          <ChevronRight size={13} />
        </span>
        <div className="flex items-end justify-center gap-3">
          {order.map((r) => {
            const pi = r.rank - 1;
            return (
              <div key={r.id} className="flex flex-col items-center gap-1">
                {r.rank === 1 ? <Crown size={14} className="text-way-gold" /> : null}
                <Avatar person={m.person(r.id)} isMe={r.id === m.me.id} size={r.rank === 1 ? 40 : 32} ring={`0 0 0 2px #0f1420, 0 0 0 4px ${MEDAL[Math.min(pi, 2)]}`} />
                <span className="max-w-[72px] truncate text-[11px] font-semibold">{nameOf(m, r.id)}</span>
                <span
                  className="flex w-14 items-start justify-center rounded-t-md border border-b-0 pt-0.5 font-brand text-base"
                  style={{ height: r.rank === 1 ? 34 : r.rank === 2 ? 26 : 20, color: MEDAL[Math.min(pi, 2)], borderColor: '#253044' }}
                >
                  {r.rank}
                </span>
              </div>
            );
          })}
        </div>
        <span className="text-center text-xs text-way-ink2">{standing(m, x)}</span>
      </button>
      <Btn variant="outline" onClick={() => onRematch(x)} className="w-full">
        <RotateCcw size={14} />
        Rematch
      </Btn>
    </div>
  );
}

/** Quick starts for someone who has never run a challenge. */
export function presetsFor(today) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const toSunday = dow === 0 ? 7 : 7 - dow; // days from tomorrow through Sunday
  return [
    { id: 'week', title: 'Step week', desc: 'Most steps in 7 days', metrics: ['steps'], days: 7, Icon: FIELD_ICONS.steps, color: FIELDS.steps.color },
    {
      id: 'weekend',
      title: toSunday <= 2 ? 'Weekend sprint' : 'Race to Sunday',
      desc: `Distance, ${daysLabel(toSunday)}`,
      metrics: ['distance_km'],
      days: toSunday,
      Icon: FIELD_ICONS.distance_km,
      color: FIELDS.distance_km.color,
    },
    { id: 'all', title: 'All-rounder', desc: 'Steps, distance and burn · 14 days', metrics: ['steps', 'distance_km', 'active_kcal'], days: 14, Icon: Sparkles, color: '#facc15' },
  ];
}

/**
 * The Arena's challenge column. Title, look and wording follow the
 * situation: no friends yet · first challenge · invites · starting soon ·
 * live · between challenges.
 */
export function ChallengePanel({ m, k, onOpen, onNew, onPreset, onAddFriend, onReview, onDecline, onRematch }) {
  const ch = m.ch;
  const noFriends = !m.competitors.length;
  const pendingFriends = m.outgoing.filter((x) => x.kind === 'conn' && x.item.kind === 'compete');
  const latest = ch.finished[0];

  let title;
  let right = null;
  let tone = 'border-way-line';
  if (noFriends) {
    title = 'Challenges';
    right = 'locked';
  } else if (ch.state === 'live') {
    title = ch.live.length === 1 ? 'Live challenge' : `${ch.live.length} live challenges`;
    right = ch.upcoming.length ? `${ch.upcoming.length} starting soon` : 'updates as people sync';
    tone = 'border-rose-400/30';
  } else if (ch.state === 'upcoming') {
    title = ch.upcoming.length === 1 ? 'Starting soon' : `${ch.upcoming.length} starting soon`;
    right = startsIn(ch.upcoming[0].c.starts_on);
    tone = 'border-sky-400/30';
  } else if (ch.state === 'between') {
    title = 'Last challenge';
    right = latest.final ? 'final' : `locks ${shortDay(latest.locksOn)}`;
    tone = 'border-[rgba(250,204,21,.3)]';
  } else {
    title = 'Your first challenge';
    right = 'pick one';
  }
  if (ch.invites.length && !noFriends) tone = 'border-rose-400/40';

  return (
    <Card className={cx('flex flex-col overflow-hidden pt-4 lg:pt-[22px]', tone)}>
      <div className="flex items-center justify-between px-4 pb-3 lg:px-[22px]">
        <Eyebrow>{title}</Eyebrow>
        <span className="font-mono text-[11px] font-medium text-way-dim">{right}</span>
      </div>

      {noFriends ? (
        <div className="flex flex-col gap-3 px-4 pb-4 lg:px-[22px]">
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-way-line2 p-3">
            <Lock size={18} className="shrink-0 text-way-faint" />
            <span className="text-[13px] text-way-mute [text-wrap:pretty]">
              {pendingFriends.length
                ? `Unlocks when ${listNames(m, pendingFriends.map((x) => x.to.id), 2)} accepts your friend invite.`
                : 'A challenge is a race with a finish line: pick friends, stats and a last day. You need a friend first.'}
            </span>
          </div>
          <Btn variant="primary" onClick={onAddFriend}>
            <UserPlus size={14} />
            {pendingFriends.length ? 'Add another friend' : 'Add a friend'}
          </Btn>
        </div>
      ) : (
        <>
          {ch.invites.length ? (
            <div className="flex flex-col gap-2 pb-3">
              <InviteRows m={m} onReview={onReview} onDecline={onDecline} />
            </div>
          ) : null}

          {ch.state === 'live' || ch.state === 'upcoming'
            ? ch.running.slice(0, 3).map((x, i) => <ChallengeTile key={x.id} m={m} x={x} k={k} onOpen={onOpen} className={cx('border-t border-way-line', !i && ch.invites.length === 0 && 'border-t-0')} />)
            : null}
          {ch.running.length > 3 ? <span className="border-t border-way-line px-4 py-2.5 text-xs text-way-dim lg:px-[22px]">+{ch.running.length - 3} more below</span> : null}

          {ch.state === 'between' ? <LastResult m={m} x={latest} onOpen={onOpen} onRematch={onRematch} /> : null}

          {ch.state === 'never' ? (
            <div className="flex flex-col gap-2 px-4 pb-4 lg:px-[22px]">
              <span className="pb-1 text-xs text-way-mute [text-wrap:pretty]">A race with a finish line. Everyone who joins gets a podium when it ends.</span>
              {presetsFor(m.today).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPreset(p)}
                  className="group flex items-center gap-3 rounded-2xl border border-way-line bg-way-rail px-3 py-2.5 text-left transition-colors hover:border-way-line3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${p.color}1f`, color: p.color }}>
                    <p.Icon size={17} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-semibold">{p.title}</span>
                    <span className="truncate text-[11px] text-way-dim">{p.desc}</span>
                  </span>
                  <ChevronRight size={14} className="text-way-faint group-hover:text-way-ink2" />
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onNew}
            className="flex items-center justify-center gap-2 border-t border-way-line px-4 py-3 text-[13px] font-semibold text-way-ink2 transition-colors hover:bg-way-hover"
          >
            <Plus size={15} />
            {ch.state === 'never' ? 'Build your own' : ch.state === 'between' ? 'New challenge' : 'Start another'}
          </button>
        </>
      )}
    </Card>
  );
}

/** Record and past results. Only rendered once there is history. */
export function ChallengeHistory({ m, onOpen, className = '' }) {
  const { record, finished } = m.ch;
  const stats = [
    { v: record.wins, label: 'Won', color: '#facc15', Icon: Trophy },
    { v: record.podiums, label: 'Top 3', color: '#cbd5e1', Icon: Medal },
    { v: record.played, label: 'Finished', color: '#f1f5f9', Icon: Check },
  ];
  return (
    <Card className={cx('flex flex-col overflow-hidden pt-[18px] lg:pt-[22px]', className)}>
      <div className="flex items-center justify-between px-4 pb-3 lg:px-6">
        <Eyebrow>Challenge history</Eyebrow>
        <span className="font-mono text-[11px] font-medium text-way-dim">{record.wins ? `${record.wins} win${record.wins === 1 ? '' : 's'}` : 'no wins yet'}</span>
      </div>
      <div className="grid grid-cols-3 border-y border-way-line">
        {stats.map((s, i) => (
          <div key={s.label} className={cx('flex flex-col gap-0.5 px-4 py-3 lg:px-6', i && 'border-l border-way-line')}>
            <span className="flex items-center gap-1.5 font-mono text-lg font-semibold" style={{ color: s.color }}>
              <s.Icon size={15} />
              {s.v}
            </span>
            <span className="text-[11px] text-way-dim">{s.label}</span>
          </div>
        ))}
      </div>
      {finished.map((x, i) => {
        const winner = x.ranked[0];
        const placeColor = x.myRank && x.myRank <= 3 ? MEDAL[x.myRank - 1] : '#7c8aa0';
        return (
          <button
            key={x.id}
            type="button"
            onClick={() => onOpen(x)}
            className={cx('group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-way-hover lg:px-6', i && 'border-t border-way-line')}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-brand text-xl"
              style={{ color: placeColor, borderColor: `${placeColor}55`, background: `${placeColor}12` }}
            >
              {x.myRank || '–'}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                <StatIcons x={x} size={13} />
                <span className="truncate">
                  {statsLabel(x)} · {x.span}
                </span>
              </span>
              <span className="truncate text-xs text-way-mute">
                {winner
                  ? `${winner.id === m.me.id ? 'You' : displayName(m.person(winner.id))} won · ${x.multi ? `${winner.v} of ${x.metrics.length} stats` : `${fmtVal(winner.v, x.f.dec)} ${x.f.unit}`}`
                  : 'No numbers'}
                {' · '}
                {x.people} people
              </span>
            </div>
            <span className="hidden items-center gap-1 font-mono text-[11px] text-way-dim sm:flex">
              {x.final ? <Lock size={11} /> : null}
              {x.final ? 'Final' : `Locks ${shortDay(x.locksOn)}`}
            </span>
            <ChevronRight size={15} className="shrink-0 text-way-faint group-hover:text-way-ink2" />
          </button>
        );
      })}
    </Card>
  );
}

/* ================================ DETAIL / RESULTS ================================ */

export function ChallengeSheet({ m, x, k, sent, onClose, onNudge, onLeave, onCancel, onRematch }) {
  const [view, setView] = useState('overall');
  const board = view === 'overall' ? { ranked: x.ranked, missing: x.missing, f: x.f } : x.boards.find((b) => b.metric === view) || x.boards[0];
  const ended = x.phase === 'ended';
  const winner = x.ranked[0];
  const meRow = x.ranked.find((r) => r.id === m.me.id);
  const idx = meRow ? x.ranked.indexOf(meRow) : -1;
  const below = idx >= 0 ? x.ranked[idx + 1] : null;
  const nudges = x.phase === 'live' && meRow ? [x.above && { to: x.above.id, kind: 'rally' }, below && { to: below.id, kind: 'taunt' }].filter(Boolean) : [];
  const what = x.multi && view === 'overall' ? 'Overall: most stats won, then the better average place' : `Only ${board.f.label.toLowerCase()} for these days is compared`;
  const note = ended
    ? x.final
      ? `Final results · ${what}`
      : `Results lock on ${shortDay(x.locksOn)} so late syncs still count · ${what}`
    : `${what} · numbers update when each person opens WAY (at most every 30 min)${board.f.agg === 'avg' ? ' · sleep is an average per night' : ''}`;

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={
        <span className="flex items-center gap-2">
          {ended ? <Trophy size={18} className="text-way-gold" /> : <Swords size={18} className="text-way-over" />}
          {ended ? 'Challenge results' : x.phase === 'upcoming' ? 'Challenge starting soon' : 'Live challenge'}
        </span>
      }
      subtitle={`${statsLabel(x)} · ${x.span} · ${daysLabel(x.len)}`}
      footer={
        <>
          {ended ? (
            <Btn variant="outline" onClick={() => onRematch(x)} className="mr-auto">
              <RotateCcw size={14} />
              Rematch
            </Btn>
          ) : x.isCreator && x.phase === 'upcoming' ? (
            <Btn variant="dangerOutline" onClick={() => onCancel(x)} className="mr-auto">
              Call it off
            </Btn>
          ) : x.status === 'joined' ? (
            <Btn variant="outline" onClick={() => onLeave(x)} className="mr-auto">
              <LogOut size={14} />
              Leave
            </Btn>
          ) : null}
          <Btn variant="primary" onClick={onClose}>
            Done
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {ended && winner ? (
          <div className="way-pop flex items-center gap-3 rounded-2xl border border-[rgba(250,204,21,.3)] bg-[rgba(250,204,21,.06)] px-4 py-3">
            <Trophy size={22} className="shrink-0 text-way-gold" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{winner.id === m.me.id ? 'You won this one!' : `${displayName(m.person(winner.id))} wins`}</span>
              <span className="text-xs text-way-mute">{standing(m, x)}</span>
            </div>
          </div>
        ) : null}
        {x.phase === 'live' ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-way-rail px-4 py-3">
            <span className="text-[13px] text-way-ink2">{standing(m, x)}</span>
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-semibold text-way-over">
              <Timer size={13} />
              {x.left}
            </span>
          </div>
        ) : null}
        {x.phase === 'upcoming' ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-sky-400/25 bg-sky-400/[.05] px-4 py-4">
            <span className="flex items-center gap-2 font-mono text-sm font-semibold text-sky-300">
              <Hourglass size={15} />
              {startsIn(x.c.starts_on)}
            </span>
            <span className="text-[13px] text-way-ink2 [text-wrap:pretty]">
              {standing(m, x)} It ends at 11:59 pm on {weekdayDay(x.c.ends_on)}. The board fills in as people sync.
            </span>
            <div className="flex flex-wrap gap-2">
              {x.joined.map((id) => (
                <span key={id} className="flex items-center gap-1.5 rounded-full border border-way-line2 py-1 pl-1 pr-2.5 text-xs">
                  <Avatar person={m.person(id)} isMe={id === m.me.id} size={20} />
                  {nameOf(m, id)}
                  <Check size={11} className="text-way-protein" />
                </span>
              ))}
              {x.invited.map((id) => (
                <span key={id} className="flex items-center gap-1.5 rounded-full border border-dashed border-way-line2 py-1 pl-1 pr-2.5 text-xs text-way-dim">
                  <Avatar person={m.person(id)} size={20} className="opacity-50" />
                  {nameOf(m, id)} · invited
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
            {x.multi ? (
              <Segmented
                size="sm"
                className="self-start overflow-x-auto rounded-xl bg-way-rail p-[3px]"
                value={view}
                onChange={setView}
                options={[{ value: 'overall', label: 'Overall' }, ...x.metrics.map((k2) => ({ value: k2, label: FIELDS[k2].label }))]}
              />
            ) : null}
            <div key={view} className="overflow-hidden rounded-2xl border border-way-line">
              <Leaderboard m={m} ranked={board.ranked} missing={board.missing} f={board.f} k={k} note={note} />
            </div>
          </>
        )}
        {nudges.length ? (
          <div className="flex flex-wrap gap-2">
            {nudges.map((n) => {
              const key = `ch:${x.id}:${n.to}:${n.kind}`;
              const done = sent.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={done}
                  onClick={() => onNudge(x, n.to, n.kind, key)}
                  className="flex items-center gap-1.5 rounded-[10px] border border-way-line2 px-3 py-2 text-xs text-way-ink2 transition-colors hover:bg-way-hover disabled:opacity-60"
                >
                  {done ? <Check size={13} /> : n.kind === 'taunt' ? <Smile size={13} /> : <Megaphone size={13} />}
                  {done ? 'Sent' : n.kind === 'taunt' ? `Taunt ${displayName(m.person(n.to))}` : `Rally against ${displayName(m.person(n.to))}`}
                </button>
              );
            })}
          </div>
        ) : null}
        {x.invited.length && x.phase === 'live' ? (
          <p className="text-xs text-way-dim">Still to answer: {listNames(m, x.invited, 4)}. They can join until it ends, and every day counts.</p>
        ) : null}
      </div>
    </Modal>
  );
}
