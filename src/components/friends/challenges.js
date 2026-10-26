'use client';

import { Timer, Swords, Trophy, Plus, ChevronRight, Smile, Megaphone, Check, Medal, Users, RotateCcw, LogOut, Lock } from 'lucide-react';
import { fmtVal, displayName } from '@/lib/friends';
import { shortDay, weekdayDay } from '@/lib/challenges';
import { Card, Eyebrow, Btn, Modal, cx } from '@/components/way/ui';
import { Avatar, FIELD_ICONS } from './parts';
import Leaderboard, { MEDAL } from './Leaderboard';

const EASE = 'transition-[width] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]';
const nameOf = (m, id) => (id === m.me.id ? 'You' : displayName(m.person(id)));
const listNames = (m, ids, max = 3) => {
  const names = ids.map((id) => nameOf(m, id));
  return names.length > max ? `${names.slice(0, max).join(', ')} +${names.length - max}` : names.join(', ');
};

/** One line under a challenge: where you stand. */
export function standing(m, x) {
  const f = x.f;
  if (x.phase === 'upcoming') {
    return `${x.people} in${x.invited.length ? ` · ${x.invited.length} still to answer` : ''}. Day one is ${weekdayDay(x.c.starts_on)}.`;
  }
  if (!x.myRank) return x.phase === 'live' ? 'Your numbers show once WAY syncs your day.' : 'No numbers from you for this one.';
  const of = x.ranked.length + x.missing.length;
  if (x.phase === 'ended') {
    if (x.myRank === 1) return of > 1 ? `You won, out of ${of}.` : 'Nobody else synced.';
    return `You finished #${x.myRank} of ${of}.`;
  }
  if (x.above) return `#${x.myRank} of ${of} · ${fmtVal(x.above.v - x.myValue, f.dec)} ${f.unit} to pass ${nameOf(m, x.above.id)}`;
  const next = x.ranked[1];
  return next ? `#1 of ${of} · ahead by ${fmtVal(x.myValue - next.v, f.dec)} ${f.unit}` : `#1 of ${of} · waiting for the others to sync`;
}

/** Compact standings: the top three plus you. */
function MiniBoard({ m, x, k }) {
  const f = x.f;
  const max = x.ranked[0]?.v || 1;
  const rows = x.ranked.slice(0, 3);
  const meRow = x.ranked.find((r) => r.id === m.me.id);
  if (meRow && !rows.includes(meRow)) rows.push(meRow);
  if (!rows.length) return <span className="text-xs text-way-dim">No numbers yet.</span>;
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
            <span className={cx('w-[72px] truncate text-xs', isMe ? 'font-semibold text-way-ink' : 'text-way-ink2')}>{nameOf(m, r.id)}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-way-track">
              <div className={cx('h-full rounded-full', EASE)} style={{ width: `${(r.v / max) * 100 * k}%`, background: isMe ? '#34d399' : f.color }} />
            </div>
            <span className="w-14 text-right font-mono text-[11px] text-way-ink2">{fmtVal(r.v, f.dec)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Head({ x }) {
  const Icon = FIELD_ICONS[x.metric] || Swords;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold" style={{ color: x.f.color }}>
        <Icon size={15} className="shrink-0" />
        <span className="truncate">
          {x.f.label} · {x.len} day{x.len === 1 ? '' : 's'}
        </span>
      </span>
      <span
        className={cx(
          'flex shrink-0 items-center gap-[5px] rounded-full px-[9px] py-1 font-mono text-[11px] font-semibold',
          x.phase === 'live' ? 'bg-rose-400/12 text-way-over' : 'bg-way-track text-way-ink2'
        )}
      >
        {x.phase === 'live' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-way-over" /> : <Timer size={12} />}
        {x.left}
      </span>
    </div>
  );
}

/** A running challenge as a tappable card. */
function ChallengeTile({ m, x, k, onOpen, className = '', bare = false }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(x)}
      className={cx(
        'group flex w-full flex-col gap-3 text-left transition-colors',
        bare ? 'px-4 py-4 hover:bg-way-hover lg:px-[22px]' : 'rounded-[18px] border border-way-line bg-way-rail p-4 hover:border-way-line3',
        className
      )}
    >
      <Head x={x} />
      {x.phase === 'upcoming' ? (
        <div className="flex items-center gap-1.5">
          {x.joined.slice(0, 7).map((id) => (
            <Avatar key={id} person={m.person(id)} isMe={id === m.me.id} size={24} ring="0 0 0 2px #0f1420" />
          ))}
          {x.invited.slice(0, 7).map((id) => (
            <Avatar key={id} person={m.person(id)} size={24} className="opacity-40" />
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

/** Arena side panel: every running challenge's board, live. */
export function LivePanel({ m, k, onOpen, onNew, onInvites }) {
  const running = m.ch.running;
  return (
    <Card className="flex flex-col overflow-hidden border-rose-400/25 lg:pt-[22px]">
      <div className="flex items-center justify-between px-4 pb-1 pt-4 lg:px-[22px] lg:pb-2 lg:pt-0">
        <Eyebrow>Live challenges</Eyebrow>
        <span className="font-mono text-[11px] font-medium text-way-dim">
          {m.ch.record.live} live{running.length > m.ch.record.live ? ` · ${running.length - m.ch.record.live} soon` : ''}
        </span>
      </div>
      {m.ch.invites.length ? (
        <button
          type="button"
          onClick={onInvites}
          className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/8 px-3 py-2 text-left text-xs text-rose-200 lg:mx-[22px]"
        >
          <Swords size={13} />
          <span className="flex-1">
            {m.ch.invites.length} challenge invite{m.ch.invites.length === 1 ? '' : 's'} waiting
          </span>
          <ChevronRight size={13} />
        </button>
      ) : null}
      {running.slice(0, 3).map((x, i) => (
        <ChallengeTile key={x.id} m={m} x={x} k={k} onOpen={onOpen} bare className={i ? 'border-t border-way-line' : ''} />
      ))}
      {running.length > 3 ? <span className="border-t border-way-line px-4 py-2.5 text-xs text-way-dim lg:px-[22px]">+{running.length - 3} more in Challenges</span> : null}
      {!running.length ? (
        <p className="px-4 py-3 text-[13px] text-way-dim [text-wrap:pretty] lg:px-[22px]">
          No challenge running. Pick friends, one stat and a deadline. The board shows up here while it runs.
        </p>
      ) : null}
      <button
        type="button"
        onClick={onNew}
        className="flex items-center justify-center gap-2 border-t border-way-line px-4 py-3 text-[13px] font-semibold text-way-ink2 transition-colors hover:bg-way-hover"
      >
        <Plus size={15} />
        Start a challenge
      </button>
    </Card>
  );
}

/* ================================ TAB ================================ */

export function ChallengesTab({ m, k, onOpen, onNew, onReview, onDecline }) {
  const { record, running, finished, invites } = m.ch;
  const stats = [
    { v: String(record.wins), label: 'Won', color: '#facc15', Icon: Trophy },
    { v: String(record.podiums), label: 'Top 3 finishes', color: '#cbd5e1', Icon: Medal },
    { v: String(record.played), label: 'Finished', color: '#f1f5f9', Icon: Check },
    { v: String(record.live), label: 'Live now', color: '#fb7185', Icon: Timer },
  ];
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
      <div className="grid grid-cols-4 gap-2 lg:col-span-12 lg:gap-0 lg:rounded-[22px] lg:border lg:border-way-line lg:bg-way-card">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cx(
              'flex flex-col items-center gap-0.5 rounded-2xl border border-way-line bg-way-card px-1 py-3 text-center lg:items-start lg:gap-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-6 lg:py-5 lg:text-left',
              i && 'lg:border-l lg:border-way-line'
            )}
          >
            <span className="order-2 text-[10px] leading-tight text-way-dim lg:order-1 lg:text-xs">{s.label}</span>
            <span className="order-1 flex items-center gap-2 font-mono text-xl font-semibold lg:order-2 lg:text-[26px]" style={{ color: s.color }}>
              <s.Icon size={18} className="hidden lg:block" />
              {s.v}
            </span>
          </div>
        ))}
      </div>

      {invites.map((x) => {
        const from = m.person(x.creatorId);
        const others = [...x.joined, ...x.invited].filter((id) => id !== m.me.id && id !== x.creatorId);
        return (
          <Card key={`inv-${x.id}`} className="flex flex-col gap-3 border-rose-400/35 p-4 md:flex-row md:items-center md:gap-[18px] md:p-6 lg:col-span-12">
            <Avatar person={from} size={52} className="hidden md:flex" />
            <div className="flex flex-1 flex-col gap-1">
              <span className="font-heading text-[11px] font-bold tracking-[0.14em] text-way-over">CHALLENGE WAITING</span>
              <span className="text-sm md:text-[15px]">
                <strong className="font-semibold">{displayName(from)}</strong> challenged you: {x.f.label.toLowerCase()} for {x.len} day{x.len === 1 ? '' : 's'}
              </span>
              <span className="text-xs text-way-dim">
                {x.span}
                {others.length ? ` · with ${listNames(m, others)}` : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => onDecline(x)} className="flex-1 md:flex-none">
                Decline
              </Btn>
              <button type="button" onClick={() => onReview(x)} className="flex-[1.4] rounded-xl bg-way-over px-[18px] py-3 text-[13px] font-semibold text-[#1a0508] md:flex-none">
                Review
              </button>
            </div>
          </Card>
        );
      })}

      {running.length ? (
        <section className="flex flex-col gap-3 lg:col-span-12">
          <Eyebrow className="px-0.5">Running</Eyebrow>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {running.map((x) => (
              <Card key={x.id} className="overflow-hidden" style={{ borderColor: x.phase === 'live' ? 'rgba(251,113,133,.3)' : undefined }}>
                <ChallengeTile m={m} x={x} k={k} onOpen={onOpen} bare />
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={onNew}
        className="flex items-center justify-center gap-2 rounded-[22px] border border-dashed border-way-line3 p-[18px] text-sm font-semibold text-way-ink2 transition-colors hover:border-way-dim hover:bg-way-card lg:col-span-12 lg:gap-3 lg:p-6 lg:text-base"
      >
        <Swords size={18} />
        Start a challenge
        <span className="hidden text-[13px] font-normal text-way-dim lg:inline">· pick friends, one stat and a deadline</span>
      </button>

      {finished.length ? (
        <section className="flex flex-col gap-3 lg:col-span-12">
          <Eyebrow className="px-0.5">Results</Eyebrow>
          <Card className="overflow-hidden">
            {finished.map((x, i) => {
              const Icon = FIELD_ICONS[x.metric] || Swords;
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
                      <Icon size={13} style={{ color: x.f.color }} />
                      <span className="truncate">
                        {x.f.label} · {x.span}
                      </span>
                    </span>
                    <span className="truncate text-xs text-way-mute">
                      {winner ? `${winner.id === m.me.id ? 'You' : displayName(m.person(winner.id))} won · ${fmtVal(winner.v, x.f.dec)} ${x.f.unit}` : 'No numbers'}
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
        </section>
      ) : null}

      {!running.length && !finished.length && !invites.length ? (
        <Card className="flex flex-col items-center gap-2.5 border-dashed border-way-line2 px-5 py-8 text-center lg:col-span-12">
          <Users size={22} className="text-way-faint" />
          <span className="text-sm font-semibold text-way-ink2">No challenges yet</span>
          <span className="max-w-[380px] text-xs text-way-dim [text-wrap:pretty]">
            Challenge up to 6 friends to steps, distance, burn, floors or sleep, for a day or up to 30. When it ends, everyone gets the final podium.
          </span>
        </Card>
      ) : null}
    </div>
  );
}

/* ================================ DETAIL / RESULTS ================================ */

export function ChallengeSheet({ m, x, k, sent, onClose, onNudge, onLeave, onCancel, onRematch }) {
  const f = x.f;
  const ended = x.phase === 'ended';
  const winner = x.ranked[0];
  const meRow = x.ranked.find((r) => r.id === m.me.id);
  const idx = meRow ? x.ranked.indexOf(meRow) : -1;
  const below = idx >= 0 ? x.ranked[idx + 1] : null;
  const nudges = x.phase === 'live' && meRow ? [x.above && { to: x.above.id, kind: 'rally' }, below && { to: below.id, kind: 'taunt' }].filter(Boolean) : [];
  const note = ended
    ? x.final
      ? `Final results · ${x.span} · only ${f.label.toLowerCase()} for these days was compared`
      : `Results lock on ${shortDay(x.locksOn)} so late syncs still count · only ${f.label.toLowerCase()} for these days is compared`
    : `Only ${f.label.toLowerCase()} for these days is compared · numbers update when each person opens WAY (at most every 30 min)${f.agg === 'avg' ? ' · sleep is an average per night' : ''}`;

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={
        <span className="flex items-center gap-2">
          {ended ? <Trophy size={18} className="text-way-gold" /> : <Swords size={18} className="text-way-over" />}
          {ended ? 'Challenge results' : `${f.label} challenge`}
        </span>
      }
      subtitle={`${f.label} · ${x.span} · ${x.len} day${x.len === 1 ? '' : 's'}`}
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
              <span className="text-sm font-semibold">
                {winner.id === m.me.id ? 'You won this one!' : `${displayName(m.person(winner.id))} wins`}
              </span>
              <span className="text-xs text-way-mute">{standing(m, x)}</span>
            </div>
          </div>
        ) : null}
        {!ended && x.phase === 'live' ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-way-rail px-4 py-3">
            <span className="text-[13px] text-way-ink2">{standing(m, x)}</span>
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-semibold text-way-over">
              <Timer size={13} />
              {x.left}
            </span>
          </div>
        ) : null}
        {x.phase === 'upcoming' ? (
          <p className="rounded-2xl bg-way-rail px-4 py-3 text-[13px] text-way-ink2 [text-wrap:pretty]">
            {standing(m, x)} The board fills in as people sync. It ends at 11:59 pm on {weekdayDay(x.c.ends_on)}.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-way-line">
            <Leaderboard m={m} ranked={x.ranked} missing={x.missing} f={f} k={k} note={note} />
          </div>
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
        {x.invited.length && !ended ? (
          <p className="text-xs text-way-dim">
            Still to answer: {listNames(m, x.invited, 6)}. They can join until it ends, and every day counts.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
