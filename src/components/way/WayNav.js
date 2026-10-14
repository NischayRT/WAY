'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, TrendingUp, Plus, Activity, Users, Settings } from 'lucide-react';
import { cx } from './ui';

const NAV = [
  { href: '/home', label: 'Today', Icon: House },
  { href: '/nutrition', label: 'Nutrition', Icon: TrendingUp },
  { href: '/log-food', label: 'Log food', Icon: Plus, log: true },
  { href: '/activity', label: 'Activity', Icon: Activity },
  { href: '/friends', label: 'Friends', Icon: Users },
];

const isActive = (pathname, href) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Desktop: a 76px rail (logo, five destinations, Settings and the avatar at
 * the bottom). Phones: a five-slot bottom bar with Log food raised in the middle.
 */
export default function WayNav({ initial = 'W' }) {
  const pathname = usePathname() || '';
  const settingsOn = isActive(pathname, '/settings');

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[76px] flex-col items-center gap-7 border-r border-way-line bg-way-rail py-6 md:flex">
        <Link href="/home" className="font-brand text-2xl leading-none tracking-[0.02em] text-way-ink" aria-label="WAY home">
          WAY
        </Link>
        <nav className="flex flex-col items-center gap-2" aria-label="Main">
          {NAV.map(({ href, label, Icon, log }) => {
            const on = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200',
                  log
                    ? on
                      ? 'border border-emerald-400/35 bg-emerald-500 text-way-page'
                      : 'border border-emerald-400/35 bg-emerald-400/12 text-way-protein hover:bg-emerald-400/20'
                    : on
                      ? 'bg-way-ink text-way-page'
                      : 'text-way-dim hover:text-way-ink'
                )}
              >
                <Icon size={19} />
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-3">
          <Link
            href="/settings"
            title="Settings"
            aria-label="Settings"
            aria-current={settingsOn ? 'page' : undefined}
            className={cx(
              'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
              settingsOn ? 'bg-way-ink text-way-page' : 'text-way-dim hover:text-way-ink'
            )}
          >
            <Settings size={19} />
          </Link>
          <Link
            href="/settings?tab=account"
            title="Account"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-way-line2 bg-way-track text-[13px] font-semibold text-way-ink"
          >
            {initial}
          </Link>
        </div>
      </aside>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 items-center border-t border-way-line bg-way-rail/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {NAV.map(({ href, label, Icon, log }) => {
          const on = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? 'page' : undefined}
              className={cx(
                'flex min-h-11 flex-col items-center justify-center gap-1 text-[10px] transition-colors',
                on ? 'font-bold text-slate-50' : 'font-medium text-way-dim'
              )}
            >
              <span
                className={cx(
                  'flex items-center justify-center rounded-[14px]',
                  log ? cx('h-11 w-11 text-way-page', on ? 'bg-emerald-500' : 'bg-way-protein') : 'h-[26px] w-[26px]'
                )}
              >
                <Icon size={log ? 22 : 20} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
