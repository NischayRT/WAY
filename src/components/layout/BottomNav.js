'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import {
  Home,
  TrendingUp,
  Plus,
  Scale,
  Settings,
  MoreVertical,
  LogOut,
} from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [profileName, setProfileName] = useState('User');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (isMounted && profile?.full_name) {
        setProfileName(profile.full_name);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initialLetter = profileName.trim().charAt(0).toUpperCase() || 'U';

  const isLogFoodActive = pathname === '/log-food' || pathname.startsWith('/log-food/');

  return (
    <>
      {/* Mobile Bottom Navigation (< 768px) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-3 py-1.5">
          {/* 1. Today */}
          <Link
            href="/home"
            className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-1 transition-all active:scale-95 ${
              pathname === '/home' || pathname.startsWith('/home/')
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
            }`}
          >
            <Home size={19} strokeWidth={pathname.startsWith('/home') ? 2.5 : 1.8} />
            <span className="text-[10px] tracking-tight">Today</span>
          </Link>

          {/* 2. Trends */}
          <Link
            href="/trends"
            className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-1 transition-all active:scale-95 ${
              pathname === '/trends' || pathname.startsWith('/trends/')
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
            }`}
          >
            <TrendingUp size={19} strokeWidth={pathname.startsWith('/trends') ? 2.5 : 1.8} />
            <span className="text-[10px] tracking-tight">Trends</span>
          </Link>

          {/* 3. Log Food (Special Prominent Action Button) */}
          <Link
            href="/log-food"
            className="group/btn relative -top-3.5 flex flex-col items-center justify-center transition-transform active:scale-90"
          >
            <div
              className={`relative flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-all duration-300 ${
                isLogFoodActive
                  ? 'bg-emerald-600 text-white shadow-emerald-600/40 ring-4 ring-white dark:ring-slate-950'
                  : 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-slate-900/30 dark:shadow-emerald-500/30 ring-4 ring-white dark:ring-slate-950'
              }`}
            >
              <Plus
                size={22}
                strokeWidth={3}
                className="transition-transform duration-300 group-hover/btn:rotate-90 group-hover/btn:scale-110"
              />
            </div>
            <span className="text-[9px] font-bold tracking-tight text-slate-700 dark:text-slate-300 mt-1">
              Log Food
            </span>
          </Link>

          {/* 4. Weight */}
          <Link
            href="/weight"
            className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-1 transition-all active:scale-95 ${
              pathname === '/weight' || pathname.startsWith('/weight/')
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
            }`}
          >
            <Scale size={19} strokeWidth={pathname.startsWith('/weight') ? 2.5 : 1.8} />
            <span className="text-[10px] tracking-tight">Weight</span>
          </Link>

          {/* 5. Settings */}
          <Link
            href="/settings"
            className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-1 transition-all active:scale-95 ${
              pathname === '/settings' || pathname.startsWith('/settings/')
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
            }`}
          >
            <Settings size={19} strokeWidth={pathname.startsWith('/settings') ? 2.5 : 1.8} />
            <span className="text-[10px] tracking-tight">Settings</span>
          </Link>
        </div>
      </nav>

      {/* Desktop Sidebar (>= 768px) */}
      <aside className="group hidden md:flex fixed top-0 left-0 bottom-0 z-50 flex-col justify-around border-r border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-6 shadow-lg shadow-slate-900/5 dark:shadow-black/50 transition-all duration-300 ease-in-out w-16 hover:w-56 select-none">
        {/* Centered Brand / Logo Header */}
        <div className="flex flex-col items-center justify-center w-full min-h-[4.5rem]">
          <Link
            href="/home"
            className="flex flex-col items-center justify-center transition-transform active:scale-95 group/logo"
          >
            <span className="logo-way font-brand text-2xl font-bold tracking-normal group-hover:tracking-[0.32em] text-slate-900 dark:text-white transition-all duration-500 ease-out text-center inline-block pl-0 group-hover:pl-1">
              WAY
            </span>

            <div className="h-0 opacity-0 group-hover:h-4 group-hover:opacity-100 group-hover:mt-1 transition-all duration-500 ease-out overflow-hidden flex items-center justify-center">
              <span className="text-[9px] font-bold uppercase tracking-[0.38em] block text-center pl-1 whitespace-nowrap text-slate-500 dark:text-slate-400 transition-colors">
                Studio
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items (Home -> Trends -> Log Food Action Button -> Weight -> Settings) */}
        <nav className="w-full space-y-2">
          {/* 1. Today */}
          <Link
            href="/home"
            title="Today"
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              pathname === '/home' || pathname.startsWith('/home/')
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="h-5 w-5 shrink-0 flex items-center justify-center">
              <Home size={20} strokeWidth={pathname.startsWith('/home') ? 2.5 : 2} />
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-250 delay-75 whitespace-nowrap overflow-hidden">
              Today
            </span>
          </Link>

          {/* 2. Trends */}
          <Link
            href="/trends"
            title="Trends"
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              pathname === '/trends' || pathname.startsWith('/trends/')
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="h-5 w-5 shrink-0 flex items-center justify-center">
              <TrendingUp size={20} strokeWidth={pathname.startsWith('/trends') ? 2.5 : 2} />
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-250 delay-75 whitespace-nowrap overflow-hidden">
              Trends
            </span>
          </Link>

          {/* 3. Log Food (Special Animated Action Button) */}
          <div className="py-1">
            <Link
              href="/log-food"
              title="Log Food"
              className={`log-food-btn group/item relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 overflow-hidden ${
                isLogFoodActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-xs hover:shadow-md hover:shadow-emerald-600/25'
              }`}
            >
              {/* Pulsing Light Beam on Hover */}
              <span className="pointer-events-none absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/item:translate-x-full ease-in-out" />

              <div className="h-5 w-5 shrink-0 flex items-center justify-center">
                <Plus
                  size={19}
                  strokeWidth={3}
                  className="plus-icon transition-transform duration-300 group-hover/item:rotate-90 group-hover/item:scale-125"
                />
              </div>

              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-250 delay-75 whitespace-nowrap overflow-hidden tracking-tight">
                Log Food
              </span>
            </Link>
          </div>

          {/* 4. Weight */}
          <Link
            href="/weight"
            title="Weight"
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              pathname === '/weight' || pathname.startsWith('/weight/')
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="h-5 w-5 shrink-0 flex items-center justify-center">
              <Scale size={20} strokeWidth={pathname.startsWith('/weight') ? 2.5 : 2} />
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-250 delay-75 whitespace-nowrap overflow-hidden">
              Weight
            </span>
          </Link>

          {/* 5. Settings */}
          <Link
            href="/settings"
            title="Settings"
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              pathname === '/settings' || pathname.startsWith('/settings/')
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="h-5 w-5 shrink-0 flex items-center justify-center">
              <Settings size={20} strokeWidth={pathname.startsWith('/settings') ? 2.5 : 2} />
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-250 delay-75 whitespace-nowrap overflow-hidden">
              Settings
            </span>
          </Link>
        </nav>

        {/* Bottom Profile Area with Name & Logout Dropdown */}
        <div ref={menuRef} className="relative w-full">
          {dropdownOpen && (
            <div className="absolute bottom-full left-0 mb-2.5 w-48 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl backdrop-blur-md z-50">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <LogOut size={14} />
                <span>{loggingOut ? 'Signing out...' : 'Log out'}</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900/80 transition">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-inner">
                {initialLetter}
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-250 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate whitespace-nowrap">
                {profileName}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              title="Profile menu"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-250 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        {/* Hover-activated responsive metallic silver gradient */}
        <style jsx>{`
          aside:hover .logo-way {
            background: linear-gradient(
              180deg,
              #0f172a 0%,
              #334155 45%,
              #64748b 80%,
              #94a3b8 100%
            );
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            -webkit-text-fill-color: transparent;
          }

          :global(html.dark) aside:hover .logo-way {
            background: linear-gradient(
              180deg,
              #ffffff 0%,
              #cbd5e1 50%,
              #64748b 100%
            );
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
          }

          .log-food-btn:hover {
            transform: translateY(-1px) scale(1.02);
          }

          .log-food-btn:active {
            transform: scale(0.97);
          }
        `}</style>
      </aside>
    </>
  );
}