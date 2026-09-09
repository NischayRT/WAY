'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileForm from '@/components/forms/ProfileForm';
import BodyStudio from '@/components/body/BodyStudio';
import { User, Activity } from 'lucide-react';

export default function SettingsClient({ userId, initialProfile }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('profile');
  const [justSaved, setJustSaved] = useState(false);

  const handleSaved = () => {
    setJustSaved(true);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Settings Navigation Tabs */}
      <div className="grid grid-cols-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 font-semibold text-xs text-slate-600 dark:text-slate-300">
        <button
          type="button"
          onClick={() => setActiveSection('profile')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${
            activeSection === 'profile'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User size={14} /> Profile & Targets
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('body')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${
            activeSection === 'body'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Activity size={14} /> Body Measurements
        </button>
      </div>

      {justSaved && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          Profile updated successfully.
        </p>
      )}

      {activeSection === 'profile' ? (
        <ProfileForm userId={userId} initialProfile={initialProfile} onSaved={handleSaved} />
      ) : (
        <div className="space-y-4">
          <BodyStudio profile={initialProfile} />
        </div>
      )}
    </div>
  );
}