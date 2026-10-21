'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { addDays } from '@/lib/dateUtils';
import { indexStats, weekStart } from '@/lib/friends';

const isMissingSetup = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST202' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || ''));

/**
 * Everything the Friends screen needs. Every read goes through RLS or the
 * friend_* functions in supabase/add-friends.sql, so only what this user is
 * allowed to see ever arrives here.
 */
export function useFriendsData(userId, today) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState({ loading: true });
  const [nonce, setNonce] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let live = true;
    const ws = weekStart(today);
    const from = addDays(today, -30);
    (async () => {
      const [people, conns, duels, stats, board, claims, views, nudges, cheers, food, blocks, aliases, cheersIn] = await Promise.all([
        supabase.rpc('friend_people'),
        supabase.from('connections').select('*').order('created_at', { ascending: false }),
        supabase.from('duels').select('*').order('created_at', { ascending: false }),
        supabase.rpc('friend_stats', { p_from: from, p_to: today }),
        supabase.rpc('duel_board'),
        supabase.from('quest_claims').select('quest_id, xp, week_start').eq('user_id', userId).eq('week_start', ws),
        supabase.from('share_views').select('viewer_id, fields, viewed_at').eq('owner_id', userId).order('viewed_at', { ascending: false }).limit(50),
        supabase.from('nudges').select('*').eq('to_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('cheers').select('to_id, event_key, created_at').eq('from_id', userId).gte('created_at', `${addDays(today, -7)}T00:00:00Z`),
        supabase.from('food_logs').select('logged_at').eq('user_id', userId).gte('logged_at', from).lte('logged_at', today),
        supabase.from('blocks').select('blocked_id, created_at').eq('blocker_id', userId),
        supabase.from('contact_aliases').select('other_id, alias'),
        // Cheers you received this week (from people you compete with).
        supabase.from('cheers').select('from_id, event_key, created_at').eq('to_id', userId).gte('created_at', `${addDays(today, -7)}T00:00:00Z`),
      ]);
      if (!live) return;
      const firstError = [people, conns, duels, stats].map((r) => r.error).find(Boolean);
      if (firstError) {
        setState({ loading: false, setup: isMissingSetup(firstError), error: firstError.message });
        return;
      }
      setState({
        loading: false,
        people: new Map((people.data || []).map((p) => [p.id, p])),
        connections: conns.data || [],
        duels: duels.data || [],
        stats: indexStats(stats.data || []),
        duelBoard: board.data || [],
        claims: new Set((claims.data || []).map((c) => c.quest_id)),
        views: views.data || [],
        nudges: nudges.data || [],
        cheers: cheers.data || [],
        cheersIn: cheersIn.data || [],
        foodDays: new Set((food.data || []).map((f) => f.logged_at)),
        blocks: blocks.data || [],
        // Missing before the SQL update: just no nicknames.
        aliases: new Map((aliases.data || []).map((a) => [a.other_id, a.alias])),
      });
    })().catch((e) => live && setState({ loading: false, error: e.message || 'Could not load Friends.' }));
    return () => {
      live = false;
    };
  }, [supabase, userId, today, nonce]);

  // Push your own latest numbers (at most every 30 min unless forced), then reload.
  const sync = useCallback(
    async (force = false) => {
      setSyncing(true);
      try {
        const res = await fetch(`/api/friends/sync${force ? '?force=1' : ''}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (data.updated) setNonce((n) => n + 1);
        return data;
      } finally {
        setSyncing(false);
      }
    },
    []
  );
  // Quiet background push on open; the Update button shows progress instead.
  useEffect(() => {
    let live = true;
    fetch('/api/friends/sync', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => live && data?.updated && setNonce((n) => n + 1))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Log that you looked at what people share with you (throttled in the database).
  const recordViews = useCallback(() => supabase.rpc('record_share_views'), [supabase]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, supabase, reload, sync, syncing, recordViews };
}
