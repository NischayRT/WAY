import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { todayLocalDate, addDays, clampDate } from '@/lib/dateUtils';
import AppHeader from '@/components/layout/AppHeader';
import LogFoodBuilder from '@/components/logging/LogFoodBuilder';

export default async function LogFoodPage({ searchParams }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The home screen can be parked on an earlier day. Carry that date over
  // via ?date= so the cart logs to the day the user was actually looking
  // at instead of silently defaulting to today.
  const params = await searchParams;
  const today = todayLocalDate();
  const minDate = addDays(today, -90);
  const initialDate = clampDate(params?.date, minDate, today);

  return (
    // Deliberately NOT ui.pageWrapWide here. That wrapper is sized for
    // single-column reading; this page needs room for the food list AND a
    // ~340px cart column side by side, so it gets a wider max-width.
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 pb-28 space-y-6">
      <AppHeader
        title="Log food"
        backHref="/home"
        backLabel="Back to today"
        action={
          <Link
            href="/add-food"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all shadow-2xs whitespace-nowrap active:scale-[0.98]"
          >
            <ChefHat size={15} className="text-amber-500 shrink-0" />
            <span>Add <span className="hidden sm:inline">custom</span> dish</span>
          </Link>
        }
      />
      <LogFoodBuilder today={today} minDate={minDate} initialDate={initialDate} />
    </main>
  );
}