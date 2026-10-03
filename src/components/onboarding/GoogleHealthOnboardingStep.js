'use client';

import { Footprints } from 'lucide-react';
import { ui } from '@/lib/ui';

export default function GoogleHealthOnboardingStep({ onSkip }) {
  return (
    <div className={`${ui.card} space-y-5`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
          <Footprints size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Track your steps <span className="font-medium text-slate-400">(optional)</span>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Connect Google Health to see your steps, distance and calories burned, and to keep your food and weight logs in sync.
          </p>
        </div>
      </div>

      <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed list-disc pl-4">
        <li>
          Install the <span className="font-semibold text-slate-700 dark:text-slate-200">Google Health</span> app
          on your phone and sign in with the Google account you connect here — that&apos;s how your
          phone&apos;s steps reach your account.
        </li>
        <li>Steps sync through that app, so the number can trail a few minutes behind.</li>
        <li>
          You&apos;ll also be asked to let WAY save your meals (calories and macros) and weight to
          Google Health. You can switch this off any time in Settings.
        </li>
        <li>Steps recorded only in other apps (like Samsung Health) won&apos;t be included.</li>
      </ul>

      <div className="flex flex-col gap-2">
        <a href="/api/google-health/connect?returnTo=/home" className={`${ui.btnPrimary} w-full justify-center`}>
          Connect Google Health
        </a>
        <button type="button" onClick={onSkip} className={`${ui.btnSecondary} w-full justify-center`}>
          Skip for now
        </button>
      </div>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
        You can connect or disconnect any time from Settings.
      </p>
    </div>
  );
}
