'use client';

import { useState } from 'react';
import { AtSign, Swords, Share2, Eye, Check, Circle, Lock, UserPlus } from 'lucide-react';
import { FIELDS, FIELD_KEYS, COMPETE_KEYS, FRIEND_LIMIT, FAMILY_LIMIT, displayName } from '@/lib/friends';
import { CHALLENGE_LENGTHS, MAX_CHALLENGE_DAYS, MAX_CHALLENGE_PEOPLE, dayDiff, shortDay, weekdayDay } from '@/lib/challenges';
import { addDays } from '@/lib/dateUtils';
import { Modal, Btn, Segmented, cx } from '@/components/way/ui';
import { Avatar } from './parts';

const MODES = [
  { key: 'compete', title: 'Compete', desc: 'Rank each other. You both agree what counts.', Icon: Swords, c: '#fb7185' },
  { key: 'offer', title: 'Share mine', desc: 'They see what you pick, for as long as you choose.', Icon: Share2, c: '#34d399' },
  { key: 'request', title: 'Ask to see', desc: 'They decide what, if anything, to share.', Icon: Eye, c: '#60a5fa' },
];
const DURATIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'No end' },
];
const cleanName = (v) => v.toLowerCase().replace(/[^a-z0-9_.@]/g, '').slice(0, 21);

function FieldPicker({ options, value, onChange, readOnly }) {
  const set = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((k) => {
        const f = FIELDS[k];
        const on = set.has(k);
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            disabled={readOnly}
            onClick={() => onChange(options.filter((o) => (o === k ? !on : set.has(o))))}
            className={cx(
              'flex items-center gap-[5px] rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors md:px-[11px] md:py-[7px]',
              readOnly && 'cursor-default'
            )}
            style={on ? { background: f.color, color: '#090d16', borderColor: f.color } : { color: '#94a3b8', borderColor: '#253044' }}
          >
            {on ? <Check size={12} /> : <Circle size={12} />}
            {f.label}
            {f.sensitive ? <Lock size={10} className="opacity-70" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function SensitiveWarning({ fields }) {
  const sens = fields.filter((k) => FIELDS[k]?.sensitive);
  if (!sens.length) return null;
  return (
    <div className="rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2.5 text-xs leading-[1.45] text-amber-200 md:px-[13px] md:py-[11px]">
      Includes personal data ({sens.map((k) => FIELDS[k].label.toLowerCase()).join(', ')}). Share it only with people you trust. You can remove
      items or stop at any time.
    </div>
  );
}

function UsernameInput({ value, onChange, hint = true }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 rounded-xl border border-way-line2 bg-way-rail px-3 focus-within:border-way-faint md:px-3.5">
        <AtSign size={16} className="text-way-dim" />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(cleanName(e.target.value))}
          placeholder="their exact username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 bg-transparent py-3 text-[15px] text-way-ink outline-none placeholder:text-way-faint md:py-[13px]"
        />
      </label>
      {hint ? <span className="text-[11px] text-way-dim">There&apos;s no search, so no one can browse for people.</span> : null}
    </div>
  );
}

/**
 * One dialog for every Friends action that needs input. `md` describes it:
 *  { type: 'add', mode, fields, days, label }
 *  { type: 'challenge', friends, people?, metric?, days?, today, counts }
 *  { type: 'review', conn, from } · { type: 'reviewChallenge', x, from, others }
 *  { type: 'manage', conn, to } · { type: 'username', current }
 *  { type: 'revise', conn, from }  (answer with new terms)
 */
export default function ConnectDialog({ md, meId, supabase, onClose, onDone, onSwitch }) {
  const [s, setS] = useState(() => ({
    username: md.username || '',
    mode: md.mode || 'compete',
    fields: md.fields || (md.conn ? md.conn.fields : ['steps', 'distance_km', 'active_kcal']),
    days: md.days ?? 30,
    until: md.until || '',
    people: md.people || [],
    metric: md.metric || 'steps',
    label: md.label || '',
    name: md.current || '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setS((x) => ({ ...x, ...patch }));

  const run = async (fn, args, message) => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc(fn, args);
    setBusy(false);
    if (e) return setError(e.message);
    onDone(message);
  };

  let title;
  let body;
  let cta;
  let ctaTone = 'primary';
  let valid = true;
  let submit;
  let secondary = null;

  if (md.type === 'add') {
    const options = s.mode === 'compete' ? COMPETE_KEYS : FIELD_KEYS;
    const fields = s.fields.filter((k) => options.includes(k));
    const isFriend = s.mode === 'compete';
    const used = isFriend ? md.counts?.friends ?? 0 : md.counts?.family ?? 0;
    const limit = isFriend ? FRIEND_LIMIT : FAMILY_LIMIT;
    const full = used >= limit;
    valid = !full && fields.length > 0 && s.username.replace('@', '').length >= 3;
    title = 'Add someone';
    cta = s.mode === 'compete' ? 'Send challenge' : s.mode === 'offer' ? 'Share' : 'Send request';
    ctaTone = s.mode === 'compete' ? 'compete' : 'primary';
    const u = s.username.replace(/^@/, '');
    submit = () =>
      run(
        'send_connection',
        { p_username: u, p_mode: s.mode, p_fields: fields, p_days: s.mode === 'offer' && s.days ? s.days : null, p_label: s.label || null },
        s.mode === 'compete' ? `Challenge sent to @${u}` : s.mode === 'offer' ? `Shared with @${u}. They need to accept.` : `Request sent to @${u}`
      );
    body = (
      <>
        <UsernameInput value={s.username} onChange={(v) => set({ username: v })} />
        <div className="flex flex-col gap-1.5 md:grid md:grid-cols-3 md:gap-2">
          {MODES.map((m) => {
            const on = m.key === s.mode;
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={on}
                onClick={() => set({ mode: m.key, fields: m.key === 'compete' ? ['steps', 'distance_km', 'active_kcal'] : s.fields })}
                className="flex items-start gap-2.5 rounded-[14px] border p-3 text-left transition-colors md:flex-col md:gap-1.5 md:p-3.5"
                style={{ borderColor: on ? m.c : '#253044', background: on ? `${m.c}14` : 'transparent' }}
              >
                <m.Icon size={18} style={{ color: on ? m.c : '#7c8aa0' }} className="mt-px shrink-0" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">{m.title}</span>
                  <span className="text-[11px] leading-snug text-way-mute">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-xs font-semibold text-way-ink2">{s.mode === 'compete' ? 'Compete on' : s.mode === 'offer' ? 'They will see' : 'Ask to see'}</span>
        <FieldPicker options={options} value={fields} onChange={(f) => set({ fields: f })} />
        {s.mode === 'offer' ? (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <span className="text-xs text-way-mute">For how long</span>
            <Segmented stretch size="sm" className="flex-1 rounded-xl bg-way-rail p-[3px]" value={s.days} onChange={(v) => set({ days: v })} options={DURATIONS} />
          </div>
        ) : null}
        {s.mode === 'offer' ? <SensitiveWarning fields={fields} /> : null}
        <div className={cx('flex items-center justify-between rounded-xl px-3 py-2 text-xs', full ? 'border border-rose-400/30 bg-rose-400/8 text-rose-200' : 'bg-way-rail text-way-mute')}>
          <span>
            {full
              ? `You have ${limit} ${isFriend ? 'friends' : 'family members'}, the most allowed. Remove one in Privacy to add someone new.`
              : `${isFriend ? 'Friends' : 'Family'} are capped at ${limit} so it stays personal.`}
          </span>
          <span className="ml-3 shrink-0 font-mono font-semibold">
            {used}/{limit}
          </span>
        </div>
      </>
    );
  } else if (md.type === 'challenge') {
    const friends = md.friends || [];
    const tomorrow = addDays(md.today, 1);
    const lastAllowed = addDays(tomorrow, MAX_CHALLENGE_DAYS - 1);
    const until = s.days === 'date' ? s.until : addDays(tomorrow, s.days - 1);
    const days = until && until >= tomorrow && until <= lastAllowed ? dayDiff(tomorrow, until) + 1 : null;
    const people = s.people.filter((id) => friends.some((p) => p.id === id));
    valid = people.length > 0 && days != null;
    title = 'New challenge';
    cta = people.length ? `Challenge ${people.length} friend${people.length === 1 ? '' : 's'}` : 'Send challenge';
    ctaTone = 'compete';
    submit = () => run('create_challenge', { p_metric: s.metric, p_people: people, p_days: days }, `Challenge sent to ${people.length} friend${people.length === 1 ? '' : 's'}`);
    const toggle = (id) =>
      set({ people: people.includes(id) ? people.filter((x) => x !== id) : people.length >= MAX_CHALLENGE_PEOPLE ? people : [...people, id] });
    body = (
      <>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-way-ink2">Who</span>
          <span className="font-mono text-[11px] text-way-dim">
            {people.length}/{Math.min(MAX_CHALLENGE_PEOPLE, friends.length || MAX_CHALLENGE_PEOPLE)}
          </span>
        </div>
        {friends.length ? (
          <div className="flex flex-wrap gap-1.5">
            {friends.map((p) => {
              const on = people.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-colors"
                  style={on ? { background: 'rgba(251,113,133,.14)', color: '#fecdd3', borderColor: 'rgba(251,113,133,.6)' } : { color: '#94a3b8', borderColor: '#253044' }}
                >
                  <Avatar person={p} size={24} />
                  {displayName(p)}
                  {on ? <Check size={12} /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="rounded-xl bg-way-rail px-3 py-2.5 text-xs text-way-mute">You can challenge people you compete with. Add a friend first.</span>
        )}
        {onSwitch && (md.counts?.friends ?? 0) < FRIEND_LIMIT ? (
          <button type="button" onClick={() => onSwitch({ type: 'add', mode: 'compete', counts: md.counts })} className="flex items-center gap-1.5 self-start text-xs font-semibold text-way-protein">
            <UserPlus size={13} />
            Add a friend by username
          </button>
        ) : null}
        <span className="text-xs font-semibold text-way-ink2">One stat</span>
        <div className="flex flex-wrap gap-1.5">
          {COMPETE_KEYS.map((k) => {
            const on = s.metric === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => set({ metric: k })}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={on ? { background: FIELDS[k].color, color: '#090d16', borderColor: FIELDS[k].color } : { color: '#94a3b8', borderColor: '#253044' }}
              >
                {FIELDS[k].label}
              </button>
            );
          })}
        </div>
        <span className="text-xs font-semibold text-way-ink2">How long</span>
        <Segmented
          stretch
          size="sm"
          className="rounded-xl bg-way-rail p-[3px]"
          value={s.days}
          onChange={(v) => set({ days: v, until: v === 'date' ? s.until || addDays(tomorrow, 9) : s.until })}
          options={[...CHALLENGE_LENGTHS.map((n) => ({ value: n, label: n === 1 ? '1 day' : `${n}d` })), { value: 'date', label: 'Date' }]}
        />
        {s.days === 'date' ? (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-way-line2 bg-way-rail px-3 py-2 text-xs text-way-mute">
            Last day
            <input
              type="date"
              value={s.until || ''}
              min={tomorrow}
              max={lastAllowed}
              onChange={(e) => set({ until: e.target.value })}
              className="bg-transparent font-mono text-[13px] text-way-ink outline-none [color-scheme:dark]"
            />
          </label>
        ) : null}
        <div className="flex flex-col gap-1 rounded-xl bg-way-rail px-3 py-2.5 text-xs">
          {days != null ? (
            <span className="text-way-ink2">
              {days} day{days === 1 ? '' : 's'}: {weekdayDay(tomorrow)} to {weekdayDay(until)}, ending 11:59 pm.
            </span>
          ) : (
            <span className="text-rose-300">Pick a last day between {shortDay(tomorrow)} and {shortDay(lastAllowed)}.</span>
          )}
          <span className="text-way-dim [text-wrap:pretty]">
            It starts tomorrow. Friends can join until it ends, and every day counts. People who join see each other’s {FIELDS[s.metric].label.toLowerCase()} for these days, nothing else.
          </span>
        </div>
      </>
    );
  } else if (md.type === 'review') {
    const c = md.conn;
    const who = displayName(md.from);
    const isCompete = c.kind === 'compete';
    const isOffer = c.kind === 'share' && c.initiated_by === c.owner_id;
    const options = isCompete ? c.fields : isOffer ? c.fields : FIELD_KEYS;
    const fields = s.fields.filter((k) => options.includes(k));
    valid = fields.length > 0;
    title = isCompete ? `Challenge from ${who}` : isOffer ? `${who} wants to share` : `${who} asks to see your data`;
    cta = isCompete ? 'Accept' : isOffer ? 'Accept' : 'Share selected';
    ctaTone = isCompete ? 'compete' : 'primary';
    submit = () =>
      run(
        'respond_connection',
        { p_id: c.id, p_accept: true, p_fields: isOffer ? null : fields, p_days: !isCompete && !isOffer && s.days ? s.days : null },
        isCompete ? `You're now competing with ${who}` : isOffer ? `${who} now shares with you` : `Now sharing with ${who}`
      );
    secondary = (
      <span className="flex gap-2">
        <Btn variant="outline" onClick={() => run('respond_connection', { p_id: c.id, p_accept: false }, `Declined ${who}`)} disabled={busy}>
          Decline
        </Btn>
        {onSwitch ? (
          <Btn variant="outline" onClick={() => onSwitch({ type: 'revise', conn: c, from: md.from })} disabled={busy}>
            Revise
          </Btn>
        ) : null}
      </span>
    );
    body = (
      <>
        <span className="text-[13px] text-way-mute [text-wrap:pretty]">
          {isCompete
            ? 'Untick anything you don’t want compared. Only what you both agree on goes on the leaderboard.'
            : isOffer
              ? `They offer these${c.ends_at ? ` until ${new Date(c.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}. They can change or stop it any time.`
              : 'Choose what to share, if anything, and for how long. You’ll see each time they look.'}
        </span>
        <span className="text-xs font-semibold text-way-ink2">{isCompete ? 'Compare' : isOffer ? 'You’ll be able to see' : 'Share these'}</span>
        <FieldPicker options={options} value={fields} onChange={(f) => set({ fields: f })} readOnly={isOffer} />
        {!isCompete && !isOffer ? (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <span className="text-xs text-way-mute">For how long</span>
              <Segmented stretch size="sm" className="flex-1 rounded-xl bg-way-rail p-[3px]" value={s.days} onChange={(v) => set({ days: v })} options={DURATIONS} />
            </div>
            <SensitiveWarning fields={fields} />
          </>
        ) : null}
      </>
    );
  } else if (md.type === 'reviewChallenge') {
    const x = md.x;
    const who = displayName(md.from);
    const stat = x.f.label.toLowerCase();
    title = `${who} challenged you`;
    cta = 'Join challenge';
    ctaTone = 'compete';
    submit = () => run('respond_challenge', { p_id: x.id, p_join: true }, `You're in. Beat them at ${stat}!`);
    secondary = (
      <Btn variant="outline" onClick={() => run('respond_challenge', { p_id: x.id, p_join: false }, `Declined ${who}`)} disabled={busy}>
        Decline
      </Btn>
    );
    body = (
      <>
        <span className="text-sm text-way-ink2 [text-wrap:pretty]">
          {x.f.label} for {x.len} day{x.len === 1 ? '' : 's'}: {weekdayDay(x.c.starts_on)} to {weekdayDay(x.c.ends_on)}, ending 11:59 pm.
          {md.others ? ` With ${md.others}.` : ''}
        </span>
        <span className="rounded-xl bg-way-rail px-3 py-2.5 text-xs text-way-dim [text-wrap:pretty]">
          Everyone who joins sees your daily {stat} for these days, and nothing else. Joining late is fine: every day counts. You can leave any time.
        </span>
      </>
    );
  } else if (md.type === 'revise') {
    const c = md.conn;
    const who = displayName(md.from);
    const isCompete = c.kind === 'compete';
    const iShare = c.kind === 'share' && c.owner_id === meId; // they asked for my data
    const options = isCompete ? COMPETE_KEYS : FIELD_KEYS;
    const fields = s.fields.filter((k) => options.includes(k));
    valid = fields.length > 0;
    title = `New terms for ${who}`;
    cta = 'Send new terms';
    ctaTone = isCompete ? 'compete' : 'primary';
    submit = () =>
      run('revise_connection', { p_id: c.id, p_fields: fields, p_days: iShare && s.days ? s.days : null }, `New terms sent to ${who}. They can accept, decline or revise.`);
    body = (
      <>
        <span className="text-[13px] text-way-mute [text-wrap:pretty]">
          {isCompete
            ? 'Pick what you’d rather compare. Their request is replaced by yours, and nothing is shared until they accept.'
            : iShare
              ? 'Choose what you’re willing to share instead, and for how long. They’ll get it as an offer to accept.'
              : 'Ask for different items instead. They decide whether to share them, and for how long.'}
        </span>
        <div className="flex flex-col gap-1.5 rounded-xl bg-way-rail px-3 py-2.5 text-xs text-way-dim">
          <span>They asked for</span>
          <div className="flex flex-wrap gap-1">
            {c.fields.map((k) => (
              <span key={k} className="rounded-full border border-way-line2 px-2 py-0.5 text-way-mute">
                {FIELDS[k]?.label}
              </span>
            ))}
          </div>
        </div>
        <span className="text-xs font-semibold text-way-ink2">{isCompete ? 'Compare instead' : iShare ? 'Share instead' : 'Ask for instead'}</span>
        <FieldPicker options={options} value={fields} onChange={(f) => set({ fields: f })} />
        {iShare ? (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <span className="text-xs text-way-mute">For how long</span>
              <Segmented stretch size="sm" className="flex-1 rounded-xl bg-way-rail p-[3px]" value={s.days} onChange={(v) => set({ days: v })} options={DURATIONS} />
            </div>
            <SensitiveWarning fields={fields} />
          </>
        ) : null}
      </>
    );
  } else if (md.type === 'manage') {
    const c = md.conn;
    const who = displayName(md.to);
    const fields = s.fields.filter((k) => c.fields.includes(k));
    title = `Sharing with ${who}`;
    cta = fields.length ? 'Save' : 'Stop sharing';
    ctaTone = fields.length ? 'primary' : 'danger';
    submit = () =>
      fields.length
        ? run('update_share', { p_id: c.id, p_fields: fields, p_days: null, p_keep_end: true }, 'Sharing updated')
        : run('end_connection', { p_id: c.id }, `Stopped sharing with ${who}`);
    secondary = (
      <Btn variant="dangerOutline" onClick={() => run('end_connection', { p_id: c.id }, `Stopped sharing with ${who}`)} disabled={busy}>
        Stop sharing
      </Btn>
    );
    body = (
      <>
        <span className="text-[13px] text-way-mute">Untick anything you no longer want them to see. To share more, send a new share.</span>
        <FieldPicker options={c.fields} value={fields} onChange={(f) => set({ fields: f })} />
      </>
    );
  } else if (md.type === 'username') {
    const v = s.name.replace(/^@/, '');
    valid = /^[a-z0-9_.]{3,20}$/.test(v);
    title = md.current ? 'Change username' : 'Pick a username';
    cta = 'Save username';
    submit = () => run('set_username', { p_username: v }, `You're @${v}`);
    body = (
      <>
        <span className="text-[13px] text-way-mute [text-wrap:pretty]">
          People add you by typing it exactly. 3–20 letters, numbers, dots or underscores. You can change it once every 30 days.
        </span>
        <label className="flex items-center gap-2 rounded-xl border border-way-line2 bg-way-rail px-3 focus-within:border-way-faint">
          <AtSign size={16} className="text-way-dim" />
          <input
            autoFocus
            value={s.name}
            onChange={(e) => set({ name: cleanName(e.target.value).replace('@', '') })}
            placeholder="e.g. aarav.fit"
            autoCapitalize="none"
            spellCheck={false}
            className="flex-1 bg-transparent py-3 text-[15px] text-way-ink outline-none placeholder:text-way-faint"
          />
        </label>
      </>
    );
  }

  const ctaCls =
    ctaTone === 'compete'
      ? 'bg-way-over text-[#1a0508] hover:bg-rose-300'
      : ctaTone === 'danger'
        ? 'bg-rose-600 text-white'
        : 'bg-way-ink text-way-page hover:bg-white';

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          {secondary ? <span className="mr-auto">{secondary}</span> : (
            <Btn variant="outline" onClick={onClose} className="hidden md:inline-flex md:ml-auto">
              Cancel
            </Btn>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className={cx(
              'h-11 flex-1 rounded-xl px-5 text-sm font-semibold transition-colors disabled:bg-way-track disabled:text-way-faint md:flex-none',
              ctaCls
            )}
          >
            {busy ? 'Working…' : cta}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5 md:gap-4">
        {body}
        {error ? <p className="text-[13px] text-rose-300">{error}</p> : null}
      </div>
    </Modal>
  );
}
