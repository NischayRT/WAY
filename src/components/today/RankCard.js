'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, ChevronRight, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { addDays } from '@/lib/dateUtils';
import { FIELDS, COMPETE_KEYS, buildBoard, indexStats, fmtVal, displayName } from '@/lib/friends';
import { Card, Eyebrow, cx } from '@/components/way/ui';
import { Avatar } from '@/components/friends/parts';

/**
 * Your place on this week's Friends leaderboard. Renders nothing unless you
 * compete with at least one person (or before supabase/add-friends.sql runs).
 */
export default function RankCard({ userId, today, className = '' }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(null);

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
    <Card
      rise
      delay={100}
      as={Link}
      href="/friends?tab=arena"
      className={cx('group relative flex items-center gap-4 overflow-hidden p-4 transition-colors hover:bg-way-hover lg:p-5', first && 'border-[rgba(250,204,21,.35)]', className)}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.12),transparent_70%)]" />
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_70%,rgba(250,204,21,.2),#0f1420_75%)] lg:h-16 lg:w-16">
        {first ? <Crown size={26} className="text-way-gold" /> : <Trophy size={24} className="text-way-gold" />}
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Eyebrow>Leaderboard</Eyebrow>
          <span className="font-mono text-[10px] font-medium text-way-dim">
            {f.label} · 7 days
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-brand text-[40px] leading-none text-way-gold lg:text-5xl">{mine ? `#${i + 1}` : '—'}</span>
          <span className="font-mono text-xs font-medium text-way-dim">of {total}</span>
        </div>
        <span className="truncate text-xs text-way-mute">{line}</span>
      </div>
      <div className="relative hidden -space-x-2 sm:flex">
        {ranked.slice(0, 4).map((r) => (
          <Avatar key={r.id} person={person(r.id)} isMe={r.id === userId} size={28} ring="0 0 0 2px #0f1420" />
        ))}
      </div>
      <ChevronRight size={16} className="relative shrink-0 text-way-faint transition-colors group-hover:text-way-ink2" />
    </Card>
  );
}
