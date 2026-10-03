// Browser-side helper: tell the server to mirror a change into Google Health.
// Never throws and never blocks the UI — if the user isn't connected, or
// Google is down, the log in WAY is unaffected.

const URL = '/api/google-health/sync';

/** Fire and forget (keepalive lets it finish even if the page navigates). */
export function syncToGoogleHealth(payload) {
  try {
    fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/** Same, but waits — used before deleting a row so the server can still read its Google Health id. */
export async function syncToGoogleHealthAndWait(payload) {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/** Turn a sync API result into { ok, text } for display next to a button. */
export function describeSyncResult(label, r) {
  if (!r) return { ok: false, text: `${label}: no response from the server.` };
  if (r.error && r.ok === undefined) return { ok: false, text: `${label}: ${r.error}` };
  if (r.skipped === 'not_connected') return { ok: false, text: `${label}: Google Health is not connected.` };
  if (r.skipped === 'missing_scope') return { ok: false, text: `${label}: permission missing - open Settings and tap "Reconnect & allow".` };
  if (r.skipped === 'reauth_required') return { ok: false, text: `${label}: Google session expired - reconnect in Settings.` };
  if (r.skipped === 'sync_off') return { ok: false, text: `${label}: sync is switched off in Settings.` };
  if (r.skipped) return { ok: false, text: `${label}: ${r.error || r.skipped}` };
  if (r.ok === false) return { ok: false, text: `${label}: ${r.error || (r.failures || []).join('; ') || 'failed'}` };
  const n = r.synced ?? 0;
  return { ok: true, text: `${label}: ${n} synced to Google Health.` };
}