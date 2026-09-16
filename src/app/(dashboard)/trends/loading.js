import { ui } from '@/lib/ui';

function Pulse({ className }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

export default function TrendsLoading() {
  return (
    <main className={ui.pageWrapWide}>
      <div className="flex items-center justify-between w-full gap-3 pb-1">
        <Pulse className="h-7 w-24" />
        <Pulse className="h-8 w-8 rounded-full" />
      </div>

      <Pulse className="h-4 w-64 mt-2" />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={ui.card}>
            <Pulse className="h-4 w-20 mb-4" />
            <Pulse className="h-40 w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}