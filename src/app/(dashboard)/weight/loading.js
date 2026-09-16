import { ui } from '@/lib/ui';

function Pulse({ className }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

export default function WeightLoading() {
  return (
    <main className={ui.pageWrapWide}>
      <div className="flex items-center justify-between w-full gap-3 pb-1">
        <Pulse className="h-7 w-24" />
        <Pulse className="h-8 w-8 rounded-full" />
      </div>

      <div className={`${ui.card} mt-6`}>
        <Pulse className="h-48 w-full" />
      </div>

      <div className={`${ui.card} mt-6`}>
        <Pulse className="h-4 w-32 mb-3" />
        <Pulse className="h-10 w-full" />
      </div>

      <div className={`${ui.card} mt-6 space-y-2`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-8 w-full" />
        ))}
      </div>
    </main>
  );
}