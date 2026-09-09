import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import LogFoodBuilder from '@/components/logging/LogFoodBuilder';

export default async function LogFoodPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className={ui.pageWrapWide}>
      <AppHeader
        title="Log food"
        backHref="/home"
        backLabel="Back to today"
        action={
          <Link
            href="/add-food"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all shadow-2xs whitespace-nowrap active:scale-[0.98]"
          >
            <ChefHat size={15} className="text-amber-500 shrink-0" />
            <span>Add <span className="hidden sm:inline">custom</span> dish</span>
          </Link>
        }
      />
      <LogFoodBuilder userId={user.id} />
    </main>
  );
}