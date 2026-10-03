'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ className, iconSize = 17 }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isStoredDark = localStorage.getItem('theme-mode') === 'dark';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldDark = isStoredDark || (!localStorage.getItem('theme-mode') && prefersDark);
    if (shouldDark) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }

    const sync = () => {
      const nowDark = document.documentElement.classList.contains('dark');
      setIsDark(nowDark);
    };
    const onThemeChange = () => sync();
    window.addEventListener('theme-change', onThemeChange);
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      window.removeEventListener('theme-change', onThemeChange);
      obs.disconnect();
    };
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme-mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme-mode', 'light');
    }
    setIsDark(nextDark);
    window.dispatchEvent(new Event('theme-change'));
  };

  const baseClass =
    className ??
    'inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-500 shadow-xs backdrop-blur-md transition-all active:scale-95 cursor-pointer';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={baseClass}
    >
      {isDark ? (
        <Sun size={iconSize} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      ) : (
        <Moon size={iconSize} className="text-slate-700 dark:text-slate-200 drop-shadow-[0_0_6px_rgba(100,116,139,0.3)]" />
      )}
    </button>
  );
}