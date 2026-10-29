'use client';

import { UserPlus, UserMinus, PartyPopper, Swords, Copy, Check, Hourglass, AtSign, X } from 'lucide-react';
import { FRIEND_LIMIT, displayName, relDay } from '@/lib/friends';
import { Card, Eyebrow, Btn, cx } from '@/components/way/ui';
import { Avatar, FieldChip, ICONS } from './parts';

function LevelPill({ level }) {
  return level ? (
    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-way-line2 bg-way-card px-1.5 py-px font-mono text-[9px] font-semibold leading-tight text-way-ink2">
      LV {level}
    </span>
  ) : null;
}

/**
 * Your friends: the people you race on the leaderboard and in challenges.
 * Up to 4. The header and empty spots say different things depending on
 * whether you have none, are waiting on invites, have room, or are full.
 */
export function FriendsTab({ m, k, copied, onCopy, onAdd, onCheerPerson, onChallenge, onRemove, onReview, onDecline, onCancel, onCheer }) {
  const friends = m.friends.filter((f) => f.canCheer);
  const waiting = m.outgoing.filter((x) => x.kind === 'conn' && x.item.kind === 'compete');
  const requests = m.incoming.filter((x) => x.kind === 'conn' && x.item.kind === 'compete');
  const used = friends.length + waiting.length;
  const slots = Math.max(FRIEND_LIMIT, used);
  const open = Math.max(0, FRIEND_LIMIT - used);
  const full = open === 0;

  const head = !friends.length
    ? waiting.length
      ? { title: `Waiting on ${waiting.map((x) => displayName(x.to)).join(', ')}`, sub: 'They’ll see your invite in their Inbox. Once someone accepts, the Arena opens up.' }
      : { title: 'No friends yet', sub: `Friends are who you race on the leaderboard and in challenges. Up to ${FRIEND_LIMIT}, so it stays personal.` }
    : full
      ? { title: `${friends.length} friend${friends.length === 1 ? '' : 's'}`, sub: `All ${FRIEND_LIMIT} spots are taken. Remove someone to make room.` }
      : {
          title: `${friends.length} friend${friends.length === 1 ? '' : 's'}`,
          sub: `${open} spot${open === 1 ? '' : 's'} left${waiting.length ? ` · ${waiting.length} invite${waiting.length === 1 ? '' : 's'} waiting` : ''}.`,
        };

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
      <Card className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-6 lg:col-span-12">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-heading text-xl font-bold md:text-2xl">{head.title}</span>
          <span className="text-[13px] text-way-mute [text-wrap:pretty]">{head.sub}</span>
          <div className="flex items-center gap-1.5 pt-1" aria-label={`${used} of ${FRIEND_LIMIT} spots used`}>
            {Array.from({ length: slots }, (_, i) => (
              <span
                key={i}
                className={cx('h-1.5 w-8 rounded-full transition-colors duration-500', i < friends.length ? 'bg-way-protein' : i < used ? 'bg-sky-400/60' : 'bg-way-track')}
                style={{ transitionDelay: `${i * 80 * k}ms` }}
              />
            ))}
            <span className="ml-1.5 font-mono text-[11px] text-way-dim">
              {used}/{FRIEND_LIMIT}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
          {m.me.username ? (
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-way-line2 px-3.5 py-2.5 text-[13px] text-way-ink2 transition-colors hover:bg-way-hover"
              title="Friends add you by this exact username"
            >
              <AtSign size={14} />
              {m.me.username}
              {copied ? <Check size={13} className="text-way-protein" /> : <Copy size={13} className="text-way-dim" />}
            </button>
          ) : null}
          <Btn variant="primary" onClick={onAdd} disabled={full}>
            <UserPlus size={14} />
            {full ? 'All spots taken' : 'Add a friend'}
          </Btn>
        </div>
      </Card>

      {requests.map((x) => (
        <Card key={`req-${x.item.id}`} className="flex flex-col gap-3 border-emerald-400/30 p-4 sm:flex-row sm:items-center lg:col-span-12 lg:px-6">
          <Avatar person={x.from} size={42} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm">
              <strong className="font-semibold">{displayName(x.from)}</strong>
              {x.from?.username ? <span className="text-way-dim"> @{x.from.username}</span> : null} wants to be friends
            </span>
            <div className="flex flex-wrap gap-1">
              {x.item.fields.map((f) => (
                <FieldChip key={f} field={f} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={() => onDecline(x)} className="flex-1 sm:flex-none">
              Decline
            </Btn>
            <Btn variant="primary" onClick={() => onReview(x)} className="flex-1 sm:flex-none">
              Accept…
            </Btn>
          </div>
        </Card>
      ))}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-12 lg:gap-5 xl:grid-cols-4">
        {friends.map((f, i) => {
          const comp = m.competitors.find((c) => c.id === f.id);
          const live = m.ch.running.filter((x) => x.joined.includes(f.id)).length;
          const busy = m.busyWith.get(f.id);
          return (
            <Card key={f.id} className="way-rise flex flex-col gap-3.5 p-4 lg:p-5" style={{ '--d': `${i * 70}ms` }}>
              <div className="flex items-start gap-3">
                <div className="relative mb-1">
                  <Avatar person={f.person} size={48} ring="0 0 0 3px #0f1420, 0 0 0 5px #253044" />
                  <LevelPill level={m.levelOfPerson(f.id)} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{displayName(f.person)}</span>
                  {f.person.username ? <span className="truncate font-mono text-[11px] text-way-dim">@{f.person.username}</span> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(f.person)}
                  aria-label={`Remove ${displayName(f.person)}`}
                  title={`Remove ${displayName(f.person)}`}
                  className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-way-dim transition-colors hover:bg-way-hover hover:text-rose-300"
                >
                  <UserMinus size={15} />
                </button>
              </div>
              <span className="text-xs text-way-mute">
                {f.line}
                {live ? <span className="text-way-over"> · in {live} challenge{live === 1 ? '' : 's'} with you</span> : null}
                {f.cheeredYou ? <span className="text-way-gold"> · cheered you</span> : null}
              </span>
              {comp?.fields?.length ? (
                <div className="flex flex-wrap gap-1">
                  {comp.fields.map((k2) => (
                    <FieldChip key={k2} field={k2} />
                  ))}
                </div>
              ) : null}
              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => onCheerPerson(f)}
                  aria-pressed={f.cheered}
                  title={f.cheered ? 'Cheered today · tap to undo' : `Cheer ${displayName(f.person)}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-[background,color,border-color] duration-200"
                  style={f.cheered ? { background: 'rgba(250,204,21,.14)', color: '#facc15', borderColor: 'rgba(250,204,21,.4)' } : { color: '#cbd5e1', borderColor: '#253044' }}
                >
                  <PartyPopper size={13} />
                  {f.cheered ? 'Cheered' : 'Cheer'}
                </button>
                {busy ? (
                  <span
                    title="One challenge at a time with each person. You can challenge them again when this one ends, or after it’s cancelled."
                    className="flex flex-1 flex-col items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/[.06] px-2 py-1 text-center text-[11px] font-semibold leading-tight text-rose-200"
                  >
                    In a challenge
                    <span className="font-mono text-[10px] font-medium text-way-dim">{busy.phase === 'upcoming' ? 'starts soon' : `until ${busy.span.split(' – ')[1]}`}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChallenge(f.person)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-way-over px-3 py-2 text-xs font-semibold text-[#1a0508]"
                  >
                    <Swords size={13} />
                    Challenge
                  </button>
                )}
              </div>
            </Card>
          );
        })}
        {waiting.map((x) => (
          <Card key={`wait-${x.item.id}`} className="flex flex-col gap-3 border-dashed border-sky-400/30 p-4 lg:p-5">
            <div className="flex items-center gap-3">
              <Avatar person={x.to} size={48} className="opacity-60" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold text-way-ink2">{displayName(x.to)}</span>
                <span className="flex items-center gap-1 text-[11px] text-sky-300">
                  <Hourglass size={11} />
                  Invite sent {relDay(String(x.item.created_at).slice(0, 10), m.today).toLowerCase()}
                </span>
              </div>
            </div>
            <span className="text-xs text-way-dim">Waiting for them to accept. Nothing is shared until they do.</span>
            <Btn variant="outline" size="sm" onClick={() => onCancel(x)} className="mt-auto self-start">
              <X size={13} />
              Cancel invite
            </Btn>
          </Card>
        ))}
        {Array.from({ length: open }, (_, i) => (
          <button
            key={`open-${i}`}
            type="button"
            onClick={onAdd}
            className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-way-line3 p-4 text-way-dim transition-colors hover:border-way-dim hover:bg-way-card hover:text-way-ink2"
          >
            <UserPlus size={20} />
            <span className="text-[13px] font-semibold">{friends.length || waiting.length ? 'Add a friend' : i === 0 ? 'Add your first friend' : 'Open spot'}</span>
            {i === 0 && !friends.length && !waiting.length ? <span className="text-[11px]">by their exact username</span> : null}
          </button>
        ))}
      </div>

      {friends.length ? (
        <Card className="flex flex-col pb-2 pt-[18px] lg:col-span-12 lg:pt-[22px]">
          <div className="flex items-center justify-between px-4 pb-3 lg:px-6">
            <Eyebrow>Friend activity</Eyebrow>
            <span className="font-mono text-[11px] font-medium text-way-dim">last 7 days · one cheer a day each</span>
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
                    aria-disabled={e.locked}
                    title={e.locked ? `You already cheered ${displayName(p)} today` : e.mine ? 'Cheered · tap to undo' : `Cheer ${displayName(p)}`}
                    className={cx(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[background,color,border-color,transform] duration-200',
                      e.locked && 'cursor-not-allowed opacity-45'
                    )}
                    style={e.mine ? { background: 'rgba(250,204,21,.14)', color: '#facc15', borderColor: 'rgba(250,204,21,.4)', transform: 'scale(1.06)' } : { color: '#94a3b8', borderColor: '#253044' }}
                  >
                    <PartyPopper size={13} />
                    {e.count}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="border-t border-way-line px-6 py-6 text-center text-[13px] text-way-dim">
              Nothing yet this week. Big days show up here once friends sync: 10k steps, long walks, high climbs.
            </p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
