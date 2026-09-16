import { ui } from '@/lib/ui';

function Pulse({ className }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

export default function SettingsLoading() {
  return (
    <main className={ui.pageWrap}>
      <div>
        <Pulse className="h-4 w-28 mb-2" />
        <Pulse className="h-7 w-28" />
        <Pulse className="h-4 w-72 mt-2" />
      </div>

      <div className="mx-auto max-w-xl py-6 space-y-5">
        <Pulse className="h-11 w-full rounded-xl" />
        <div className={`${ui.card} p-5 space-y-4`}>
          <Pulse className="h-4 w-24" />
          <Pulse className="h-10 w-full" />
          <Pulse className="h-10 w-full" />
          <Pulse className="h-10 w-full" />
        </div>
      </div>
    </main>
  );
}