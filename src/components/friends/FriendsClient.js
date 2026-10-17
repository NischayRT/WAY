'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, UserPlus, Flame, Swords, Trophy, AtSign, Database, Sparkles, Users } from 'lucide-react';
import { addDays } from '@/lib/dateUtils';
import {
  FIELDS,
  fmtVal,
  displayName,
  levelOf,
  seasonInfo,
  buildBoard,
  buildFeed,
  QUESTS,
  questProgress,
  logStreak,
  badgesFor,
  aggregate,
} from '@/lib/friends';
import { PAGE, Card, Eyebrow, Btn, Modal, useMounted, useToast, cx } from '@/components/way/ui';
import PageSkeleton from '@/components/way/PageSkeleton';
import { useFriendsData } from './useFriendsData';
import ConnectDialog from './ConnectDialog';
import { Avatar } from './parts';
import { DuelsTab, FamilyTab, InboxTab, PrivacyTab } from './tabs';
import { ArenaTab } from './arena';

const TABS = [
  { key: 'arena', label: 'Arena' },
  { key: 'duels', label: 'Duels' },
  { key: 'family', label: 'Family' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'privacy', label: 'Privacy' },
];
const RENAME_DAYS = 30;
const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const isActiveShare = (c, now) => c.kind === 'share' && c.status === 'active' && (!c.ends_at || new Date(c.ends_at) > now);

/** Mean of the days that have a value in [from, to]; 'last' fields give the latest. */
function dailyValue(byDay, field, from, to) {
  if (!byDay) return null;
  if (FIELDS[field].agg === 'last') return aggregate(byDay, field, from, to);
  const vals = [...byDay].filter(([d, v]) => d >= from && d <= to && v != null).map(([, v]) => v);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Turns the raw rows into everything the tabs render. */
export function buildModel({ d, userId, profile, today, cheerFlip, sent }) {
  const now = new Date();
  const person = (id) => {
    const base = d.people.get(id) || (id === userId ? { id, username: profile.username, full_name: profile.full_name } : { id });
    const alias = id !== userId ? d.aliases?.get(id) : null;
    return alias ? { ...base, alias } : base;
  };
  const me = { ...person(userId), id: userId };
  const other = (c) => (c.owner_id === userId ? c.other_id : c.owner_id);
  const blockedIds = new Set(d.blocks.map((b) => b.blocked_id));
  const season = seasonInfo(today, now);
  const ws = season.weekStart;

  const competitors = d.connections
    .filter((c) => c.kind === 'compete' && c.status === 'active' && !blockedIds.has(other(c)))
    .map((c) => ({ id: other(c), fields: c.fields }));

  // Shared with me
  const sharesIn = d.connections
    .filter((c) => isActiveShare(c, now) && c.other_id === userId && !blockedIds.has(c.owner_id))
    .map((conn) => {
      const owner = person(conn.owner_id);
      const u = d.stats.get(conn.owner_id);
      const sparkField = ['steps', 'sleep_hours', 'distance_km', 'active_kcal', 'floors', 'weight_kg', 'calories_in', 'protein_g', 'resting_hr'].find(
        (f) => conn.fields.includes(f)
      );
      let spark = null;
      let trendStr = '';
      if (sparkField) {
        const byDay = u?.get(sparkField);
        const vals = Array.from({ length: 14 }, (_, i) => byDay?.get(addDays(today, i - 13)) ?? null);
        const max = Math.max(0, ...vals.filter((v) => v != null));
        if (max > 0) {
          spark = vals.map((v) => ({ h: v == null ? 4 : Math.max(4, (v / max) * 100) }));
          const avg = (a) => {
            const xs = a.filter((v) => v != null);
            return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
          };
          const prev = avg(vals.slice(0, 7));
          const cur = avg(vals.slice(7));
          if (prev && cur != null) {
            const pct = Math.round(((cur - prev) / prev) * 100);
            trendStr = `${pct > 0 ? '+' : ''}${pct}% vs prior week`;
          }
        }
      }
      const stats = conn.fields.slice(0, 4).map((field) => {
        const v = dailyValue(u?.get(field), field, addDays(today, -6), today);
        return { field, v: fmtVal(v, FIELDS[field].dec), unit: FIELDS[field].agg === 'last' ? FIELDS[field].unit : `${FIELDS[field].unit}/day` };
      });
      let alert = null;
      if (conn.fields.includes('steps')) {
        const recent = dailyValue(u?.get('steps'), 'steps', addDays(today, -2), today);
        const before = dailyValue(u?.get('steps'), 'steps', addDays(today, -9), addDays(today, -3));
        if (recent != null && before && recent <= before * 0.75) {
          alert = `${displayName(owner)}’s steps are down ${Math.round((1 - recent / before) * 100)}% the last few days. A quick check-in might help.`;
        }
      }
      return {
        conn,
        owner,
        meta: [owner.username ? `@${owner.username}` : null, conn.ends_at ? `until ${shortDate(conn.ends_at)}` : 'no end date'].filter(Boolean).join(' · '),
        chip: conn.label || `${conn.fields.length} item${conn.fields.length === 1 ? '' : 's'}`,
        spark,
        sparkField,
        trendStr,
        stats,
        alert,
        checked: sent.has(`share:${conn.id}`),
      };
    });

  // What I share
  const weekViews = d.views.filter((v) => String(v.viewed_at).slice(0, 10) >= ws);
  const sharesOut = d.connections
    .filter((c) => isActiveShare(c, now) && c.owner_id === userId)
    .map((conn) => {
      const n = weekViews.filter((v) => v.viewer_id === conn.other_id).length;
      const left = conn.ends_at ? Math.ceil((new Date(conn.ends_at) - now) / 86400000) : null;
      return {
        conn,
        viewer: person(conn.other_id),
        views: n ? `Viewed ${n} time${n === 1 ? '' : 's'} this week` : 'Not viewed this week',
        expires: conn.ends_at ? `Ends ${shortDate(conn.ends_at)}` : 'No end date',
        expColor: left != null && left <= 7 ? '#fbbf24' : '#64748b',
      };
    });

  // Pending invites both ways
  const incoming = [
    ...d.duels.filter((x) => x.status === 'pending' && x.opponent_id === userId).map((item) => ({ kind: 'duel', item, from: person(item.challenger_id) })),
    ...d.connections.filter((c) => c.status === 'pending' && c.initiated_by !== userId).map((item) => ({ kind: 'conn', item, from: person(other(item)) })),
  ].sort((a, b) => (a.item.created_at < b.item.created_at ? 1 : -1));
  const outgoing = [
    ...d.duels.filter((x) => x.status === 'pending' && x.challenger_id === userId).map((item) => ({ kind: 'duel', item, to: person(item.opponent_id) })),
    ...d.connections.filter((c) => c.status === 'pending' && c.initiated_by === userId).map((item) => ({ kind: 'conn', item, to: person(other(item)) })),
  ].sort((a, b) => (a.item.created_at < b.item.created_at ? 1 : -1));

  // Duels
  const totals = new Map(d.duelBoard.map((r) => [`${r.duel_id}:${r.user_id}`, Number(r.total) || 0]));
  const allDuels = d.duels
    .filter((x) => x.status === 'active')
    .map((duel) => {
      const themId = duel.challenger_id === userId ? duel.opponent_id : duel.challenger_id;
      const finished = duel.ends_on < today;
      const started = duel.starts_on <= today;
      const len = daysBetween(duel.starts_on, duel.ends_on) + 1;
      const left = finished ? 'Ended' : !started ? `Starts ${shortDate(duel.starts_on)}` : `${daysBetween(today, duel.ends_on) + 1}d left`;
      return {
        duel,
        them: person(themId),
        you: totals.get(`${duel.id}:${userId}`) || 0,
        theirs: totals.get(`${duel.id}:${themId}`) || 0,
        finished,
        started,
        span: `${len} days`,
        left,
        nudged: sent.has(`duel:${duel.id}`),
      };
    });
  const record = { w: 0, l: 0, d: 0 };
  for (const x of allDuels.filter((x) => x.finished)) {
    if (x.you > x.theirs) record.w += 1;
    else if (x.you < x.theirs) record.l += 1;
    else record.d += 1;
  }
  const duels = allDuels
    .filter((x) => !x.finished || x.duel.ends_on >= addDays(today, -7))
    .sort((a, b) => Number(a.finished) - Number(b.finished) || (a.duel.ends_on < b.duel.ends_on ? -1 : 1));

  // Quests
  const myCheers = new Map(d.cheers.map((c) => [c.event_key, c]));
  for (const [key, on] of cheerFlip) {
    if (on && !myCheers.has(key)) myCheers.set(key, { event_key: key, created_at: now.toISOString() });
    if (!on) myCheers.delete(key);
  }
  const cheeredThisWeek = [...myCheers.values()].filter((c) => String(c.created_at).slice(0, 10) >= ws).length;
  const mine = d.stats.get(userId);
  const prog = questProgress({ mine, foodDays: d.foodDays, cheeredThisWeek, ws, today });
  const quests = QUESTS.map((q) => {
    const v = prog[q.id] || 0;
    return {
      ...q,
      claimed: d.claims.has(q.id),
      done: v >= q.goal,
      pct: Math.min(100, (v / q.goal) * 100),
      progStr: q.id === 'steps' ? `${fmtVal(Math.min(v, q.goal))} / ${fmtVal(q.goal)}` : `${Math.min(v, q.goal)} / ${q.goal}`,
    };
  });

  const foodStreak = logStreak(d.foodDays, today);
  const badges = badgesFor({ mine, foodStreak, duelWins: record.w, today });
  const feed = buildFeed({ competitors, stats: d.stats, today });

  const connectedIds = new Set([
    ...d.connections.filter((c) => c.status === 'active').map(other),
    ...d.duels.filter((x) => x.status === 'active' || x.status === 'pending').map((x) => (x.challenger_id === userId ? x.opponent_id : x.challenger_id)),
  ]);
  const connectedPeople = [...connectedIds].filter((id) => !blockedIds.has(id)).map(person);
  const circle = (kind) =>
    new Set(d.connections.filter((c) => c.kind === kind && ['pending', 'active'].includes(c.status) && (kind === 'compete' || !c.ends_at || new Date(c.ends_at) > now)).map(other)).size;
  const friendCount = circle('compete');
  const familyCount = circle('share');

  const changed = profile.username_changed_at ? String(profile.username_changed_at).slice(0, 10) : null;
  const waitDays = changed ? RENAME_DAYS - daysBetween(changed, today) : 0;
  const canRename = waitDays <= 0;

  const stepsBoard = buildBoard({ meId: userId, competitors, stats: d.stats, metric: 'steps', period: 'week', today });
  const seasonRank = stepsBoard.ranked.findIndex((r) => r.id === userId) + 1;

  return {
    me,
    today,
    person,
    levelOfPerson: (id) => levelOf(person(id).xp || 0).level,
    board: (metric, period) => buildBoard({ meId: userId, competitors, stats: d.stats, metric, period, today }),
    competitors,
    season,
    quests,
    feed,
    myCheerKeys: new Set(myCheers.keys()),
    badges,
    record,
    duels,
    incoming,
    outgoing,
    nudges: d.nudges.filter((n) => !blockedIds.has(n.from_id)).slice(0, 8),
    sharesIn,
    sharesOut,
    views: d.views,
    connectedPeople,
    friendCount,
    familyCount,
    blocked: d.blocks.map((b) => person(b.blocked_id)),
    canRename,
    renameHint: canRename ? 'You can change it once every 30 days.' : `You can change it again in ${waitDays} day${waitDays === 1 ? '' : 's'}.`,
    foodStreak,
    seasonRank: seasonRank > 0 ? `#${seasonRank} of ${stepsBoard.ranked.length}` : '—',
  };
}

function OpenDataDialog({ share, stats, today, onClose }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const u = stats.get(share.conn.owner_id);
  return (
    <Modal open onClose={onClose} title={`${displayName(share.owner)}’s data`} subtitle="Daily numbers they chose to share · last 14 days" width={640}>
      <div className="no-scrollbar -mx-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wider text-way-dim">
              <th className="px-1 py-2 font-medium">Day</th>
              {share.conn.fields.map((f) => (
                <th key={f} className="px-1 py-2 text-right font-medium" style={{ color: FIELDS[f].color }}>
                  {FIELDS[f].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className="border-t border-way-line">
                <td className="whitespace-nowrap px-1 py-2 text-xs text-way-mute">{shortDate(`${day}T00:00:00`)}</td>
                {share.conn.fields.map((f) => {
                  const v = u?.get(f)?.get(day);
                  return (
                    <td key={f} className={cx('px-1 py-2 text-right font-mono text-xs', v == null ? 'text-way-faint' : 'text-way-ink')}>
                      {v == null ? '—' : fmtVal(v, FIELDS[f].dec)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

/** Your private nickname for someone. Only you ever see it. */
function AliasDialog({ person, supabase, onClose, onDone }) {
  const [v, setV] = useState(person.alias || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const save = async (value) => {
    setBusy(true);
    setErr(null);
    const name = value.trim().slice(0, 24);
    const { error } = name
      ? await supabase.from('contact_aliases').upsert({ other_id: person.id, alias: name, updated_at: new Date().toISOString() }, { onConflict: 'owner_id,other_id' })
      : await supabase.from('contact_aliases').delete().eq('other_id', person.id);
    setBusy(false);
    if (error) return setErr(/contact_aliases/.test(error.message) ? 'Run the latest supabase/add-friends.sql to use nicknames.' : error.message);
    onDone(name ? `Saved as “${name}”` : 'Nickname removed');
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Nickname"
      subtitle={`For @${person.username || 'them'} · only you can see it`}
      footer={
        <>
          {person.alias ? (
            <Btn variant="outline" onClick={() => save('')} disabled={busy} className="mr-auto">
              Remove
            </Btn>
          ) : null}
          <Btn variant="primary" onClick={() => save(v)} disabled={busy || !v.trim()} className="md:ml-auto">
            {busy ? 'Saving…' : 'Save'}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <input
          autoFocus
          value={v}
          maxLength={24}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && v.trim() && save(v)}
          placeholder="e.g. Mom, Coach Ravi, Gym buddy"
          className="h-11 rounded-xl border border-way-line2 bg-way-rail px-3.5 text-[15px] text-way-ink outline-none placeholder:text-way-faint focus:border-way-faint"
        />
        {err ? <p className="text-[13px] text-rose-300">{err}</p> : null}
      </div>
    </Modal>
  );
}

function ConfirmDialog({ cf, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={cf.title}
      footer={
        <>
          <Btn variant="outline" onClick={onClose} className="md:ml-auto">
            Keep
          </Btn>
          <Btn
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await cf.run();
              setBusy(false);
            }}
          >
            {busy ? 'Working…' : cf.cta}
          </Btn>
        </>
      }
    >
      <p className="text-[13px] text-way-ink2 [text-wrap:pretty]">{cf.text}</p>
    </Modal>
  );
}

export default function FriendsClient({ userId, today, profile, initialTab = 'arena' }) {
  const router = useRouter();
  const d = useFriendsData(userId, today);
  const k = useMounted() ? 1 : 0;
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState(TABS.some((t) => t.key === initialTab) ? initialTab : 'arena');
  const [metric, setMetric] = useState('all');
  const [period, setPeriod] = useState('week');
  const [md, setMd] = useState(null);
  const [cf, setCf] = useState(null);
  const [openData, setOpenData] = useState(null);
  const [aliasFor, setAliasFor] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(() => new Set());
  const [cheerFlip, setCheerFlip] = useState(() => new Map());
  const [counts, setCounts] = useState({});

  const ready = !d.loading && !d.error && d.people;
  const m = useMemo(
    () => (ready ? buildModel({ d, userId, profile, today, cheerFlip, sent }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, d.people, d.connections, d.duels, d.stats, d.duelBoard, d.claims, d.views, d.nudges, d.cheers, d.foodDays, d.blocks, d.aliases, userId, profile, today, cheerFlip, sent]
  );

  // Cheer totals for the events in the feed.
  const feedKeys = m ? m.feed.map((e) => e.key).join('|') : '';
  const { supabase, recordViews } = d;
  useEffect(() => {
    if (!feedKeys) return;
    let live = true;
    supabase.rpc('cheer_counts', { p_keys: feedKeys.split('|') }).then(({ data }) => {
      if (live && data) setCounts(Object.fromEntries(data.map((r) => [r.event_key, r.n])));
    });
    return () => {
      live = false;
    };
  }, [supabase, feedKeys]);

  // Opening Family logs a view on what others share with you.
  const hasSharesIn = !!m?.sharesIn.length;
  useEffect(() => {
    if (tab === 'family' && hasSharesIn) recordViews();
  }, [tab, hasSharesIn, recordViews]);

  // Keys 1-5 switch tabs, like a game menu.
  const dialogOpen = !!(md || cf || openData || aliasFor);
  useEffect(() => {
    const onKey = (e) => {
      if (dialogOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < TABS.length) setTab(TABS[i].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen]);

  if (d.loading) return <PageSkeleton variant="split" />;

  if (d.setup || d.error) {
    return (
      <main className={PAGE}>
        <h1 className="font-heading text-[28px] font-bold md:text-[34px]">Friends</h1>
        <Card className="flex max-w-[620px] flex-col gap-3 p-6">
          <Database size={22} className="text-way-kcal" />
          <span className="text-base font-semibold">{d.setup ? 'Friends needs a one-time database update' : 'Friends could not load'}</span>
          <span className="text-[13px] text-way-mute [text-wrap:pretty]">
            {d.setup ? (
              <>
                Run <code className="rounded bg-way-track px-1.5 py-0.5 font-mono text-xs text-way-ink2">supabase/add-friends.sql</code> in the Supabase SQL
                editor, then reload this page.
              </>
            ) : (
              d.error
            )}
          </span>
          {!d.setup ? (
            <Btn variant="outline" onClick={d.reload} className="self-start">
              Try again
            </Btn>
          ) : null}
        </Card>
      </main>
    );
  }

  const feed = m.feed.map((e) => {
    const serverMine = d.cheers.some((c) => c.event_key === e.key);
    const mine = m.myCheerKeys.has(e.key);
    return { ...e, mine, count: Math.max(0, (counts[e.key] || 0) + (mine === serverMine ? 0 : mine ? 1 : -1)) };
  });
  const model = { ...m, feed };
  const lv = levelOf(m.me.xp || 0);

  const done = (message) => {
    setMd(null);
    showToast(message);
    d.reload();
    router.refresh();
  };
  const rpc = async (fn, args, ok, after) => {
    const { data, error } = await d.supabase.rpc(fn, args);
    if (error) {
      showToast(/duplicate|unique/i.test(error.message) ? 'Already sent today' : error.message, null, 'error');
      return { error };
    }
    if (ok) showToast(typeof ok === 'function' ? ok(data) : ok);
    if (after !== false) d.reload();
    return { data };
  };

  const onCheer = async (e) => {
    const next = !e.mine;
    setCheerFlip((prev) => new Map(prev).set(e.key, next));
    const { error } = await rpc('toggle_cheer', { p_to: e.personId, p_key: e.key }, null, false);
    if (error) setCheerFlip((prev) => new Map(prev).set(e.key, !next));
  };
  const onClaim = (q) => rpc('claim_quest', { p_quest: q.id }, (xp) => `+${xp || q.xp} XP · ${q.label}`);
  const markSent = (key) => setSent((prev) => new Set(prev).add(key));
  const onNudge = async (x, kind) => {
    const { error } = await rpc('send_nudge', { p_to: x.them.id, p_kind: kind, p_duel: x.duel.id }, kind === 'taunt' ? 'Taunt sent' : 'Rally sent', false);
    if (!error || /duplicate|unique/i.test(error.message)) markSent(`duel:${x.duel.id}`);
  };
  const onCheckIn = async (s) => {
    const { error } = await rpc('send_nudge', { p_to: s.owner.id, p_kind: 'check_in', p_duel: null }, `Checked in on ${displayName(s.owner)}`, false);
    if (!error || /duplicate|unique/i.test(error.message)) markSent(`share:${s.conn.id}`);
  };
  const onReview = (x) => setMd(x.kind === 'duel' ? { type: 'reviewDuel', duel: x.item, from: x.from } : { type: 'review', conn: x.item, from: x.from });
  const onDecline = (x) =>
    x.kind === 'duel'
      ? rpc('respond_duel', { p_id: x.item.id, p_accept: false }, 'Declined')
      : rpc('respond_connection', { p_id: x.item.id, p_accept: false }, 'Declined');
  const onCancel = (x) => (x.kind === 'duel' ? rpc('cancel_duel', { p_id: x.item.id }, 'Challenge cancelled') : rpc('end_connection', { p_id: x.item.id }, 'Invite cancelled'));
  const onBlock = (p) =>
    setCf({
      title: `Block ${displayName(p)}?`,
      text: 'This ends every share, competition and duel with them. They can’t send you anything new, and they won’t be told.',
      cta: 'Block',
      run: async () => {
        await rpc('block_user', { p_user: p.id }, `Blocked ${displayName(p)}`);
        setCf(null);
      },
    });
  const onUnblock = (p) => rpc('unblock_user', { p_user: p.id }, `Unblocked ${displayName(p)}`);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`@${m.me.username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Could not copy', null, 'error');
    }
  };
  const onUpdate = async () => {
    const r = await d.sync(true);
    if (r?.setup) showToast('Run supabase/add-friends.sql first', null, 'error');
    else if (r?.error) showToast(r.error, null, 'error');
    else showToast('Your numbers are up to date', RefreshCw);
  };
  const circle = { friends: m.friendCount, family: m.familyCount };
  const add = () => setMd({ type: 'add', counts: circle });
  const onRevise = (x) =>
    setMd(x.kind === 'duel' ? { type: 'reviseDuel', duel: x.item, from: x.from } : { type: 'revise', conn: x.item, from: x.from });
  const onAlias = (p) => setAliasFor(p);

  const inboxCount = m.incoming.length;
  const chips = [
    { Icon: Flame, label: 'Log streak', v: `${m.foodStreak} day${m.foodStreak === 1 ? '' : 's'}`, c: '#fb923c' },
    { Icon: Swords, label: 'Duel record', v: `${m.record.w}–${m.record.l}${m.record.d ? `–${m.record.d}` : ''}`, c: '#fb7185' },
    { Icon: Trophy, label: 'Steps this week', v: m.seasonRank, c: '#facc15' },
    { Icon: Users, label: 'Friends · Family', v: `${m.friendCount}/3 · ${m.familyCount}/3`, c: '#60a5fa' },
  ];

  return (
    <main className={PAGE}>
      {/* Player card */}
      <Card className="way-rise relative flex flex-col gap-4 overflow-hidden p-4 md:p-6 lg:flex-row lg:items-center lg:gap-6">
        <div className="pointer-events-none absolute -left-16 -top-24 h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle,rgba(52,211,153,.12),rgba(52,211,153,0)_70%)]" />
        <div className="relative flex items-center gap-3.5 md:gap-5">
          <div
            className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full md:h-[84px] md:w-[84px]"
            style={{ background: `conic-gradient(#34d399 ${lv.pct * 3.6 * k}deg, #1a2130 0)`, transition: 'background 900ms' }}
          >
            <Avatar person={m.me} isMe size={56} className="md:hidden" ring="0 0 0 3px #0f1420" />
            <Avatar person={m.me} isMe size={70} className="hidden md:flex" ring="0 0 0 4px #0f1420" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-heading text-[22px] font-bold leading-none md:text-[28px]">@{m.me.username}</span>
              <span className="rounded-md border border-way-line2 px-1.5 py-px font-mono text-[11px] font-semibold text-way-ink2">LV {lv.level}</span>
            </div>
            <span className="font-heading text-[11px] font-bold tracking-[0.14em] text-way-protein">{lv.title}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-[140px] overflow-hidden rounded-full bg-way-track md:w-[200px]">
                <div className="h-full rounded-full bg-way-protein transition-[width] duration-[900ms]" style={{ width: `${lv.pct * k}%` }} />
              </div>
              <span className="whitespace-nowrap font-mono text-[11px] text-way-dim">{lv.into} / 1000 XP</span>
            </div>
          </div>
        </div>
        <div className="relative hidden flex-1 justify-center gap-3 lg:flex">
          {chips.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5 rounded-2xl border border-way-line bg-way-rail px-3.5 py-2.5">
              <c.Icon size={16} style={{ color: c.c }} />
              <div className="flex flex-col">
                <span className="text-[11px] text-way-dim">{c.label}</span>
                <span className="font-mono text-sm font-semibold">{c.v}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="relative flex gap-2 md:self-start lg:ml-auto lg:self-auto">
          <Btn variant="outline" onClick={onUpdate} disabled={d.syncing} className="flex-1 md:flex-none md:px-5" title="Push your latest numbers to friends">
            <RefreshCw size={14} className={d.syncing ? 'animate-spin' : ''} />
            {d.syncing ? 'Updating…' : 'Update'}
          </Btn>
          <Btn variant="primary" onClick={add} className="flex-1 md:flex-none md:px-5">
            <UserPlus size={14} />
            Add someone
          </Btn>
        </div>
      </Card>

      {/* Menu */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:border-b md:border-way-line">
        <nav className="grid grid-cols-5 gap-1 rounded-2xl border border-way-line bg-way-card p-1 md:flex md:gap-6 md:rounded-none md:border-0 md:bg-transparent md:p-0" role="tablist">
          {TABS.map((t, i) => {
            const on = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={cx(
                  'relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-colors md:rounded-none md:border-b-2 md:px-0.5 md:pb-3 md:pt-1 md:font-heading md:text-[15px] md:font-bold md:uppercase md:tracking-[0.1em]',
                  on ? 'bg-way-track text-way-ink md:border-way-gold md:bg-transparent' : 'text-way-mute hover:text-way-ink2 md:border-transparent'
                )}
              >
                <span className="hidden rounded border border-way-line2 px-1 font-mono text-[10px] font-medium text-way-dim md:inline">{i + 1}</span>
                {t.label}
                {t.key === 'inbox' && inboxCount ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-way-over px-1 font-mono text-[10px] font-semibold text-[#1a0508] md:static">
                    {inboxCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <span className="hidden whitespace-nowrap pb-3 font-mono text-[11px] font-medium text-way-dim lg:block">{m.season.label}</span>
      </div>

      <div key={tab} className="way-rise">
        {tab === 'arena' ? (
          <ArenaTab m={model} metric={metric} setMetric={setMetric} period={period} setPeriod={setPeriod} k={k} onCheer={onCheer} onClaim={onClaim} onAdd={add} />
        ) : tab === 'duels' ? (
          <DuelsTab
            m={model}
            k={k}
            onNudge={onNudge}
            onNewDuel={() => setMd({ type: 'duel', suggest: m.competitors.map((c) => m.person(c.id)).filter((p) => p.username) })}
            onReviewDuel={onReview}
          />
        ) : tab === 'family' ? (
          <FamilyTab
            m={model}
            k={k}
            onCheckIn={onCheckIn}
            onManage={(s) => setMd({ type: 'manage', conn: s.conn, to: s.viewer })}
            onKit={(kt) => setMd({ type: 'add', mode: 'offer', fields: kt.fields, days: kt.days, label: kt.label, counts: circle })}
            onAlias={onAlias}
            onOpenData={setOpenData}
          />
        ) : tab === 'inbox' ? (
          <InboxTab m={model} onReview={onReview} onDecline={onDecline} onCancel={onCancel} onRevise={onRevise} />
        ) : (
          <PrivacyTab
            m={model}
            copied={copied}
            onCopy={onCopy}
            onChangeName={() => setMd({ type: 'username', current: m.me.username })}
            onAlias={onAlias}
            onBlock={onBlock}
            onUnblock={onUnblock}
          />
        )}
      </div>

      {!m.me.username && !md ? (
        <Modal open onClose={() => router.push('/home')} title="Pick a username to start">
          <div className="flex flex-col gap-3">
            <AtSign size={22} className="text-way-protein" />
            <span className="text-[13px] text-way-mute [text-wrap:pretty]">
              Friends finds people only by exact username, so nobody can browse for you. Nothing is shared until you say so, item by item.
            </span>
            <Btn variant="primary" onClick={() => setMd({ type: 'username', current: '' })} className="self-start">
              <Sparkles size={14} />
              Choose username
            </Btn>
          </div>
        </Modal>
      ) : null}
      {md ? <ConnectDialog key={JSON.stringify([md.type, md.conn?.id, md.duel?.id, md.mode])} md={md} meId={userId} supabase={d.supabase} onClose={() => setMd(null)} onDone={done} onSwitch={setMd} /> : null}
      {cf ? <ConfirmDialog cf={cf} onClose={() => setCf(null)} /> : null}
      {aliasFor ? (
        <AliasDialog
          person={aliasFor}
          supabase={d.supabase}
          onClose={() => setAliasFor(null)}
          onDone={(msg) => {
            setAliasFor(null);
            showToast(msg);
            d.reload();
          }}
        />
      ) : null}
      {openData ? <OpenDataDialog share={openData} stats={d.stats} today={today} onClose={() => setOpenData(null)} /> : null}
      {toast}
    </main>
  );
}
