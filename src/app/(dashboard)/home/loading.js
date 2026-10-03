import { ui } from '@/lib/ui';

function Pulse({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

const surface =
  'rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900/90';
const navySurface =
  'rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22]';

// Mirrors the real home layout, top to bottom, so nothing jumps when it loads.
export default function HomeLoading() {
  return (
    <main className={ui.pageWrapWide} aria-busy="true" aria-label="Loading your day">
      <div className="space-y-4">
        {/* Greeting + week strip + calendar */}
        <div className="flex items-center gap-3">
          <Pulse className="hidden h-10 w-28 md:block" />
          <div className="flex w-fit max-w-full items-center gap-1 rounded-full border border-slate-200/90 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/80">
            {Array.from({ length: 6 }).map((_, i) => (
              <Pulse key={i} className="hidden h-9 w-9 rounded-full min-[376px]:block" />
            ))}
            <Pulse className="h-10 w-28 rounded-full bg-white/80 dark:bg-slate-700/60 min-[376px]:w-32" />
            <Pulse className="h-9 w-9 rounded-full" />
          </div>
        </div>

        <div className="space-y-6">
          {/* Today + date */}
          <div className="border-b-2 border-dotted pb-3 dark:border-slate-700">
            <Pulse className="h-8 w-28" />
            <Pulse className="mt-2 h-3 w-24" />
          </div>

          {/* Weight banner */}
          <div className={`${surface} p-3 sm:p-4`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Pulse className="h-10 w-10 shrink-0" />
                <div className="space-y-2">
                  <Pulse className="h-3 w-44" />
                  <Pulse className="h-3 w-32" />
                </div>
                <Pulse className="ml-auto h-8 w-8 rounded-full md:ml-4" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 md:flex md:gap-2.5">
                <Pulse className="h-9 md:w-32" />
                <Pulse className="h-9 md:w-28" />
                <Pulse className="h-9 md:w-32" />
                <Pulse className="h-9 md:w-28" />
              </div>
            </div>
          </div>

          {/* Orbit + meal targets + weekly chart */}
          <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
            <div className={`${surface} p-4 lg:col-span-5`}>
              <div className="flex items-center justify-between">
                <Pulse className="h-3 w-36" />
                <Pulse className="h-7 w-20 rounded-lg" />
              </div>
              <div className="my-6 flex h-52 items-center justify-center">
                <div className="h-44 w-44 animate-pulse rounded-full border-[10px] border-slate-200/70 dark:border-slate-800" />
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Pulse className="h-3 w-16" />
                    <Pulse className="h-2 w-full" />
                    <Pulse className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </div>

            <div className={`${surface} space-y-3 p-4 lg:col-span-3`}>
              <Pulse className="h-3 w-28" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Pulse key={i} className="h-16 w-full" />
              ))}
            </div>

            <div className="flex flex-col gap-3 lg:col-span-4">
              <div className={`${surface} min-h-[260px] flex-1 p-4`}>
                <Pulse className="h-6 w-28" />
                <Pulse className="mt-2 h-3 w-40" />
                <div className="mt-6 flex h-36 items-end gap-2">
                  {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                    <div key={i} className="flex-1 animate-pulse rounded-t-md bg-slate-200/70 dark:bg-slate-800" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className={`${surface} space-y-3 p-4`}>
                <Pulse className="h-3 w-32" />
                <div className="grid grid-cols-3 gap-2">
                  <Pulse className="h-9" />
                  <Pulse className="h-9" />
                  <Pulse className="h-9" />
                </div>
              </div>
            </div>
          </div>

          {/* Four metric cards */}
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${navySurface} flex min-h-[190px] flex-col p-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Pulse className="h-11 w-11 rounded-full" />
                    <Pulse className="h-4 w-20" />
                  </div>
                  <Pulse className="h-6 w-6 rounded-full" />
                </div>
                <Pulse className="mt-4 h-9 w-28" />
                <Pulse className="mt-2 h-3 w-20" />
                <Pulse className="mt-3 h-2.5 w-full rounded-full" />
                <div className="mt-auto flex items-center justify-between pt-4">
                  <Pulse className="h-3 w-24" />
                  <Pulse className="h-3 w-14" />
                </div>
              </div>
            ))}
          </div>

          {/* Daily log */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Pulse className="h-5 w-24" />
              <div className="flex gap-2">
                <Pulse className="h-9 w-24" />
                <Pulse className="h-9 w-28" />
                <Pulse className="h-9 w-24" />
              </div>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`${surface} p-4`}>
                <div className="flex items-center justify-between">
                  <Pulse className="h-4 w-28" />
                  <Pulse className="h-6 w-32 rounded-lg" />
                </div>
                <Pulse className="mt-3 h-20 w-full border border-dashed border-slate-200 bg-transparent dark:border-slate-700 dark:bg-transparent" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}