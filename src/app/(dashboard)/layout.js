import WayNav from '@/components/way/WayNav';
import { UnitsProvider } from '@/components/way/units';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { todayLocalDate } from '@/lib/dateUtils';
import { recordVisit } from '@/lib/streak';
import { getAuthUser } from '@/lib/authServer';

// The redesigned dashboard is dark only. The `dark` class here also keeps any
// older component that still uses `dark:` variants in step with it.
export default async function DashboardLayout({ children }) {
  let initial = 'W';
  let name = '';
  let units = null;
  let userId = null;
  try {
    const supabase = await createServerSupabaseClient();
    const user = await getAuthUser(supabase);
    if (user) {
      userId = user.id;
      const [, first] = await Promise.all([
        recordVisit(supabase, user.id, todayLocalDate()),
        supabase.from('profiles').select('full_name, units').eq('id', user.id).maybeSingle(),
      ]);
      // profiles.units arrives with supabase/units-2026-10.sql; read without it until then.
      const { data: profile } = first.error ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle() : first;
      units = profile?.units ?? null;
      initial = (profile?.full_name || user.email || 'W').trim().charAt(0).toUpperCase() || 'W';
      name = (profile?.full_name || '').trim();
    }
  } catch {
    // Signed out or Supabase unreachable: the page itself handles the redirect.
  }

  return (
    <div className="way-app dark min-h-screen overflow-x-clip bg-way-page text-way-ink [color-scheme:dark] md:pl-[76px]">
      <UnitsProvider initial={units} userId={userId}>
        {children}
        <WayNav initial={initial} name={name} />
      </UnitsProvider>
    </div>
  );
}
