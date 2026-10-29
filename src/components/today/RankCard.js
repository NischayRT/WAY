'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, ChevronRight, Crown, X } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { fmtVal, displayName } from '@/lib/friends';
import { buildChallenges, indexBoard } from '@/lib/challenges';
import { cx } from '@/components/way/ui';
import { Avatar } from '@/components/friends/parts';

// Slides in, counts down for 9 seconds (hover pauses) and tucks away; tap it
// to open the Arena.
/**
 * Home banner: where you stand in a live challenge. People are compared only
 * inside challenges they joined, so with no live challenge there's nothing
 * to show and the banner stays hidden.
 */
export default function RankCard({ userId, today, className = '' }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const [challenges, members] = await Promise.all([
        supabase.from('challenges').select('*').gte('ends_on', today).lte('starts_on', today).eq('status', 'open'),
        supabase.from('challenge_members').select('challenge_id, user_id, status, invited_at, responded_at, result_seen'),
      ]);
      if (challenges.error || !challenges.data?.length) return;
      // Bring your own numbers up to date (throttled server-side), then read.
      await fetch('/api/friends/sync', { method: 'POST' }).catch(() => {});
      const [people, board] = await Promise.all([supabase.rpc('friend_people'), supabase.rpc('challenge_board')]);
      if (!live || people.error || board.error) return;
      const ch = buildChallenges({ challenges: challenges.data, members: members.data || [], board: indexBoard(board.data || []), meId: userId, today });
      const x = ch.live.find((c) => c.status === 'joined' && c.ranked.length > 1) || ch.live.find((c) => c.status === 'joined');
      if (x) setData({ x, people: new Map((people.data || []).map((p) => [p.id, p])) });
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [supabase, userId, today]);

  if (!data) return null;
  const { x } = data;
  const person = (id) => data.people.get(id) || { id };
  const ranked = x.ranked;
  const i = ranked.findIndex((r) => r.id === userId);
  const mine = ranked[i];
  const ahead = i > 0 ? ranked[i - 1] : null;
  const behind = i >= 0 ? ranked[i + 1] : null;
  const total = ranked.length + x.missing.length;
  const first = i === 0 && ranked.length > 1;
  const f = x.f;
  const what = x.multi ? `${x.metrics.length}-stat` : f.label.toLowerCase();
  const gap = (a, b) => (x.multi ? `${a.v - b.v} stat${a.v - b.v === 1 ? '' : 's'}` : `${fmtVal(a.v - b.v, f.dec)} ${f.unit}`);

  const line = !mine
    ? 'Your numbers show up once WAY syncs your day.'
    : ahead
      ? `${gap(ahead, mine)} behind ${displayName(person(ahead.id))} · ${x.left}`
      : behind
        ? `${gap(mine, behind)} ahead of ${displayName(person(behind.id))} · ${x.left}`
        : `Waiting for the others to sync · ${x.left}`;

  return (
    <div
      className={cx('grid transition-[grid-template-rows,opacity,margin] duration-500 ease-out', gone ? 'pointer-events-none -mb-3.5 grid-rows-[0fr] opacity-0 lg:-mb-5' : 'grid-rows-[1fr] opacity-100', className)}
      role="status"
    >
      <div className="min-h-0 overflow-hidden">
        <div className="way-drop group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[rgba(250,204,21,.3)] bg-[linear-gradient(90deg,rgba(250,204,21,.10),rgba(15,20,32,1)_55%)] py-2.5 pl-3 pr-2 lg:gap-4 lg:py-3 lg:pl-4">
          <Link href="/compete?tab=arena" className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15">
              {first ? <Crown size={18} className="text-way-gold" /> : <Trophy size={17} className="text-way-gold" />}
            </span>
            <span className="font-brand text-[28px] leading-none text-way-gold">{mine ? `#${i + 1}` : '—'}</span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold">
                of {total} in your {what} challenge
              </span>
              <span className="truncate text-xs text-way-mute">{line}</span>
            </span>
            <span className="ml-auto hidden -space-x-2 sm:flex">
              {ranked.slice(0, 4).map((r) => (
                <Avatar key={r.id} person={person(r.id)} isMe={r.id === userId} size={24} ring="0 0 0 2px #0f1420" />
              ))}
            </span>
            <ChevronRight size={16} className="shrink-0 text-way-faint transition-colors group-hover:text-way-ink2" />
          </Link>
          <button type="button" onClick={() => setGone(true)} aria-label="Dismiss" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-way-dim hover:bg-way-hover hover:text-way-ink">
            <X size={15} />
          </button>
          {/* Countdown: hovering pauses it; when it runs out the banner tucks away. */}
          <span
            className="way-countdown absolute bottom-0 left-0 h-[2px] bg-way-gold/70 group-hover:[animation-play-state:paused]"
            onAnimationEnd={() => setGone(true)}
          />
        </div>
      </div>
    </div>
  );
}
