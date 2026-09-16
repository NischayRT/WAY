import { ui } from '@/lib/ui';

function Pulse({ className }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

export default function HomeLoading() {
  return (
    <main className={ui.pageWrapWide}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[90px_1fr]">
        <div className="flex flex-row md:flex-col gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Pulse key={i} className="h-16 w-12 md:w-full shrink-0" />
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3">
            <div>
              <Pulse className="h-6 w-16 mb-2" />
              <Pulse className="h-3 w-24" />
            </div>
            <Pulse className="h-8 w-16 rounded-full" />
          </div>

          <div className={ui.card}>
            <Pulse className="h-56 w-full" />
          </div>

          <div className="flex items-center justify-between">
            <Pulse className="h-4 w-40" />
            <div className="flex gap-1">
              <Pulse className="h-9 w-28 rounded-xl" />
              <Pulse className="h-9 w-24 rounded-xl" />
            </div>
          </div>

          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Pulse key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}