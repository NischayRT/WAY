'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, TrendingUp, Plus, Activity, Users, Settings, Ellipsis, LogOut, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { cx } from './ui';
import { invalidateJson } from './useJson';

const NAV = [
  { href: '/home', label: 'Today', Icon: House },
  { href: '/nutrition', label: 'Nutrition', Icon: TrendingUp },
  { href: '/log-food', label: 'Log food', Icon: Plus, log: true },
  { href: '/activity', label: 'Activity', Icon: Activity },
  { href: '/friends', label: 'Friends', Icon: Users },
];

const isActive = (pathname, href) => pathname === href || pathname.startsWith(`${href}/`);

/** Label that slides out to the right of a rail icon on hover. */
function Tip({ children }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-lg border border-way-line2 bg-[#111827] px-2.5 py-1 text-xs font-semibold text-way-ink opacity-0 shadow-[0_8px_20px_rgba(0,0,0,.4)] transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
      {children}
    </span>
  );
}

/** "⋯" next to Settings: account and log out. */
export function MoreMenu({ placement = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const logout = async () => {
    setBusy(true);
    await createClient().auth.signOut();
    invalidateJson();
    router.push('/login');
    router.refresh();
  };

  return (
    <div ref={ref} className={cx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx(
          'flex h-9 w-9 items-center justify-center rounded-xl text-way-dim transition-[background,color,transform] duration-200 hover:bg-way-hover hover:text-way-ink active:scale-90',
          open && 'bg-way-hover text-way-ink'
        )}
      >
        <Ellipsis size={18} />
      </button>
      {open ? (
        <div
          role="menu"
          className={cx(
            'way-pop absolute z-[60] w-44 overflow-hidden rounded-xl border border-way-line2 bg-[#111827] p-1 shadow-[0_16px_40px_rgba(0,0,0,.5)]',
            placement === 'right' ? 'bottom-0 left-full ml-3 origin-bottom-left' : 'right-0 top-full mt-2 origin-top-right'
          )}
          style={{ '--d': '0ms', animationDuration: '.25s' }}
        >
          <Link
            href="/settings?tab=account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-way-ink2 hover:bg-way-hover hover:text-way-ink"
          >
            <UserRound size={15} />
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            disabled={busy}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
          >
            <LogOut size={15} />
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Desktop: a 76px rail (logo, five destinations, Settings with a ⋯ menu and
 * the avatar at the bottom). Hovering slides out a label; the active item
 * gets a marker that glides between items. Phones: a five-slot bottom bar
 * with Log food raised in the middle and a sliding indicator.
 */
export default function WayNav({ initial = 'W' }) {
  const pathname = usePathname() || '';
  const settingsOn = isActive(pathname, '/settings');
  const activeIndex = NAV.findIndex((n) => isActive(pathname, n.href));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[76px] flex-col items-center gap-7 border-r border-way-line bg-way-rail py-6 md:flex">
        <Link href="/home" className="font-brand text-2xl leading-none tracking-[0.02em] text-way-ink transition-transform duration-300 hover:scale-110" aria-label="WAY home">
          WAY
        </Link>
        <nav className="relative flex flex-col items-center gap-2" aria-label="Main">
          {/* Marker that glides to the active item (44px items + 8px gaps). */}
          <span
            aria-hidden="true"
            className="absolute -left-4 top-0 h-6 w-1 rounded-r-full bg-way-ink transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ transform: `translateY(${Math.max(0, activeIndex) * 52 + 10}px)`, opacity: activeIndex >= 0 ? 1 : 0 }}
          />
          {NAV.map(({ href, label, Icon, log }) => {
            const on = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'group relative flex h-11 w-11 items-center justify-center rounded-xl transition-[background,color,transform,box-shadow] duration-200 hover:-translate-y-px active:scale-95',
                  log
                    ? on
                      ? 'border border-emerald-400/35 bg-emerald-500 text-way-page shadow-[0_0_18px_rgba(16,185,129,.45)]'
                      : 'border border-emerald-400/35 bg-emerald-400/12 text-way-protein hover:bg-emerald-400/20 hover:shadow-[0_0_14px_rgba(16,185,129,.3)]'
                    : on
                      ? 'bg-way-ink text-way-page shadow-[0_6px_18px_rgba(241,245,249,.12)]'
                      : 'text-way-dim hover:bg-way-hover hover:text-way-ink'
                )}
              >
                {/* Remounts on selection so the icon pops. */}
                <span key={on ? 'on' : 'off'} className={cx('flex transition-transform duration-200 group-hover:scale-110', on && 'way-pop')} style={{ '--d': '0ms' }}>
                  <Icon size={19} />
                </span>
                <Tip>{label}</Tip>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-2">
          <Link
            href="/settings"
            aria-label="Settings"
            aria-current={settingsOn ? 'page' : undefined}
            className={cx(
              'group relative flex h-11 w-11 items-center justify-center rounded-xl transition-[background,color,transform] duration-200 active:scale-95',
              settingsOn ? 'bg-way-ink text-way-page' : 'text-way-dim hover:bg-way-hover hover:text-way-ink'
            )}
          >
            <span className="flex transition-transform duration-500 group-hover:rotate-90">
              <Settings size={19} />
            </span>
            <Tip>Settings</Tip>
          </Link>
          <MoreMenu />
          <Link
            href="/settings?tab=account"
            title="Account"
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-way-line2 bg-way-track text-[13px] font-semibold text-way-ink transition-transform duration-200 hover:scale-110"
          >
            {initial}
          </Link>
        </div>
      </aside>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 items-center border-t border-way-line bg-way-rail/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {/* Indicator that slides above the active tab. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 h-[3px] rounded-b-full bg-way-ink transition-[left,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ left: `calc(8px + (100% - 16px) / 5 * ${Math.max(0, activeIndex)} + (100% - 16px) / 10 - 14px)`, width: 28, opacity: activeIndex >= 0 && !NAV[activeIndex]?.log ? 1 : 0 }}
        />
        {NAV.map(({ href, label, Icon, log }) => {
          const on = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? 'page' : undefined}
              className={cx(
                'flex min-h-11 flex-col items-center justify-center gap-1 text-[10px] transition-colors active:scale-95',
                on ? 'font-semibold text-slate-50' : 'font-medium text-way-dim'
              )}
            >
              <span
                key={on ? 'on' : 'off'}
                className={cx(
                  'flex items-center justify-center rounded-[14px] transition-transform',
                  log ? cx('h-11 w-11 text-way-page', on ? 'bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,.5)]' : 'bg-way-protein') : 'h-[26px] w-[26px]',
                  on && 'way-pop'
                )}
                style={{ '--d': '0ms' }}
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
