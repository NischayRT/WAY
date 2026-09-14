'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, TrendingUp, Scale, Settings } from 'lucide-react';

const ITEMS = [
  { href: '/home', label: 'Today', icon: Home },
  { href: '/log-food', label: 'Log Food', icon: PlusCircle },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/weight', label: 'Weight', icon: Scale },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-3 py-2">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
                  isActive
                    ? 'text-slate-900 dark:text-white font-bold'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] tracking-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <aside className="group hidden md:flex fixed top-0 left-0 bottom-0 z-50 flex-col justify-between border-r border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 shadow-lg shadow-slate-900/5 dark:shadow-black/50 transition-all duration-300 ease-in-out w-16 hover:w-[10.5rem] 2xl:hover:w-64 overflow-hidden">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-1 pt-1 select-none">
            <Link
              href="/home"
              className="font-brand text-2xl tracking-normal text-slate-900 dark:text-white shrink-0 leading-none transition-transform active:scale-95"
            >
              WAY
            </Link>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block leading-tight">
                Studio
              </span>
            </div>
          </div>

          <nav className="space-y-1.5">
            {ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="h-5 w-5 shrink-0 flex items-center justify-center">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}