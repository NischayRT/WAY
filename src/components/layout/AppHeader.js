import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ui } from '@/lib/ui';
import ThemeToggle from './ThemeToggle';

export default function AppHeader({ title, backHref, backLabel = 'Back', action }) {
  return (
    <header className="flex items-center justify-between w-full gap-3 pb-1">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className={`${ui.linkMuted} inline-flex items-center gap-1 text-xs sm:text-sm font-medium`}
          >
            <ArrowLeft size={14} /> {backLabel}
          </Link>
        )}
        <h1 className={`${ui.heading} ${backHref ? 'mt-1' : ''} truncate`}>{title}</h1>
      </div>

      {/* Right-side actions & theme switch cleanly aligned */}
      <div className="flex items-center gap-2 shrink-0">
        {action}
        <ThemeToggle />
      </div>
    </header>
  );
}