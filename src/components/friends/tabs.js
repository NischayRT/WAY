'use client';

import {
  Timer,
  Swords,
  Smile,
  Megaphone,
  Check,
  HeartHandshake,
  ChevronRight,
  Copy,
  Pencil,
  ShieldCheck,
  SearchX,
  ListChecks,
  Database,
  TimerReset,
  Share2,
  Eye,
  HouseHeart,
  Stethoscope,
  Dumbbell,
  Ban,
  Lock,
} from 'lucide-react';
import { FIELDS, fmtVal, displayName, relDay } from '@/lib/friends';
import { Card, Eyebrow, Btn, Dot, cx } from '@/components/way/ui';
import { Avatar, FieldChip, FIELD_ICONS } from './parts';

function Empty({ icon: Icon, title, text, action }) {
  return (
    <Card className="flex flex-col items-center gap-2.5 border-dashed border-way-line2 px-5 py-8 text-center">
      {Icon ? <Icon size={22} className="text-way-faint" /> : null}
      <span className="text-sm font-semibold text-way-ink2">{title}</span>
      {text ? <span className="max-w-[360px] text-xs text-way-dim [text-wrap:pretty]">{text}</span> : null}
      {action}
    </Card>
  );
}

/* ================================ DUELS ================================ */

export function DuelsTab({ m, k, onNudge, onNewDuel, onReviewDuel }) {
  const r = m.record;
  const total = r.w + r.l + r.d;
  const pending = m.incoming.find((x) => x.kind === 'duel');
  const record = [
    { v: `${r.w} – ${r.l} – ${r.d}`, short: `${r.w}–${r.l}`, label: 'Wins – losses – draws', color: '#f1f5f9' },
    { v: total ? `${Math.round((r.w / total) * 100)}%` : '—', label: 'Win rate', color: '#34d399' },
    { v: String(m.duels.filter((d) => !d.finished).length), label: 'Live duels', color: '#facc15' },
  ];
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
      <div className="grid grid-cols-3 gap-2 lg:col-span-12 lg:gap-0 lg:rounded-[22px] lg:border lg:border-way-line lg:bg-way-card">
        {record.map((x, i) => (
          <div
            key={x.label}
            className={cx(
              'flex flex-col items-center gap-0.5 rounded-2xl border border-way-line bg-way-card p-3 lg:items-start lg:gap-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-6 lg:py-5',
              i && 'lg:border-l lg:border-way-line'
            )}
          >
            <span className="order-2 text-[11px] text-way-dim lg:order-1 lg:text-xs">{x.label}</span>
            <span className="order-1 font-mono text-xl font-semibold lg:order-2 lg:text-[26px]" style={{ color: x.color }}>
              <span className="lg:hidden">{x.short || x.v}</span>
              <span className="hidden lg:inline">{x.v}</span>
            </span>
          </div>
        ))}
      </div>

      {m.duels.map((d) => {
        const mf = FIELDS[d.duel.metric];
        const Icon = FIELD_ICONS[d.duel.metric];
        const lead = d.you >= d.theirs;
        const diff = Math.abs(d.you - d.theirs);
        const share = d.you + d.theirs ? (50 + ((d.you - d.theirs) / (d.you + d.theirs)) * 250) * k + (1 - k) * 50 : 50;
        const tie = d.you === d.theirs;
        return (
          <Card
            key={d.duel.id}
            className="flex flex-col gap-3.5 p-4 transition-transform lg:col-span-4 lg:gap-5 lg:p-6 lg:hover:-translate-y-0.5"
            style={{ borderColor: tie ? '#253044' : lead ? 'rgba(52,211,153,.35)' : 'rgba(251,113,133,.3)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[7px] text-xs text-way-mute lg:gap-2 lg:text-[13px]">
                <Icon size={15} style={{ color: mf.color }} />
                {mf.label} · {d.span}
              </div>
              <span className="flex items-center gap-[5px] rounded-full bg-way-track px-[9px] py-1 font-mono text-[11px] font-semibold text-way-ink2">
                <Timer size={12} />
                {d.left}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 lg:gap-3">
              <div className="flex flex-col gap-0.5 lg:items-center lg:gap-2">
                <Avatar person={m.me} isMe size={56} className="hidden lg:flex" ring={lead && !tie ? '0 0 0 3px #0f1420, 0 0 0 5px #34d399' : undefined} />
                <span className="text-xs text-way-mute lg:text-[13px]">You</span>
                <span className="font-mono text-lg font-semibold lg:text-[22px]" style={{ color: lead && !tie ? '#34d399' : '#f1f5f9' }}>
                  {fmtVal(d.you, mf.dec)}
                </span>
              </div>
              <span className="font-heading text-[13px] font-bold tracking-[0.12em] text-way-faint lg:text-lg">VS</span>
              <div className="flex flex-col items-end gap-0.5 lg:items-center lg:gap-2">
                <Avatar person={d.them} size={56} className="hidden lg:flex" ring={!lead && !tie ? '0 0 0 3px #0f1420, 0 0 0 5px #fb7185' : undefined} />
                <span className="text-xs text-way-mute lg:text-[13px]">{displayName(d.them)}</span>
                <span className="font-mono text-lg font-semibold lg:text-[22px]" style={{ color: !lead && !tie ? '#fb7185' : '#f1f5f9' }}>
                  {fmtVal(d.theirs, mf.dec)}
                </span>
              </div>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-[5px] bg-[#3b1d27] lg:h-3 lg:rounded-md">
              <div
                className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#10b981,#34d399)] transition-[width] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
              />
              <div className="absolute -bottom-0.5 -top-0.5 left-1/2 w-0.5 bg-way-page" />
            </div>
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-xs lg:text-[13px]" style={{ color: tie ? '#94a3b8' : lead ? '#6ee7b7' : '#fda4af' }}>
                {d.finished
                  ? tie
                    ? 'Finished in a draw'
                    : lead
                      ? 'You won'
                      : `${displayName(d.them)} won`
                  : !d.started
                    ? 'Starts tomorrow'
                    : tie
                      ? 'All square'
                      : lead
                        ? `You lead by ${fmtVal(diff, mf.dec)} ${mf.unit}`
                        : `${displayName(d.them)} leads by ${fmtVal(diff, mf.dec)} ${mf.unit}`}
              </span>
              {!d.finished && d.started ? (
                <button
                  type="button"
                  onClick={() => onNudge(d, lead ? 'taunt' : 'rally')}
                  disabled={d.nudged}
                  className="flex shrink-0 items-center gap-1.5 rounded-[9px] border border-way-line2 px-[11px] py-[7px] text-xs text-way-ink2 disabled:opacity-60"
                >
                  {d.nudged ? <Check size={13} /> : lead ? <Smile size={13} /> : <Megaphone size={13} />}
                  {d.nudged ? 'Sent' : lead ? 'Taunt' : 'Rally'}
                </button>
              ) : null}
            </div>
          </Card>
        );
      })}
      {!m.duels.length ? (
        <div className="lg:col-span-12">
          <Empty icon={Swords} title="No duels yet" text="Challenge someone to a few days of steps, distance, burn, floors or sleep." />
        </div>
      ) : null}

      {pending ? (
        <Card className="flex flex-col gap-3 border-rose-400/35 p-4 md:flex-row md:items-center md:gap-[18px] md:p-6 lg:col-span-6">
          <Avatar person={pending.from} size={52} className="hidden md:flex" />
          <div className="flex flex-1 flex-col gap-1">
            <span className="font-heading text-[11px] font-bold tracking-[0.14em] text-way-over">CHALLENGE WAITING</span>
            <span className="text-sm md:text-[15px]">
              <strong className="font-semibold">{displayName(pending.from)}</strong> challenged you to a {FIELDS[pending.item.metric].label.toLowerCase()} duel
            </span>
          </div>
          <button type="button" onClick={() => onReviewDuel(pending)} className="rounded-xl bg-way-over px-[18px] py-3 text-[13px] font-semibold text-[#1a0508]">
            Review
          </button>
        </Card>
      ) : null}
      <button
        type="button"
        onClick={onNewDuel}
        className={cx(
          'flex items-center justify-center gap-2 rounded-[22px] border border-dashed border-way-line3 p-[18px] text-sm font-semibold text-way-ink2 transition-colors hover:border-way-dim hover:bg-way-card lg:gap-3 lg:p-6 lg:text-base',
          pending ? 'lg:col-span-6' : 'lg:col-span-12'
        )}
      >
        <Swords size={18} />
        Start a new duel
        <span className="hidden text-[13px] font-normal text-way-dim lg:inline">· pick a person, a stat and a deadline</span>
      </button>
    </div>
  );
}

/* ================================ FAMILY ================================ */

const KITS = [
  { label: 'Parent', Icon: HouseHeart, color: '#fbbf24', desc: 'Steps and sleep · no end date', fields: ['steps', 'sleep_hours'], days: 0 },
  { label: 'Doctor', Icon: Stethoscope, color: '#38bdf8', desc: 'Weight, food, resting HR · 30 days', fields: ['weight_kg', 'calories_in', 'protein_g', 'resting_hr'], days: 30 },
  { label: 'Coach', Icon: Dumbbell, color: '#a78bfa', desc: 'Steps, distance, active cal · 90 days', fields: ['steps', 'distance_km', 'active_kcal'], days: 90 },
];

export function FamilyTab({ m, k, onCheckIn, onManage, onKit, onOpenData, onAlias }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
      <div className="flex items-baseline justify-between px-0.5 pt-1 lg:col-span-12 lg:-mb-1.5 lg:p-0">
        <Eyebrow>Shared with you</Eyebrow>
        <span className="hidden items-center gap-1 font-mono text-[11px] font-medium text-way-dim lg:flex">
          Only what each person chose to share · <Lock size={10} /> = personal
        </span>
      </div>
      {m.sharesIn.map((s) => (
        <Card key={s.conn.id} className="flex flex-col gap-3 p-4 lg:col-span-4 lg:gap-[18px] lg:p-6">
          <div className="flex items-center gap-2.5 lg:gap-3">
            <Avatar person={s.owner} size={42} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:gap-[3px]">
              <button type="button" onClick={() => onAlias(s.owner)} className="group flex items-center gap-1.5 text-left" title="Set a nickname (only you see it)">
                <span className="text-sm font-semibold lg:text-base">{displayName(s.owner)}</span>
                <Pencil size={11} className="text-way-faint transition-colors group-hover:text-way-ink2" />
              </button>
              <span className="font-mono text-[10px] font-medium text-way-dim lg:text-[11px]">{s.meta}</span>
            </div>
            <span className="rounded-full bg-way-track px-2 py-[3px] font-mono text-[10px] font-semibold text-way-mute lg:px-2.5 lg:py-1 lg:text-[11px]">{s.chip}</span>
          </div>
          {s.spark ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-way-mute">
                <span>{FIELDS[s.sparkField].label} · last 14 days</span>
                <span className="font-mono">{s.trendStr}</span>
              </div>
              <div className="flex h-12 items-end gap-[3px]">
                {s.spark.map((b, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-[height] duration-[800ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                    style={{ height: `${b.h * k}%`, background: i >= 7 ? FIELDS[s.sparkField].color : `${FIELDS[s.sparkField].color}55` }}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5 lg:gap-3.5 lg:border-t lg:border-way-line lg:pt-4">
            {s.stats.map((st) => (
              <div key={st.field} className="flex flex-col gap-0.5 lg:gap-[3px]">
                <span className="flex items-center gap-1 text-[11px] text-way-dim lg:gap-[5px] lg:text-xs">
                  <span className="hidden lg:inline-flex">
                    <Dot color={FIELDS[st.field].color} />
                  </span>
                  {FIELDS[st.field].label}
                  {FIELDS[st.field].sensitive ? <Lock size={9} /> : null}
                </span>
                <span className="font-mono text-sm font-semibold lg:text-[17px]">
                  {st.v}
                  <span className="text-[10px] text-way-dim lg:text-[11px]"> {st.unit}</span>
                </span>
              </div>
            ))}
          </div>
          {s.alert ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/7 px-3 py-2.5 lg:rounded-[14px] lg:p-3">
              <HeartHandshake size={16} className="shrink-0 text-way-kcal" />
              <span className="flex-1 text-xs text-amber-200 [text-wrap:pretty]">{s.alert}</span>
            </div>
          ) : null}
          <div className="mt-auto flex gap-2">
            <button
              type="button"
              onClick={() => onOpenData(s)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] border border-way-line2 p-2.5 text-[13px] font-medium text-way-ink2 hover:bg-way-hover"
            >
              Open data
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => onCheckIn(s)}
              disabled={s.checked}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] p-2.5 text-[13px] font-semibold transition-colors"
              style={s.checked ? { background: 'rgba(52,211,153,.14)', color: '#34d399' } : s.alert ? { background: '#fbbf24', color: '#1a1300' } : { background: '#1a2130', color: '#cbd5e1' }}
            >
              {s.checked ? <Check size={14} /> : <HeartHandshake size={14} />}
              {s.checked ? 'Sent' : 'Check in'}
            </button>
          </div>
        </Card>
      ))}
      {!m.sharesIn.length ? (
        <div className="lg:col-span-12">
          <Empty icon={HeartHandshake} title="Nobody shares with you yet" text="Ask a parent, partner or friend to share their steps or sleep. They choose what you see." />
        </div>
      ) : null}

      <Card className="flex flex-col pb-1.5 pt-[18px] lg:col-span-8 lg:pt-[22px]">
        <div className="flex items-center justify-between px-4 pb-3 lg:px-6">
          <Eyebrow>You share with</Eyebrow>
          <span className="hidden font-mono text-[11px] font-medium text-way-dim lg:inline">Every view is logged in Privacy</span>
        </div>
        {m.sharesOut.map((s) => (
          <div
            key={s.conn.id}
            className="flex flex-col gap-2 border-t border-way-line px-4 py-3.5 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_130px_110px] lg:items-center lg:gap-4 lg:px-6"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar person={s.viewer} size={34} />
              <div className="flex min-w-0 flex-col gap-px">
                <button type="button" onClick={() => onAlias(s.viewer)} className="text-left text-[13px] font-semibold hover:underline lg:text-sm" title="Set a nickname (only you see it)">
                  {displayName(s.viewer)}
                  {s.conn.label ? <span className="font-normal text-way-dim"> · {s.conn.label}</span> : null}
                </button>
                <span className="font-mono text-[11px] font-medium text-way-dim">{s.views}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {s.conn.fields.map((f) => (
                <FieldChip key={f} field={f} />
              ))}
            </div>
            <span className="font-mono text-[11px] font-medium lg:text-xs" style={{ color: s.expColor }}>
              {s.expires}
            </span>
            <Btn variant="outline" size="sm" onClick={() => onManage(s)} className="self-start rounded-[9px] lg:justify-self-end">
              Manage
            </Btn>
          </div>
        ))}
        {!m.sharesOut.length ? <p className="border-t border-way-line px-6 py-5 text-[13px] text-way-dim">You don’t share with anyone yet. Start with a share kit.</p> : null}
      </Card>

      <Card className="flex flex-col gap-3 p-4 lg:col-span-4 lg:p-[22px]">
        <div className="flex flex-col gap-1">
          <Eyebrow>Share kits</Eyebrow>
          <span className="text-xs text-way-dim">Ready-made bundles. You can edit them before sending.</span>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-col">
          {KITS.map((kt) => (
            <button
              key={kt.label}
              type="button"
              onClick={() => onKit(kt)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-way-line2 bg-way-card px-2 py-3 text-xs font-semibold text-way-ink2 transition-colors hover:border-way-line3 hover:bg-way-hover lg:flex-row lg:gap-3 lg:rounded-[14px] lg:bg-transparent lg:px-3.5 lg:py-3 lg:text-left"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] lg:bg-way-track">
                <kt.Icon size={17} style={{ color: kt.color }} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-semibold lg:text-[13px]">{kt.label}</span>
                <span className="hidden text-[11px] font-normal text-way-dim lg:block">{kt.desc}</span>
              </span>
              <ChevronRight size={15} className="hidden text-way-dim lg:block" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================================ INBOX ================================ */

export function InboxTab({ m, onReview, onDecline, onCancel, onRevise }) {
  const describe = (x) => {
    if (x.kind === 'duel') return { what: `challenged you to a ${FIELDS[x.item.metric].label.toLowerCase()} duel`, Icon: Swords, c: '#fb7185', fields: [x.item.metric] };
    const c = x.item;
    if (c.kind === 'compete') return { what: 'wants to compete with you', Icon: Swords, c: '#fb7185', fields: c.fields };
    if (c.initiated_by === c.owner_id) return { what: `wants to share their data with you${c.ends_at ? '' : ' · no end date'}`, Icon: Share2, c: '#34d399', fields: c.fields };
    return { what: 'asks to see your data', Icon: Eye, c: '#60a5fa', fields: c.fields };
  };
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
      <section className="flex flex-col gap-3.5 lg:col-span-8">
        <Eyebrow className="hidden lg:block">Waiting for you</Eyebrow>
        {m.incoming.map((x) => {
          const d = describe(x);
          return (
            <Card key={`${x.kind}-${x.item.id}`} className="flex flex-col gap-3 border-way-line2 p-4 lg:flex-row lg:items-center lg:gap-4 lg:rounded-[20px] lg:px-[22px] lg:py-5">
              <div className="flex items-center gap-2.5 lg:contents">
                <Avatar person={x.from} size={42}>
                  <span className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-way-card" style={{ background: d.c }}>
                    <d.Icon size={11} className="text-way-page" />
                  </span>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:gap-[7px]">
                  {x.item.revised_from ? (
                    <span className="self-start rounded-full bg-amber-400/12 px-2 py-0.5 font-heading text-[10px] font-bold tracking-[0.12em] text-way-kcal">NEW TERMS</span>
                  ) : null}
                  <span className="text-[13px] lg:text-sm">
                    <strong className="font-semibold">{displayName(x.from)}</strong>
                    {x.from?.username ? <span className="text-way-dim"> @{x.from.username}</span> : null} {d.what}{' '}
                    <span className="font-mono text-[10px] font-medium text-way-dim lg:text-[11px]">· {relDay(String(x.item.created_at).slice(0, 10), m.today)}</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {d.fields.map((f) => (
                      <FieldChip key={f} field={f} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Btn variant="outline" onClick={() => onDecline(x)} className="flex-1 rounded-[10px] font-normal lg:flex-none">
                  Decline
                </Btn>
                <Btn variant="outline" onClick={() => onRevise(x)} className="flex-1 rounded-[10px] lg:flex-none">
                  <Pencil size={12} />
                  Revise
                </Btn>
                <Btn variant="primary" onClick={() => onReview(x)} className="flex-[1.4] rounded-[10px] lg:flex-none">
                  Accept…
                </Btn>
              </div>
            </Card>
          );
        })}
        {!m.incoming.length ? <Empty title="Nothing waiting" text="Invites, share requests and duel challenges land here." /> : null}

        {m.nudges.length ? (
          <>
            <Eyebrow className="pt-1">Messages</Eyebrow>
            <Card className="overflow-hidden">
              {m.nudges.map((n, i) => {
                const p = m.person(n.from_id);
                const text = n.kind === 'check_in' ? 'checked in on you' : n.kind === 'taunt' ? 'sent you a friendly taunt' : 'is rallying to catch you';
                const Icon = n.kind === 'check_in' ? HeartHandshake : n.kind === 'taunt' ? Smile : Megaphone;
                return (
                  <div key={n.id} className={cx('flex items-center gap-3 px-4 py-3 lg:px-6', i && 'border-t border-way-line')}>
                    <Avatar person={p} size={30} />
                    <span className="flex-1 text-[13px]">
                      <strong className="font-semibold">{displayName(p)}</strong> {text}
                    </span>
                    <Icon size={15} className="text-way-mute" />
                    <span className="font-mono text-[11px] text-way-dim">{relDay(String(n.created_at).slice(0, 10), m.today)}</span>
                  </div>
                );
              })}
            </Card>
          </>
        ) : null}
      </section>

      <section className="flex flex-col gap-3.5 lg:col-span-4">
        <Eyebrow className="px-0.5 pt-1 lg:p-0">You sent</Eyebrow>
        {m.outgoing.map((x) => {
          const isDuel = x.kind === 'duel';
          const c = x.item;
          const what = isDuel
            ? `You challenged ${displayName(x.to)} to a ${FIELDS[c.metric].label.toLowerCase()} duel`
            : c.kind === 'compete'
              ? `You asked ${displayName(x.to)} to compete`
              : c.initiated_by === c.owner_id
                ? `You offered to share with ${displayName(x.to)}`
                : `You asked to see ${displayName(x.to)}’s data`;
          return (
            <Card key={`${x.kind}-${c.id}`} className="flex flex-col gap-3 rounded-[18px] p-3.5 lg:rounded-[20px] lg:px-5 lg:py-[18px]">
              <span className="text-[13px] lg:text-sm">{what}</span>
              <div className="flex flex-wrap gap-1">
                {(isDuel ? [c.metric] : c.fields).map((f) => (
                  <FieldChip key={f} field={f} />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-medium text-way-dim lg:text-[11px]">Sent {relDay(String(c.created_at).slice(0, 10), m.today)}</span>
                <Btn variant="outline" size="sm" onClick={() => onCancel(x)} className="rounded-[9px]">
                  Cancel
                </Btn>
              </div>
            </Card>
          );
        })}
        {!m.outgoing.length ? <p className="px-1 text-xs text-way-dim">Nothing pending.</p> : null}
        <p className="px-1 text-xs text-way-dim [text-wrap:pretty]">People only see your username and name until you accept. Cancel an invite any time.</p>
      </section>
    </div>
  );
}

/* ================================ PRIVACY ================================ */

const RULES = [
  [SearchX, 'No search or browsing. People need your exact username, and see only that until you accept.'],
  [ListChecks, 'Nothing is shared without your OK, item by item. Competing compares only what you both agree on.'],
  [Database, 'Only daily totals are read (the last 31 days), and only the agreed items. Stop sharing and access ends at once.'],
  [TimerReset, 'Set an end date, remove items, stop any time, or block someone.'],
  [ShieldCheck, 'These rules are enforced by the database, not just this screen.'],
];

export function PrivacyTab({ m, copied, onCopy, onChangeName, onBlock, onUnblock, onAlias }) {
  const connected = m.connectedPeople;
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
      <section className="flex flex-col gap-3.5 lg:col-span-8 lg:gap-5">
        <Card className="flex flex-col pb-1.5 pt-[18px] lg:pt-[22px]">
          <div className="flex items-center justify-between px-4 pb-3 lg:px-6">
            <Eyebrow>Who viewed your shared data</Eyebrow>
            <span className="font-mono text-[11px] font-medium text-way-dim">Last 50 views</span>
          </div>
          {m.views.map((v, i) => {
            const p = m.person(v.viewer_id);
            return (
              <div
                key={`${v.viewer_id}-${v.viewed_at}-${i}`}
                className="flex items-center gap-2.5 border-t border-way-line px-4 py-[11px] lg:grid lg:grid-cols-[36px_minmax(0,1fr)_minmax(0,1.4fr)_140px] lg:gap-3.5 lg:px-6 lg:py-3"
              >
                <Avatar person={p} size={28} />
                <span className="flex-1 text-[13px] lg:text-sm">{p?.username ? `@${p.username}` : displayName(p)}</span>
                <span className="hidden text-xs text-way-mute lg:block">{v.fields.map((f) => FIELDS[f]?.label).filter(Boolean).join(', ')}</span>
                <span className="text-right font-mono text-[11px] font-medium text-way-dim lg:text-xs">
                  {relDay(String(v.viewed_at).slice(0, 10), m.today)},{' '}
                  {new Date(v.viewed_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
          {!m.views.length ? <p className="border-t border-way-line px-6 py-5 text-[13px] text-way-dim">No one has looked at your shared data yet.</p> : null}
        </Card>

        <Card className="flex flex-col pb-1.5 pt-[18px] lg:pt-[22px]">
          <div className="flex items-center justify-between px-4 pb-3 lg:px-6">
            <Eyebrow>People you’re connected to</Eyebrow>
            <span className="font-mono text-[11px] font-medium text-way-dim">
              Friends {m.friendCount}/3 · Family {m.familyCount}/3
            </span>
          </div>
          {connected.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-t border-way-line px-4 py-2.5 lg:px-6">
              <Avatar person={p} size={30} />
              <span className="flex-1 text-[13px]">
                {displayName(p)}
                {p.username ? <span className="text-way-dim"> @{p.username}</span> : null}
                {p.alias ? <span className="ml-1.5 rounded bg-way-track px-1.5 py-px font-mono text-[10px] text-way-mute">nickname</span> : null}
              </span>
              <Btn variant="outline" size="sm" onClick={() => onAlias(p)} className="rounded-[9px] font-normal" title="Only you see nicknames">
                <Pencil size={12} />
                <span className="hidden sm:inline">Nickname</span>
              </Btn>
              <Btn variant="dangerOutline" size="sm" onClick={() => onBlock(p)} className="rounded-[9px]">
                <Ban size={12} />
                Block
              </Btn>
            </div>
          ))}
          {!connected.length ? <p className="border-t border-way-line px-6 py-5 text-[13px] text-way-dim">No one yet.</p> : null}
        </Card>
      </section>

      <section className="order-first flex flex-col gap-3.5 lg:order-none lg:col-span-4 lg:gap-5">
        <Card className="flex flex-col gap-3 p-4 lg:gap-3.5 lg:p-[22px]">
          <Eyebrow className="hidden lg:block">Username</Eyebrow>
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-way-dim lg:hidden">Your username</span>
              <span className="font-heading text-xl font-bold lg:text-[26px]">@{m.me.username}</span>
            </div>
            <div className="flex gap-1.5">
              <Btn variant="outline" size="sm" onClick={onCopy} className="rounded-[9px] font-normal">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </Btn>
              <Btn variant="outline" size="sm" onClick={onChangeName} disabled={!m.canRename} title={m.renameHint} className="rounded-[9px] font-normal">
                <Pencil size={12} />
                Change
              </Btn>
            </div>
          </div>
          <span className="text-xs text-way-dim">{m.renameHint}</span>
        </Card>
        <Card className="flex flex-col gap-3 p-4 lg:gap-3.5 lg:p-[22px]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-way-protein" />
            <Eyebrow>How your data is protected</Eyebrow>
          </div>
          {RULES.map(([Icon, text]) => (
            <div key={text} className="flex gap-2.5">
              <Icon size={14} className="mt-0.5 shrink-0 text-way-protein" />
              <span className="text-xs leading-normal text-way-ink2">{text}</span>
            </div>
          ))}
          <div className="flex flex-col gap-2 border-t border-way-line pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-way-mute">Blocked</span>
              {!m.blocked.length ? <span className="font-mono text-xs font-medium text-way-dim">No one</span> : null}
            </div>
            {m.blocked.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-way-ink2">{p.username ? `@${p.username}` : displayName(p)}</span>
                <button type="button" onClick={() => onUnblock(p)} className="text-xs text-way-protein">
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
