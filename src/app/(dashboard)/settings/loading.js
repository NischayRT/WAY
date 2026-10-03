import { ui } from '@/lib/ui';

function Pulse({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

// Mirrors the real Settings workspace: header, tabs, profile card on the left,
// session / connected apps / danger zone on the right.
export default function SettingsLoading() {
  return (
    <main className={`${ui.pageWrapWide} lg:px-8`} aria-busy="true" aria-label="Loading settings">
      <div>
        <Pulse className="mb-3 h-4 w-28" />
        <Pulse className="h-8 w-32" />
        <Pulse className="mt-2 h-4 w-full max-w-md" />
      </div>

      <div className="grid grid-cols-1 items-start gap-x-5 gap-y-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        {/* Tabs */}
        <div className={`${ui.panel} grid h-12 grid-cols-2 overflow-hidden lg:col-start-1 lg:row-start-1`}>
          <div className="flex items-center justify-center bg-slate-100 dark:bg-[#0f1d38]">
            <Pulse className="h-4 w-32" />
          </div>
          <div className="flex items-center justify-center">
            <Pulse className="h-4 w-36" />
          </div>
        </div>

        {/* Profile & Targets */}
        <div className={`${ui.panel} space-y-4 p-4 sm:p-5 lg:col-start-1 lg:row-start-2`}>
          <div className="flex items-center gap-2.5">
            <Pulse className="h-5 w-5 rounded-full" />
            <Pulse className="h-5 w-40" />
          </div>

          <div className={`${ui.panelInner} space-y-4 p-3 sm:p-4`}>
            <div className="space-y-1.5">
              <Pulse className="h-3 w-24" />
              <Pulse className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Pulse className="h-3 w-20" />
                  <Pulse className="h-10 w-full" />
                </div>
              ))}
            </div>

            <div className={`${ui.panelInner} p-3 sm:p-4`}>
              <div className="flex gap-3">
                <Pulse className="h-5 w-5 shrink-0 rounded-full" />
                <div className="w-full space-y-2">
                  <Pulse className="h-4 w-36" />
                  <Pulse className="h-3 w-full max-w-md" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Pulse key={i} className="h-10 w-full" />
                ))}
              </div>
            </div>

            <div className={`${ui.panelInner} p-3 sm:p-4`}>
              <div className="flex gap-3">
                <Pulse className="h-5 w-5 shrink-0 rounded-full" />
                <div className="w-full space-y-2">
                  <Pulse className="h-4 w-32" />
                  <Pulse className="h-5 w-full max-w-sm" />
                  <Pulse className="h-3 w-56" />
                </div>
              </div>
              <Pulse className="mt-3 h-4 w-44" />
            </div>
          </div>

          <Pulse className="h-11 w-full" />
        </div>

        {/* Right column */}
        <div className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-2">
          <div className={`${ui.panel} flex items-center justify-between gap-4 p-4 sm:p-5`}>
            <div className="flex items-start gap-3">
              <Pulse className="h-6 w-6 shrink-0 rounded-full" />
              <div className="space-y-2">
                <Pulse className="h-4 w-20" />
                <Pulse className="h-3 w-44" />
              </div>
            </div>
            <Pulse className="h-10 w-24 shrink-0" />
          </div>

          <div className={`${ui.panel} space-y-4 p-4 sm:p-5`}>
            <div className="flex items-start gap-3">
              <Pulse className="h-6 w-6 shrink-0 rounded-full" />
              <div className="w-full space-y-2">
                <Pulse className="h-4 w-32" />
                <Pulse className="h-3 w-full" />
                <Pulse className="h-3 w-4/5" />
              </div>
            </div>
            <div className={`${ui.panelInner} flex items-center justify-between gap-3 p-3`}>
              <div className="flex items-center gap-3">
                <Pulse className="h-10 w-10 shrink-0" />
                <div className="space-y-2">
                  <Pulse className="h-4 w-24" />
                  <Pulse className="h-3 w-16" />
                </div>
              </div>
              <Pulse className="h-9 w-24" />
            </div>
            <div className={`${ui.panelInner} space-y-3 p-4`}>
              <Pulse className="h-4 w-52" />
              <Pulse className="h-3 w-full" />
              <Pulse className="h-9 w-36" />
            </div>
          </div>

          <div className={`${ui.panel} space-y-3 p-4 sm:p-5`}>
            <Pulse className="h-4 w-28" />
            <Pulse className="h-3 w-full" />
            <Pulse className="h-14 w-full" />
          </div>

          <div className="flex justify-center gap-3">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-3 w-28" />
          </div>
        </div>
      </div>
    </main>
  );
}