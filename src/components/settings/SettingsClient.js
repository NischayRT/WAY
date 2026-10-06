'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import ProfileForm from '@/components/forms/ProfileForm';
import BodyStudio from '@/components/body/BodyStudio';
import { User, Activity, LogOut, Trash2, CalendarDays, Link2, Heart, AlertTriangle } from 'lucide-react';
import { getCurrentUserId } from '@/lib/currentUser';
import { ui } from '@/lib/ui';

function prefetchBodyStudio() {
  import('@/components/body/BodyStudioCanvas').catch(() => {});
}

export default function SettingsClient({
  initialProfile,
  googleHealthConnected = false,
  googleHealthSync = { enabled: true, canWrite: false },
}) {
  const supabase = createClient();
  const router = useRouter();
  
  const [activeSection, setActiveSection] = useState('profile');
  const [hasVisitedBody, setHasVisitedBody] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [disconnectingGoogleHealth, setDisconnectingGoogleHealth] = useState(false);
  const [googleHealthBanner, setGoogleHealthBanner] = useState(null);
  const [syncEnabled, setSyncEnabled] = useState(googleHealthSync.enabled);
  const [savingSync, setSavingSync] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncReport, setSyncReport] = useState(null);

  // Parse URL search parameters on load to check if ?tab=body was provided
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'body') {
      setActiveSection('body');
      setHasVisitedBody(true);
      prefetchBodyStudio();
    }

    const connected = params.get('google_health_connected');
    const error = params.get('google_health_error');
    if (connected && params.get('google_health_write') === 'missing') {
      setGoogleHealthBanner({
        type: 'error',
        message:
          'Connected, but the food and body-measurement permissions were not ticked on Google\u2019s screen, so meals and weight will not sync. Tap \u201cReconnect & allow\u201d and tick every box.',
      });
      router.replace('/settings');
    } else if (connected) {
      setGoogleHealthBanner({ type: 'success', message: 'Google Health connected.' });
      router.replace('/settings');
    } else if (error) {
      // Only known codes map to text; anything else shows a generic message,
      // so a crafted link can't put arbitrary text in this banner.
      const GH_ERRORS = {
        access_denied: 'Google Health access was not granted.',
        state_mismatch: 'The connection request expired. Please try again.',
        missing_code: 'Google did not complete the connection. Please try again.',
        no_refresh_token: 'Google did not return a refresh token. Disconnect in Settings and reconnect.',
        token_exchange_failed: 'Google rejected the connection. Please try again.',
      };
      setGoogleHealthBanner({
        type: 'error',
        message: `Could not connect Google Health. ${GH_ERRORS[error] ?? 'Please try again.'}`,
      });
      router.replace('/settings');
    }
  }, [router]);

  useEffect(() => {
    const idle =
      typeof window !== 'undefined' && window.requestIdleCallback
        ? window.requestIdleCallback
        : (fn) => setTimeout(fn, 1500);

    const id = idle(prefetchBodyStudio);
    return () => {
      if (typeof window !== 'undefined' && window.cancelIdleCallback) {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, []);

  const handleTabClick = (section) => {
    setActiveSection(section);
    if (section === 'body') setHasVisitedBody(true);
  };

  const handleSaved = () => {
    setJustSaved(true);
    router.refresh();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const describeSync = (label, r) => {
    if (!r) return { ok: false, text: `${label}: no response` };
    if (r.skipped === 'missing_scope') return { ok: false, text: `${label}: permission missing - tap "Reconnect & allow" and tick every box.` };
    if (r.skipped === 'reauth_required') return { ok: false, text: `${label}: Google session expired - reconnect Google Health.` };
    if (r.skipped === 'sync_off') return { ok: false, text: `${label}: sync is switched off.` };
    if (r.skipped) return { ok: false, text: `${label}: ${r.error || r.skipped}` };
    if (r.ok === false) return { ok: false, text: `${label}: ${r.error || (r.failures || []).join('; ') || 'failed'}` };
    if (r.note) return { ok: true, text: `${label}: ${r.note}.` };
    return { ok: true, text: `${label}: ${r.synced ?? 0} synced to Google Health.` };
  };

  const handleSyncNow = async () => {
    setSyncingNow(true);
    setSyncReport(null);
    try {
      const res = await fetch('/api/google-health/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backfill' }),
      });
      const data = await res.json().catch(() => null);
      setSyncReport(
        data && !data.error
          ? [describeSync('Meals (today)', data.food), describeSync('Weight (latest)', data.weight)]
          : [{ ok: false, text: data?.error || 'Sync request failed.' }]
      );
    } catch {
      setSyncReport([{ ok: false, text: 'Could not reach the server.' }]);
    } finally {
      setSyncingNow(false);
    }
  };

  const handleToggleSync = async () => {
    const next = !syncEnabled;
    setSyncEnabled(next);
    setSavingSync(true);
    try {
      const res = await fetch('/api/google-health/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_enabled', enabled: next }),
      });
      if (!res.ok) throw new Error('Could not update sync setting');
    } catch (err) {
      setSyncEnabled(!next);
      setGoogleHealthBanner({ type: 'error', message: err.message });
    } finally {
      setSavingSync(false);
    }
  };

  const handleDisconnectGoogleHealth = async () => {
    setDisconnectingGoogleHealth(true);
    setGoogleHealthBanner(null);
    try {
      const res = await fetch('/api/google-health/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect');
      router.refresh();
    } catch (err) {
      setGoogleHealthBanner({ type: 'error', message: err.message });
    } finally {
      setDisconnectingGoogleHealth(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);

    let userId;
    try {
      userId = await getCurrentUserId(supabase);
    } catch (authError) {
      setDeleting(false);
      setDeleteError(authError.message);
      return;
    }

    // Revoke Google Health access and delete the stored tokens (best effort).
    await fetch('/api/google-health/disconnect', { method: 'POST' }).catch(() => {});

    const { error: logsError } = await supabase.from('food_logs').delete().eq('user_id', userId);
    if (logsError) {
      setDeleting(false);
      setDeleteError(`Could not remove food logs: ${logsError.message}`);
      return;
    }

    const { error: weightError } = await supabase.from('weight_logs').delete().eq('user_id', userId);
    if (weightError) {
      setDeleting(false);
      setDeleteError(`Could not remove weight logs: ${weightError.message}`);
      return;
    }

    const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileError) {
      setDeleting(false);
      setDeleteError(`Could not remove your profile: ${profileError.message}`);
      return;
    }

    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const tabBase =
    'relative flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-semibold transition';
  const tabOn =
    'bg-slate-100 dark:bg-[#0f1d38] text-slate-900 dark:text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-emerald-500 dark:after:bg-emerald-400';
  const tabOff =
    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] gap-x-5 gap-y-4 items-start">
      {/* Tabs — sit above the left column only */}
      <div
        role="tablist"
        className={`${ui.panel} grid grid-cols-2 overflow-hidden lg:col-start-1 lg:row-start-1`}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'profile'}
          onClick={() => handleTabClick('profile')}
          className={`${tabBase} ${activeSection === 'profile' ? tabOn : tabOff}`}
        >
          <User size={16} /> Profile &amp; Targets
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'body'}
          onClick={() => handleTabClick('body')}
          onMouseEnter={prefetchBodyStudio}
          onFocus={prefetchBodyStudio}
          onTouchStart={prefetchBodyStudio}
          className={`${tabBase} ${activeSection === 'body' ? tabOn : tabOff}`}
        >
          <Activity size={16} /> Body Measurements
        </button>
      </div>

      {/* Left / wide column */}
      <div className="space-y-4 min-w-0 lg:col-start-1 lg:row-start-2">
        {justSaved && (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            Profile updated successfully.
          </p>
        )}

        <div className={activeSection === 'profile' ? '' : 'hidden'}>
          <ProfileForm variant="settings" initialProfile={initialProfile} onSaved={handleSaved} />
        </div>

        {hasVisitedBody && (
          <div className={activeSection === 'body' ? `${ui.panel} p-2` : 'hidden'}>
            <BodyStudio profile={initialProfile} />
          </div>
        )}
      </div>

      {/* Right / narrow column */}
      <div className="space-y-4 min-w-0 lg:col-start-2 lg:row-start-2">
        {/* Session */}
        <div className={`${ui.panel} flex items-center justify-between gap-4 p-4 sm:p-5`}>
          <div className="flex items-start gap-3 min-w-0">
            <CalendarDays size={22} className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-200" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Session</h3>
              <p className="text-xs text-slate-500 dark:text-sky-300/70 mt-0.5">
                Sign out of your WAY account on this device.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-300 transition-all hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <LogOut size={15} />
            <span>{loggingOut ? 'Signing out...' : 'Log out'}</span>
          </button>
        </div>

        {/* Connected Apps */}
        <div className={`${ui.panel} p-4 sm:p-5 space-y-4`}>
          <div className="flex items-start gap-3">
            <Link2 size={22} className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-200" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Connected Apps</h3>
              <p className="text-xs text-slate-500 dark:text-sky-300/70 mt-0.5">
                Bring in steps and activity data from your Fitbit or Google-connected devices, and send
                your food logs and weight to the Google Health app.
              </p>
            </div>
          </div>

          {googleHealthBanner && (
            <p
              className={`text-xs font-medium ${
                googleHealthBanner.type === 'error'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {googleHealthBanner.message}
            </p>
          )}

          <div className={`${ui.panelInner} flex items-center justify-between gap-3 p-3`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-[#111d36] border border-slate-200 dark:border-[#1d3050]">
                <Heart size={20} className="fill-blue-500 text-blue-500" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-white">Google Health</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {googleHealthConnected ? 'Connected' : 'Not connected'}
                </p>
              </div>
            </div>

            {googleHealthConnected ? (
              <button
                type="button"
                onClick={handleDisconnectGoogleHealth}
                disabled={disconnectingGoogleHealth}
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-[#1d3050] bg-white dark:bg-[#0a1224] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#101c36] transition disabled:opacity-50 cursor-pointer"
              >
                {disconnectingGoogleHealth ? 'Disconnecting...' : 'Disconnect'}
              </button>
            ) : (
              <a
                href="/api/google-health/connect"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition cursor-pointer"
              >
                Connect
              </a>
            )}
          </div>

          {googleHealthConnected && (
            googleHealthSync.canWrite ? (
              <>
              <div className={`${ui.panelInner} flex items-center justify-between gap-3 p-3`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">Sync logs to Google Health</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Meals (calories, protein, carbs, fat) and weight appear in the Google Health app.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={syncEnabled}
                  onClick={handleToggleSync}
                  disabled={savingSync}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                    syncEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      syncEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
              <div className={`${ui.panelInner} p-3 space-y-2`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Push today&apos;s meals and your latest weight to Google Health now.
                  </p>
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={syncingNow}
                    className="shrink-0 rounded-xl border border-slate-200 dark:border-[#1d3050] bg-white dark:bg-[#0a1224] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#101c36] transition disabled:opacity-50 cursor-pointer"
                  >
                    {syncingNow ? 'Syncing...' : 'Sync now'}
                  </button>
                </div>
                {syncReport && (
                  <ul className="space-y-1">
                    {syncReport.map((r, i) => (
                      <li key={i} className={`text-xs font-medium ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              </>
            ) : (
              <div className="rounded-xl border border-amber-200 dark:border-rose-900/50 bg-amber-50/60 dark:bg-[#1a0f1c]/70 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-white" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      Allow WAY to write to Google Health
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Your connection only lets WAY read activity. Reconnect and tick the food and body
                      measurement permissions to send meals and weight to the Google Health app.
                    </p>
                  </div>
                </div>
                <a
                  href="/api/google-health/connect"
                  className="mt-4 ml-8 inline-flex items-center justify-center rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition"
                >
                  Reconnect &amp; allow
                </a>
              </div>
            )
          )}
        </div>

        {/* Danger Zone */}
        <div className={`${ui.panel} border-rose-200 dark:border-rose-900/50 p-4 sm:p-5 space-y-3`}>
          <div>
            <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Danger Zone</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Permanently erase your profile, food logs, and weight logs. This cannot be undone.
            </p>
          </div>

          {!confirmingDelete ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-4">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-300 dark:border-rose-800/80 bg-white dark:bg-[#0a1224] px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-300 transition-all hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-[0.98] cursor-pointer"
              >
                <Trash2 size={15} />
                <span>Delete account</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                Are you sure? This deletes your profile, every food log, and every weight log —
                permanently.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can still sign back in afterward with the same account, but you&apos;ll start over
                from onboarding.
              </p>

              {deleteError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{deleteError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>{deleting ? 'Deleting...' : 'Yes, delete my account'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">Privacy Policy</Link>
          <span className="mx-2">&middot;</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}