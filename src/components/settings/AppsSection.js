'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, RefreshCw, CircleCheck, CircleAlert, TriangleAlert, Footprints, Navigation, Flame, HeartPulse, Moon, Droplets, Building2, Activity } from 'lucide-react';
import { Card, Eyebrow, Toggle, Btn, cx } from '@/components/way/ui';

const READS = [
  ['Steps', Footprints, '#60a5fa'],
  ['Distance', Navigation, '#34d399'],
  ['Energy', Flame, '#fbbf24'],
  ['Heart rate', HeartPulse, '#fb7185'],
  ['Sleep', Moon, '#818cf8'],
  ['SpO₂', Droplets, '#22d3ee'],
  ['Floors', Building2, '#f59e0b'],
  ['Glucose', Activity, '#2dd4bf'],
];
const CONNECT_HREF = '/api/google-health/connect?returnTo=%2Fsettings';

function describe(label, r) {
  if (!r) return { ok: false, text: `${label}: no response` };
  if (r.skipped === 'missing_scope') return { ok: false, text: `${label}: permission missing. Tap “Reconnect & allow” and tick every box.` };
  if (r.skipped === 'reauth_required') return { ok: false, text: `${label}: Google session expired. Reconnect Google Health.` };
  if (r.skipped === 'sync_off') return { ok: false, text: `${label}: sending is switched off.` };
  if (r.skipped) return { ok: false, text: `${label}: ${r.error || r.skipped}` };
  if (r.ok === false) return { ok: false, text: `${label}: ${r.error || (r.failures || []).join('; ') || 'failed'}` };
  if (r.note) return { ok: true, text: `${label}: ${r.note}.` };
  return { ok: true, text: `${label}: ${r.synced ?? 0} sent to Google Health.` };
}

/** Google Health: what it reads, sending meals and weight back, and the connection itself. */
export default function AppsSection({ connected, canWrite, syncEnabled: initialSync, banner }) {
  const router = useRouter();
  const [sync, setSync] = useState(initialSync);
  const [busy, setBusy] = useState(null);
  const [report, setReport] = useState([]);
  const [error, setError] = useState(null);

  const state = !connected ? 'off' : canWrite ? 'on' : 'read';
  const status = state === 'on' ? 'Connected · reading and writing' : state === 'read' ? 'Connected · read only' : 'Not connected';
  const statusColor = state === 'on' ? '#34d399' : state === 'read' ? '#fbbf24' : '#64748b';
  const blurb =
    state === 'off'
      ? 'Bring in steps, heart rate, sleep and more from Fitbit or any Google-connected device, and send your meals and weight back to the Google Health app. Unlocks Body Age and Health tiles on Today.'
      : 'Activity from your Fitbit and Google-connected devices feeds Body Age, Health tiles and your daily score.';

  const toggleSync = async (next) => {
    setSync(next);
    setReport([]);
    setError(null);
    try {
      const res = await fetch('/api/google-health/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_enabled', enabled: next }),
      });
      if (!res.ok) throw new Error('Could not update the sending setting.');
    } catch (e) {
      setSync(!next);
      setError(e.message);
    }
  };
  const syncNow = async () => {
    if (!sync || busy) return;
    setBusy('sync');
    setReport([]);
    try {
      const res = await fetch('/api/google-health/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backfill' }),
      });
      const data = await res.json().catch(() => null);
      setReport(data && !data.error ? [describe('Meals (today)', data.food), describe('Weight (latest)', data.weight)] : [{ ok: false, text: data?.error || 'Sync request failed.' }]);
    } catch {
      setReport([{ ok: false, text: 'Could not reach the server.' }]);
    } finally {
      setBusy(null);
    }
  };
  const disconnect = async () => {
    setBusy('disconnect');
    setError(null);
    try {
      const res = await fetch('/api/google-health/disconnect', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not disconnect.');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="flex max-w-[820px] flex-col gap-4 p-[18px] md:gap-[22px] md:p-7">
      <Eyebrow className="md:hidden">Connected apps</Eyebrow>
      {banner ? (
        <p className={cx('rounded-xl border px-3.5 py-2.5 text-[13px]', banner.type === 'error' ? 'border-rose-400/35 bg-rose-400/8 text-rose-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300')}>
          {banner.message}
        </p>
      ) : null}
      <div className="flex items-center gap-3 md:gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-way-line2 bg-way-hover md:h-[52px] md:w-[52px] md:rounded-2xl">
          <Heart size={22} className="text-way-carbs" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px] md:gap-1">
          <span className="text-[15px] font-semibold md:font-heading md:text-2xl md:font-bold md:leading-none">Google Health</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium md:text-xs" style={{ color: statusColor }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
            {status}
          </span>
        </div>
        {connected ? (
          <Btn variant="outline" onClick={disconnect} disabled={busy === 'disconnect'} className="hidden font-medium md:inline-flex">
            {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
          </Btn>
        ) : (
          <Btn as="a" href={CONNECT_HREF} variant="primary" className="hidden md:inline-flex">
            Log in to Google Health
          </Btn>
        )}
      </div>
      <p className="max-w-[620px] text-[13px] leading-normal text-way-mute [text-wrap:pretty] md:text-sm">{blurb}</p>

      {connected ? (
        <div className="flex flex-col gap-2 md:gap-2.5">
          <span className="font-heading text-[10px] font-bold tracking-[0.12em] text-way-dim md:text-[11px]">
            READING<span className="hidden md:inline"> FROM GOOGLE HEALTH</span>
          </span>
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {READS.map(([label, Icon, color]) => (
              <span key={label} className="flex items-center gap-[5px] rounded-full border border-way-line2 px-[9px] py-[5px] text-[11px] text-way-ink2 md:gap-1.5 md:px-[11px] md:py-1.5 md:text-xs">
                <Icon size={12} style={{ color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {state === 'on' ? (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-way-line md:grid md:grid-cols-2">
          <div className="flex items-center justify-between gap-3 p-3.5 md:p-[18px]">
            <div className="flex flex-col gap-0.5 md:gap-[3px]">
              <span className="text-sm font-semibold">Send logs to Google Health</span>
              <span className="text-[11px] leading-snug text-way-dim md:text-xs">Meals (kcal, protein, carbs, fat) and weight</span>
            </div>
            <Toggle on={sync} onChange={toggleSync} label="Send logs to Google Health" />
          </div>
          <div className="flex flex-col gap-2.5 border-t border-way-line p-3.5 md:border-l md:border-t-0 md:p-[18px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-way-mute">{sync ? 'New meals and weigh-ins are sent as you log them' : 'Sending is off'}</span>
              <Btn variant="outline" size="sm" onClick={syncNow} disabled={!sync || !!busy} className="rounded-[10px]">
                <RefreshCw size={12} className={busy === 'sync' ? 'animate-spin' : ''} />
                {busy === 'sync' ? 'Syncing…' : 'Sync now'}
              </Btn>
            </div>
            {report.map((r) => (
              <span key={r.text} className={cx('flex items-center gap-1.5 text-xs', r.ok ? 'text-emerald-300' : 'text-rose-300')}>
                {r.ok ? <CircleCheck size={13} /> : <CircleAlert size={13} />}
                {r.text}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {state === 'read' ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-400/35 bg-amber-400/6 p-3.5 md:flex-row md:items-center md:gap-4 md:p-[18px]">
          <TriangleAlert size={20} className="hidden shrink-0 text-amber-300 md:block" />
          <div className="flex flex-1 flex-col gap-[3px]">
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <TriangleAlert size={15} className="md:hidden" />
              WAY can only read
            </span>
            <span className="text-xs leading-normal text-way-ink2 md:text-[13px]">
              Meals and weight won&apos;t reach Google Health. Reconnect and tick the food and body measurement boxes on Google&apos;s screen.
            </span>
          </div>
          <Btn as="a" href={CONNECT_HREF} variant="primary" size="sm" className="self-start rounded-[10px] md:self-auto">
            Reconnect &amp; allow
          </Btn>
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-rose-300">{error}</p> : null}

      {connected ? (
        <Btn variant="outline" onClick={disconnect} disabled={busy === 'disconnect'} className="h-11 font-medium md:hidden">
          {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect Google Health'}
        </Btn>
      ) : (
        <Btn as="a" href={CONNECT_HREF} variant="primary" size="lg" className="md:hidden">
          Log in to Google Health
        </Btn>
      )}
    </Card>
  );
}
