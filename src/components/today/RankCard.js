'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, ChevronRight, Crown, X } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { addDays } from '@/lib/dateUtils';
import { FIELDS, COMPETE_KEYS, buildBoard, indexStats, fmtVal, displayName } from '@/lib/friends';
import { cx } from '@/components/way/ui';
import { Avatar } from '@/components/friends/parts';

/**
 * A short-lived banner with your place on this week's Friends leaderboard.
 * Slides in, counts down for 9 seconds (hover pauses) and tucks away; tap it
 * to open the Arena. Renders nothing unless you compete with someone.
 */
export default function RankCard({ userId, today, className = '' }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data: conns, error } = await supabase.from('connections').select('owner_id, other_id, fields').eq('kind', 'compete').eq('status', 'active');
      if (error || !conns?.length) return;
      // Bring your own numbers up to date (throttled server-side), then read.
      await fetch('/api/friends/sync', { method: 'POST' }).catch(() => {});
      const [people, stats] = await Promise.all([
        supabase.rpc('friend_people'),
        supabase.rpc('friend_stats', { p_from: addDays(today, -13), p_to: today }),
      ]);
      if (!live || people.error || stats.error) return;
      setData({
        competitors: conns.map((c) => ({ id: c.owner_id === userId ? c.other_id : c.owner_id, fields: c.fields })),
        people: new Map((people.data || []).map((p) => [p.id, p])),
        stats: indexStats(stats.data || []),
      });
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [supabase, userId, today]);

  if (!data) return null;
  const metric = COMPETE_KEYS.find((key) => data.competitors.some((c) => c.fields.includes(key)));
  if (!metric) return null;
  const f = FIELDS[metric];
  const { ranked } = buildBoard({ meId: userId, competitors: data.competitors, stats: data.stats, metric, period: 'week', today });
  const total = Math.max(ranked.length, 1 + data.competitors.filter((c) => c.fields.includes(metric)).length);
  const i = ranked.findIndex((r) => r.id === userId);
  const mine = ranked[i];
  const ahead = i > 0 ? ranked[i - 1] : null;
  const behind = i >= 0 ? ranked[i + 1] : null;
  const person = (id) => data.people.get(id) || { id };
  const first = i === 0 && ranked.length > 1;

  const line = !mine
    ? 'Your numbers show up once WAY syncs your day.'
    : ahead
      ? `${fmtVal(ahead.v - mine.v, f.dec)} ${f.unit} behind ${displayName(person(ahead.id))}`
      : behind
        ? `${fmtVal(mine.v - behind.v, f.dec)} ${f.unit} ahead of ${displayName(person(behind.id))}`
        : 'Waiting for your friends to sync.';

  return (
    <div
      className={cx('grid transition-[grid-template-rows,opacity,margin] duration-500 ease-out', gone ? 'pointer-events-none -mb-3.5 grid-rows-[0fr] opacity-0 lg:-mb-5' : 'grid-rows-[1fr] opacity-100', className)}
      role="status"
    >
      <div className="min-h-0 overflow-hidden">
        <div className="way-drop group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[rgba(250,204,21,.3)] bg-[linear-gradient(90deg,rgba(250,204,21,.10),rgba(15,20,32,1)_55%)] py-2.5 pl-3 pr-2 lg:gap-4 lg:py-3 lg:pl-4">
          <Link href="/friends?tab=arena" className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15">
              {first ? <Crown size={18} className="text-way-gold" /> : <Trophy size={17} className="text-way-gold" />}
            </span>
            <span className="font-brand text-[28px] leading-none text-way-gold">{mine ? `#${i + 1}` : '—'}</span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold">
                of {total} in {f.label.toLowerCase()} this week
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
