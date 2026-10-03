import { ui } from '@/lib/ui';

function Pulse({ className }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

export default function SettingsLoading() {
  return (
    <main className={`${ui.pageWrapWide} lg:px-8`}>
      <div>
        <Pulse className="h-4 w-28 mb-2" />
        <Pulse className="h-7 w-28" />
        <Pulse className="h-4 w-72 mt-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] gap-x-5 gap-y-4 items-start">
        <Pulse className="h-12 w-full lg:col-start-1 lg:row-start-1" />
        <div className={`${ui.panel} p-5 space-y-4 lg:col-start-1 lg:row-start-2`}>
          <Pulse className="h-5 w-40" />
          <Pulse className="h-11 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Pulse className="h-11" />
            <Pulse className="h-11" />
            <Pulse className="h-11" />
            <Pulse className="h-11" />
          </div>
          <Pulse className="h-24 w-full" />
          <Pulse className="h-40 w-full" />
        </div>
        <div className="space-y-4 lg:col-start-2 lg:row-start-2">
          <Pulse className="h-20 w-full" />
          <Pulse className="h-64 w-full" />
          <Pulse className="h-32 w-full" />
        </div>
      </div>
    </main>
  );
}
