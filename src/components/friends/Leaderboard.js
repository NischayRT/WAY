'use client';

import { Crown } from 'lucide-react';
import { fmtVal, displayName } from '@/lib/friends';
import { cx } from '@/components/way/ui';
import { Avatar } from './parts';

export const MEDAL = ['#facc15', '#cbd5e1', '#d97706'];
const EASE = 'transition-[width] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]';

export const moveOf = (r) => (r?.move > 0 ? { s: `▲ ${r.move}`, c: '#34d399' } : r?.move < 0 ? { s: `▼ ${-r.move}`, c: '#fb7185' } : { s: '', c: '#7c8aa0' });

function LevelPill({ level, className = '' }) {
  if (!level) return null;
  return (
    <span
      className={cx(
        'absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-way-line2 bg-way-card px-1.5 py-px font-mono text-[9px] font-semibold leading-tight text-way-ink2',
        className
      )}
    >
      LV {level}
    </span>
  );
}

/**
 * Podium for the top three, then a row per person below: rank, name,
 * @username, level, gap to the person above, streak, a bar and the move
 * since the day before. `ranked` rows: { id, v, rank?, move?, streak? };
 * `missing`: ids with no numbers yet.
 */
export default function Leaderboard({ m, ranked, missing = [], f, k = 1, note, compact = false }) {
  const podium = [1, 0, 2].map((i) => ranked[i] || null);
  const rest = [...ranked.slice(3), ...missing.map((id) => ({ id, v: null }))];
  const max = ranked[0]?.v || 1;
  const four = ranked.length + missing.length >= 4;
  const lvl = (id) => m.levelOfPerson?.(id);
  const nameOf = (id) => (id === m.me.id ? 'You' : displayName(m.person(id)));
  const rankOf = (r, i) => r.rank ?? i + 1;
  return (
    <div className="flex flex-col">
      <div className={cx('relative overflow-hidden px-3 pt-[26px]', !compact && 'lg:px-[60px] lg:pt-9')}>
        <div className="pointer-events-none absolute left-1/2 top-[-40px] h-[200px] w-[260px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.14),rgba(250,204,21,0)_70%)] lg:h-[340px] lg:w-[520px]" />
        {four ? <div className="way-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)]" /> : null}
        <div className={cx('relative grid grid-cols-3 items-end gap-2', !compact && 'lg:gap-[18px]')}>
          {podium.map((r, slot) => {
            const pi = [1, 0, 2][slot];
            const first = pi === 0;
            const p = r ? m.person(r.id) : null;
            const isMe = r?.id === m.me.id;
            const mv = moveOf(r);
            // Third rises first, then second, then the winner.
            const delay = [350, 700, 0][slot];
            const hM = (first ? 92 : pi === 1 ? 70 : 52) + 12;
            const hD = (first ? 150 : pi === 1 ? 112 : 84) + 20;
            const place = r ? rankOf(r, pi) : pi + 1;
            return (
              <div key={slot} className="flex min-w-0 flex-col items-center gap-2.5">
                {r ? (
                  <div className="way-drop flex min-w-0 max-w-full flex-col items-center gap-1.5" style={{ '--d': `${delay + 450}ms` }}>
                    {place === 1 ? <Crown size={20} className="text-way-gold" /> : null}
                    <div className="relative mb-1">
                      <Avatar
                        person={p}
                        isMe={isMe}
                        size={first ? 54 : 44}
                        className={compact ? '' : 'lg:hidden'}
                        ring={`0 0 0 3px #0f1420, 0 0 0 5px ${MEDAL[pi]}`}
                      />
                      {compact ? null : (
                        <Avatar
                          person={p}
                          isMe={isMe}
                          size={first ? 84 : 68}
                          className="hidden lg:flex"
                          ring={`0 0 0 4px #0f1420, 0 0 0 6px ${MEDAL[pi]}, 0 0 30px ${first ? 'rgba(250,204,21,.35)' : 'transparent'}`}
                        />
                      )}
                      <LevelPill level={lvl(r.id)} />
                    </div>
                    <span className={cx('max-w-full truncate text-xs font-semibold', !compact && 'lg:text-[15px]')}>{nameOf(r.id)}</span>
                    <span className={cx('font-mono text-xs font-semibold', !compact && 'lg:text-lg')} style={{ color: MEDAL[pi] }}>
                      {fmtVal(r.v, f.dec)}
                      <span className={cx('hidden text-[11px] text-way-dim', !compact && 'lg:inline')}> {f.unit}</span>
                    </span>
                    <span className="h-3 font-mono text-[10px] font-semibold leading-3" style={{ color: mv.c }}>
                      {mv.s}
                    </span>
                  </div>
                ) : (
                  <div className={cx('h-11 w-11 rounded-full border border-dashed border-way-line2', !compact && 'lg:h-[68px] lg:w-[68px]')} />
                )}
                <div
                  className={cx('way-column flex w-full items-start justify-center rounded-t-[10px] border border-b-0 pt-2', !compact && 'lg:rounded-t-[14px] lg:pt-3 lg:[height:var(--hd)]')}
                  style={{
                    height: hM,
                    '--hd': `${hD}px`,
                    '--d': `${delay}ms`,
                    background: first ? 'linear-gradient(180deg, rgba(250,204,21,.18), rgba(250,204,21,.03))' : 'linear-gradient(180deg, rgba(148,163,184,.12), rgba(148,163,184,.02))',
                    borderColor: first ? 'rgba(250,204,21,.35)' : '#253044',
                  }}
                >
                  <span className={cx('font-brand text-[30px] leading-none', !compact && 'lg:text-[54px]')} style={{ color: MEDAL[pi] }}>
                    {place}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {rest.length ? (
        <div className="border-t border-way-line2">
          {rest.map((r, i) => {
            const p = m.person(r.id);
            const isMe = r.id === m.me.id;
            const idx = ranked.indexOf(r);
            const above = r.v != null && idx > 0 ? ranked[idx - 1] : null;
            const mv = moveOf(r);
            const level = lvl(r.id);
            const sub = [
              r.v == null ? 'Hasn’t synced yet' : above ? `${fmtVal(above.v - r.v, f.dec)} ${f.unit} behind ${above.id === m.me.id ? 'You' : displayName(m.person(above.id))}` : null,
              r.streak >= 2 ? `${r.streak}-day streak` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <div
                key={r.id}
                className={cx('way-in-right flex items-center gap-3 px-4 py-3', !compact && 'lg:px-6', i && 'border-t border-way-line', isMe && 'bg-emerald-500/7')}
                style={{ '--d': `${1300 + i * 120}ms` }}
              >
                <span className="w-6 shrink-0 font-mono text-[13px] font-semibold text-way-dim">{r.v == null ? '–' : String(rankOf(r, idx)).padStart(2, '0')}</span>
                <Avatar person={p} isMe={isMe} size={32} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold">{isMe ? 'You' : displayName(p)}</span>
                    {p?.username ? <span className="hidden truncate font-mono text-[11px] text-way-dim sm:inline">@{p.username}</span> : null}
                    {level ? <span className="shrink-0 rounded border border-way-line2 px-1 font-mono text-[9px] font-semibold text-way-mute">LV {level}</span> : null}
                  </span>
                  <span className="truncate text-[11px] text-way-dim">{sub}</span>
                  <div className={cx('mt-1 h-[4px] overflow-hidden rounded-full bg-way-track', compact ? '' : 'sm:hidden')}>
                    <div className={cx('h-full rounded-full', EASE)} style={{ width: `${r.v == null ? 0 : (r.v / max) * 100 * k}%`, background: isMe ? '#34d399' : f.color }} />
                  </div>
                </div>
                {compact ? null : (
                  <div className="hidden h-[5px] w-[28%] shrink-0 overflow-hidden rounded-full bg-way-track sm:block">
                    <div className={cx('h-full rounded-full', EASE)} style={{ width: `${r.v == null ? 0 : (r.v / max) * 100 * k}%`, background: isMe ? '#34d399' : f.color }} />
                  </div>
                )}
                <div className="flex w-[72px] shrink-0 flex-col items-end gap-0.5">
                  <span className={cx('font-mono text-sm font-semibold', r.v == null ? 'text-way-faint' : 'text-way-ink')}>{r.v == null ? 'no data' : fmtVal(r.v, f.dec)}</span>
                  {mv.s ? (
                    <span className="font-mono text-[10px] font-semibold" style={{ color: mv.c }}>
                      {mv.s}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {note ? <div className={cx('border-t border-way-line px-4 pb-4 pt-3 text-[11px] text-way-dim', !compact && 'lg:px-6')}>{note}</div> : null}
    </div>
  );
}
