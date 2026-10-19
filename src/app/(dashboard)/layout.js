import WayNav from '@/components/way/WayNav';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { todayLocalDate } from '@/lib/dateUtils';
import { recordVisit } from '@/lib/streak';

// The redesigned dashboard is dark only. The `dark` class here also keeps any
// older component that still uses `dark:` variants in step with it.
export default async function DashboardLayout({ children }) {
  let initial = 'W';
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await recordVisit(supabase, user.id, todayLocalDate());
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      initial = (profile?.full_name || user.email || 'W').trim().charAt(0).toUpperCase() || 'W';
    }
  } catch {
    // Signed out or Supabase unreachable: the page itself handles the redirect.
  }

  return (
    <div className="way-app dark min-h-screen overflow-x-clip bg-way-page text-way-ink [color-scheme:dark] md:pl-[76px]">
      {children}
      <WayNav initial={initial} />
    </div>
  );
}
