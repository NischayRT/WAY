import { ui } from '@/lib/ui';

function Pulse({ className }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

export default function LogFoodLoading() {
  return (
    <main className={ui.pageWrapWide}>
      <div className="flex items-center justify-between w-full gap-3 pb-1">
        <div>
          <Pulse className="h-4 w-24 mb-2" />
          <Pulse className="h-7 w-32" />
        </div>
        <Pulse className="h-9 w-32 rounded-xl" />
      </div>

      <Pulse className="h-11 w-full rounded-xl mt-5" />

      <div className="space-y-2.5 mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Pulse key={i} className="h-16 w-full" />
        ))}
      </div>
    </main>
  );
}