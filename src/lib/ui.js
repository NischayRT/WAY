export const ui = {
  pageWrap: 'mx-auto max-w-md md:max-w-4xl lg:max-w-5xl px-4 sm:px-6 md:px-8 py-6 pb-28 md:pb-12 space-y-6',
  pageWrapWide: 'mx-auto max-w-md md:max-w-5xl lg:max-w-6xl px-4 sm:px-6 py-6 pb-28 md:pb-12 space-y-6',

  // Modern Cards with high-visibility borders in dark mode
  card: 'rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-3 shadow-xs shadow-slate-200/50 dark:shadow-slate-950/60 hover:border-slate-300 dark:hover:border-slate-500 transition-all',
  cardMuted: 'rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-4',
  cardElevated: 'rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-lg shadow-slate-900/5 dark:shadow-black/50',

  label: 'flex flex-col text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
  input:
    'mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/10',
  select:
    'mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-800 dark:text-white transition-all focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/10',

  btnPrimary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-white dark:text-slate-950 shadow-sm shadow-slate-900/10 dark:shadow-white/10 transition-all hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 shadow-2xs transition-all hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] disabled:opacity-50',
  btnSmall:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-200 shadow-2xs transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-white active:scale-[0.97] disabled:opacity-50',

  inputCompact:
    'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm font-numeric text-slate-800 dark:text-white transition-all focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-2 focus:ring-slate-900/5 disabled:opacity-50',
  selectCompact:
    'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-white transition-all focus:border-slate-900 dark:focus:border-white focus:outline-none focus:ring-2 focus:ring-slate-900/5 disabled:opacity-50',

  linkMuted: 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 transition hover:text-slate-900 dark:hover:text-white',
  linkAccent: 'text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition hover:text-emerald-700 dark:hover:text-emerald-300',

  heading: 'font-heading text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white',
  subheading: 'font-heading flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white',
  numeric: 'font-numeric',

  macroText: {
    calories: 'text-amber-600 dark:text-amber-400',
    protein: 'text-emerald-600 dark:text-emerald-400',
    carbs: 'text-blue-600 dark:text-blue-400',
    fat: 'text-violet-600 dark:text-violet-400',
  },
  macroBg: {
    calories: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60',
    protein: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60',
    carbs: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60',
    fat: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200/60 dark:border-violet-800/60',
  },
};

export function authorTag(food) {
  if (!food.created_by) return '';
  return food.author_name ? ` (${food.author_name}'s)` : ' (Shared)';
}