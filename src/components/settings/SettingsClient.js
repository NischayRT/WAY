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
import { MoreMenu } from '@/components/way/WayNav';

const SECS = [
  ['profile', 'Profile & targets', 'Profile', UserRound, 'Basics, goal, daily targets'],
  ['body', 'Body', 'Body', PersonStanding, '3D body, measurements, goal'],
  ['apps', 'Connected apps', 'Apps', Link2, null],
  ['account', 'Account', 'Account', CircleUserRound, 'Sign out, your data, legal'],
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

  const go = (key, { scroll = false } = {}) => {
    setSec(key);
    window.history.replaceState(null, '', `/settings?tab=${key}`);
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
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
        {/* Phones have no rail, so the ⋯ menu (log out) lives here. */}
        <MoreMenu placement="below" className="ml-auto md:hidden" />
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

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[56px_minmax(0,1fr)] md:gap-6">
        {/* Icon rail that opens over the content on hover (or keyboard focus). */}
        <div className="sticky top-6 z-40 hidden h-[232px] md:block">
          <nav
            className="group/rail absolute left-0 top-0 z-20 flex w-14 flex-col gap-1 overflow-hidden rounded-2xl border border-transparent p-1 transition-[width,background-color,border-color,box-shadow] duration-200 ease-out hover:w-64 hover:border-way-line hover:bg-way-card hover:shadow-[0_18px_40px_rgba(0,0,0,.45)] focus-within:w-64 focus-within:border-way-line focus-within:bg-way-card"
            aria-label="Settings sections"
          >
            {SECS.map(([key, label, , Icon, h]) => {
              const on = sec === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => go(key)}
                  aria-current={on ? 'page' : undefined}
                  title={label}
                  className={cx(
                    'flex h-[52px] w-full items-center gap-3 rounded-xl border px-[13px] text-left transition-colors',
                    on ? 'border-way-line2 bg-way-track' : 'border-transparent hover:bg-way-hover'
                  )}
                >
                  <Icon size={18} className="w-5 shrink-0" style={{ color: on ? '#34d399' : '#7c8aa0' }} />
                  <span className="flex min-w-0 flex-col gap-0.5 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
                    <span className={cx('text-sm font-semibold', on ? 'text-way-ink' : 'text-way-ink2')}>{label}</span>
                    <span className="text-[11px] text-way-dim">{hint(key, h)}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="min-w-0">
          {sec === 'profile' ? <ProfileSection profile={profile} onSaved={() => go('body', { scroll: true })} /> : null}
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
