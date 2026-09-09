'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isStoredDark = localStorage.getItem('theme-mode') === 'dark';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isStoredDark || (!localStorage.getItem('theme-mode') && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme-mode', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme-mode', 'dark');
      setIsDark(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-500 shadow-xs backdrop-blur-md transition-all active:scale-95 cursor-pointer"
    >
      {isDark ? (
        <Sun size={17} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      ) : (
        <Moon size={17} className="text-slate-700 drop-shadow-[0_0_6px_rgba(100,116,139,0.3)]" />
      )}
    </button>
  );
}