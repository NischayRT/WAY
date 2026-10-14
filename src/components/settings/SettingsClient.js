'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, UserRound, PersonStanding, Link2, CircleUserRound } from 'lucide-react';
import { PAGE, cx } from '@/components/way/ui';
import ProfileSection from './ProfileSection';
import BodySection from './BodySection';
import AppsSection from './AppsSection';
import AccountSection from './AccountSection';

const SECS = [
  ['profile', 'Profile & targets', 'Profile', UserRound, 'Basics, goal, daily targets'],
  ['body', 'Body', 'Body', PersonStanding, '3D body, measurements, goal'],
  ['apps', 'Connected apps', 'Apps', Link2, null],
  ['account', 'Account', 'Account', CircleUserRound, 'Sign out, delete, legal'],
];

export default function SettingsClient({ profile, email, initialSection, initialBodyTab, googleHealth, currentWeightKg, startKg, today, banner }) {
  const router = useRouter();
  const [sec, setSec] = useState(initialSection);
  const [seen, setSeen] = useState(initialSection);
  // A link to another ?tab= while Settings is open switches section.
  if (seen !== initialSection) {
    setSeen(initialSection);
    setSec(initialSection);
  }

  // Drop one-off query params (?google_health_connected=…) once shown.
  useEffect(() => {
    if (banner) router.replace(`/settings?tab=${initialSection}`, { scroll: false });
  }, [banner, initialSection, router]);

  const go = (key) => {
    setSec(key);
    window.history.replaceState(null, '', `/settings?tab=${key}`);
  };
  const hint = (key, h) => (key === 'apps' ? (googleHealth.connected ? 'Google Health · on' : 'Google Health · off') : h);

  return (
    <main className={PAGE}>
      <header className="flex items-center gap-3 px-0.5 md:items-baseline md:gap-3.5">
        <Link
          href="/home"
          aria-label="Back to Today"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-way-line2 bg-way-card text-way-ink2 md:hidden"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3.5">
          <h1 className="font-heading text-[28px] font-bold leading-none tracking-[-0.01em] md:text-[34px]">Settings</h1>
          <span className="truncate font-mono text-[11px] font-medium text-way-dim md:text-xs">{email}</span>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-way-line bg-way-card p-1 md:hidden">
        {SECS.map(([key, , short, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => go(key)}
            aria-pressed={sec === key}
            className={cx(
              'flex flex-col items-center gap-1 rounded-xl pb-[7px] pt-2 transition-colors duration-[250ms]',
              sec === key ? 'bg-way-ink text-way-page' : 'text-way-mute'
            )}
          >
            <Icon size={16} />
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.08em]">{short}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="sticky top-8 hidden flex-col gap-1 md:flex" aria-label="Settings sections">
          {SECS.map(([key, label, , Icon, h]) => {
            const on = sec === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => go(key)}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors',
                  on ? 'border-way-line2 bg-way-card' : 'border-transparent hover:bg-way-card'
                )}
              >
                <Icon size={17} className="w-5 shrink-0" style={{ color: on ? '#34d399' : '#64748b' }} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cx('text-sm font-semibold', on ? 'text-way-ink' : 'text-way-ink2')}>{label}</span>
                  <span className="text-[11px] text-way-dim">{hint(key, h)}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {sec === 'profile' ? <ProfileSection profile={profile} /> : null}
          {sec === 'body' ? <BodySection profile={profile} currentWeightKg={currentWeightKg} startKg={startKg} today={today} initialTab={initialBodyTab} /> : null}
          {sec === 'apps' ? (
            <AppsSection connected={googleHealth.connected} canWrite={googleHealth.canWrite} syncEnabled={googleHealth.syncEnabled} banner={banner} />
          ) : null}
          {sec === 'account' ? <AccountSection name={profile.full_name} email={email} /> : null}
        </div>
      </div>
    </main>
  );
}
