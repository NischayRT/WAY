export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-5xl lg:max-w-6xl px-4 sm:px-6 md:px-8 py-12">
      <div className="flex flex-col items-center justify-center space-y-4 min-h-[40vh]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Loading...
        </span>
      </div>
    </div>
  );
}