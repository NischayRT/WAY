/**
 * lib/challenges.js
 * Pure helpers for timed challenges: you invite 1 to 6 friends to one stat
 * for 1 to 30 days. Inputs are rows the database already allowed this user
 * to see (supabase/challenges-2026-10.sql).
 */

import { addDays } from './dateUtils';
import { FIELDS, aggregate } from './friends';

export const CHALLENGE_LENGTHS = [1, 3, 7, 14, 30];
export const MAX_CHALLENGE_DAYS = 30;
export const MAX_CHALLENGE_PEOPLE = 6;

export const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** A challenge ends at 11:59 pm India time on its last day. */
export const deadlineOf = (endsOn) => new Date(`${endsOn}T23:59:59+05:30`);

export function timeLeft(endsOn, now = new Date()) {
  const ms = deadlineOf(endsOn) - now;
  if (ms <= 0) return 'Ended';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.max(1, Math.floor((ms % 3600000) / 60000));
  if (d >= 1) return `${d}d ${h}h left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export const shortDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const weekdayDay = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** challenge_board() rows -> Map(challengeId -> Map(userId -> Map(day -> value))) */
export function indexBoard(rows = []) {
  const out = new Map();
  for (const r of rows) {
    if (r.value == null) continue;
    if (!out.has(r.challenge_id)) out.set(r.challenge_id, new Map());
    const c = out.get(r.challenge_id);
    if (!c.has(r.user_id)) c.set(r.user_id, new Map());
    c.get(r.user_id).set(r.day, Number(r.value));
  }
  return out;
}

/** Days in a row with activity, ending on `last` (today may still be empty). */
export function streakOf(byDay, from, last, todayMayBeEmpty = false) {
  if (!byDay) return 0;
  let d = last;
  if (todayMayBeEmpty && !(byDay.get(d) > 0)) d = addDays(d, -1);
  let n = 0;
  while (d >= from && byDay.get(d) > 0) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

/** Highest first; equal values share a rank (1, 2, 2, 4). */
function rankBy(rows, key) {
  const sorted = rows.filter((r) => r[key] != null).sort((a, b) => b[key] - a[key]);
  const ranks = new Map();
  sorted.forEach((r, i) => ranks.set(r.id, i > 0 && sorted[i - 1][key] === r[key] ? ranks.get(sorted[i - 1].id) : i + 1));
  return { sorted, ranks };
}

/**
 * Everything the screens need about each challenge you're part of.
 * phase: 'upcoming' (starts tomorrow or later) · 'live' · 'ended'.
 */
export function buildChallenges({ challenges = [], members = [], board = new Map(), results = [], meId, today, now = new Date(), blockedIds = new Set() }) {
  const byCh = new Map();
  for (const r of members) {
    if (!byCh.has(r.challenge_id)) byCh.set(r.challenge_id, []);
    byCh.get(r.challenge_id).push(r);
  }
  const resultsBy = new Map();
  for (const r of results) {
    if (!resultsBy.has(r.challenge_id)) resultsBy.set(r.challenge_id, new Map());
    resultsBy.get(r.challenge_id).set(r.user_id, r);
  }

  const out = [];
  for (const c of challenges) {
    if (c.status !== 'open') continue;
    const rows = (byCh.get(c.id) || []).filter((r) => r.user_id === meId || !blockedIds.has(r.user_id));
    const mine = rows.find((r) => r.user_id === meId);
    if (!mine) continue;
    const f = FIELDS[c.metric];
    if (!f) continue;
    const joined = rows.filter((r) => r.status === 'joined').map((r) => r.user_id);
    const invited = rows.filter((r) => r.status === 'invited').map((r) => r.user_id);
    const phase = today < c.starts_on ? 'upcoming' : today <= c.ends_on ? 'live' : 'ended';
    const len = dayDiff(c.starts_on, c.ends_on) + 1;
    const final = !!c.finalized_at;

    let ranked = [];
    if (mine.status === 'joined' && final) {
      const res = resultsBy.get(c.id) || new Map();
      ranked = joined
        .map((id) => {
          const r = res.get(id);
          const v = r?.total == null ? null : Number(r.total);
          return { id, v, rank: r?.rank ?? null, move: r?.rank && r?.prev_rank ? r.prev_rank - r.rank : 0, streak: r?.streak ?? 0 };
        })
        .filter((r) => r.v != null)
        .sort((a, b) => a.rank - b.rank || b.v - a.v);
    } else if (mine.status === 'joined' && phase !== 'upcoming') {
      const last = phase === 'live' ? today : c.ends_on;
      const prevLast = addDays(last, -1);
      const per = board.get(c.id);
      const rows2 = joined.map((id) => {
        const byDay = per?.get(id);
        return {
          id,
          v: aggregate(byDay, c.metric, c.starts_on, last),
          pv: prevLast >= c.starts_on ? aggregate(byDay, c.metric, c.starts_on, prevLast) : null,
          streak: streakOf(byDay, c.starts_on, last, phase === 'live'),
        };
      });
      const now_ = rankBy(rows2, 'v');
      const prev = rankBy(rows2, 'pv');
      ranked = now_.sorted.map((r) => {
        const rank = now_.ranks.get(r.id);
        const was = prev.ranks.get(r.id);
        return { id: r.id, v: r.v, rank, move: was ? was - rank : 0, streak: r.streak };
      });
    }
    const missing = mine.status === 'joined' && phase !== 'upcoming' ? joined.filter((id) => !ranked.some((r) => r.id === id)) : [];
    const meRow = ranked.find((r) => r.id === meId);
    const above = meRow ? ranked[ranked.indexOf(meRow) - 1] || null : null;

    out.push({
      id: c.id,
      c,
      f,
      metric: c.metric,
      phase,
      len,
      final,
      status: mine.status,
      seen: !!mine.result_seen,
      isCreator: c.creator_id === meId,
      creatorId: c.creator_id,
      joined,
      invited,
      ranked,
      missing,
      myRank: meRow?.rank ?? null,
      myValue: meRow?.v ?? null,
      above,
      people: joined.length,
      left: phase === 'upcoming' ? (c.starts_on === addDays(today, 1) ? 'Starts tomorrow' : `Starts ${shortDay(c.starts_on)}`) : phase === 'live' ? timeLeft(c.ends_on, now) : 'Ended',
      span: `${shortDay(c.starts_on)} – ${shortDay(c.ends_on)}`,
      locksOn: addDays(c.ends_on, 2),
    });
  }

  const mineJoined = out.filter((x) => x.status === 'joined');
  const running = mineJoined
    .filter((x) => x.phase !== 'ended')
    .sort((a, b) => (a.phase === b.phase ? (a.c.ends_on < b.c.ends_on ? -1 : 1) : a.phase === 'live' ? -1 : 1));
  const finished = mineJoined.filter((x) => x.phase === 'ended').sort((a, b) => (a.c.ends_on < b.c.ends_on ? 1 : -1));
  const invites = out.filter((x) => x.status === 'invited' && x.phase !== 'ended');
  const counted = finished.filter((x) => x.ranked.length > 1 && x.myRank);
  const record = {
    played: finished.length,
    wins: counted.filter((x) => x.myRank === 1).length,
    podiums: counted.filter((x) => x.myRank <= 3).length,
    live: running.filter((x) => x.phase === 'live').length,
  };
  // The newest finished challenge you haven't looked at yet: shown once.
  const unseen = finished.find((x) => !x.seen && (x.ranked.length || x.missing.length)) || null;
  return { all: out, running, finished, invites, record, unseen };
}
