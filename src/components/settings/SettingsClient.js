'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import ProfileForm from '@/components/forms/ProfileForm';
import BodyStudio from '@/components/body/BodyStudio';
import { User, Activity, LogOut } from 'lucide-react';
import { ui } from '@/lib/ui';

// Warms up the 3D chunk (BodyStudioCanvas -> RealisticAvatar3D -> Three.js
// + the GLTF model) in the background, BEFORE the user clicks the tab.
// Calling this only starts real work the first time — subsequent calls are
// no-ops since the dynamic import is already cached by the module system.
function prefetchBodyStudio() {
  import('@/components/body/BodyStudioCanvas').catch(() => {});
}

export default function SettingsClient({ userId, initialProfile }) {
  const supabase = createClient();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('profile');
  // BodyStudio contains a WebGL canvas — genuinely expensive to construct
  // (GPU context, geometry cloning, OrbitControls setup). Previously this
  // whole section was gated behind a ternary, so React fully unmounted and
  // rebuilt it from scratch on every single tab switch. Now it mounts once
  // (only once the user actually visits the tab, not eagerly on page load)
  // and stays mounted — switching tabs afterward just toggles CSS
  // visibility, which is instant.
  const [hasVisitedBody, setHasVisitedBody] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Low-priority background warm-up, mainly for mobile/touch where there's
  // no hover to signal intent ahead of a tap. Runs once, after the page has
  // had a moment to settle, so it never competes with the initial Profile
  // tab render for bandwidth/CPU.
  useEffect(() => {
    const idle =
      typeof window !== 'undefined' && window.requestIdleCallback
        ? window.requestIdleCallback
        : (fn) => setTimeout(fn, 1500);
    const cancelIdle =
      typeof window !== 'undefined' && window.cancelIdleCallback ? window.cancelIdleCallback : clearTimeout;

    const id = idle(prefetchBodyStudio);
    return () => cancelIdle(id);
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

  return (
    <div className="mx-auto max-w-xl py-6 space-y-5">
      {/* Settings Navigation Tabs */}
      <div className="grid grid-cols-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 font-semibold text-xs text-slate-600 dark:text-slate-300">
        <button
          type="button"
          onClick={() => handleTabClick('profile')}
          className={`flex items-center justify-center gap-1 py-2.5 rounded-lg transition ${
            activeSection === 'profile'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User size={14} /> Profile & Targets
        </button>
        <button
          type="button"
          onClick={() => handleTabClick('body')}
          onMouseEnter={prefetchBodyStudio}
          onFocus={prefetchBodyStudio}
          onTouchStart={prefetchBodyStudio}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition ${
            activeSection === 'body'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Activity size={14} /> Body Measurements
        </button>
      </div>

      {justSaved && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Profile updated successfully.
        </p>
      )}

      {/* Active Tab Content Container with proper padding and internal form spacing */}
      <div className={`${ui.card} p-2`}>
        <div className={activeSection === 'profile' ? 'space-y-4' : 'hidden'}>
          <ProfileForm userId={userId} initialProfile={initialProfile} onSaved={handleSaved} />
        </div>

        {hasVisitedBody && (
          <div className={activeSection === 'body' ? 'space-y-4' : 'hidden'}>
            <BodyStudio profile={initialProfile} />
          </div>
        )}
      </div>

      {/* Log Out Section */}
      <div className={`${ui.card} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6`}>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Session</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sign out of your WAY account on this device.</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-300 shadow-2xs transition-all hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-[0.98] disabled:opacity-50 cursor-pointer w-full sm:w-auto justify-center"
        >
          <LogOut size={15} />
          <span>{loggingOut ? 'Signing out...' : 'Log out'}</span>
        </button>
      </div>
    </div>
  );
}