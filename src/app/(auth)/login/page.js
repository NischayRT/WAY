'use client';

import { createClient } from '@/lib/supabaseClient';
import { ui } from '@/lib/ui';

export default function LoginPage() {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-leaf">
      <div className={`${ui.card} w-full max-w-sm space-y-6 p-8 text-center`}>
        <div>
          <h2 className={ui.heading}>Welcome To <h1 className="font-brand pt-6 pb-5 tracking-normal text-slate-900 dark:text-white shrink-0 leading-none transition-transform active:scale-95">
              WAY</h1>
            </h2>
          <p className="mt-1 text-sm text-ink/60 dark:text-slate-400">Track meals, the Indian way.</p>
        </div>
        <button onClick={handleGoogleLogin} className={`${ui.btnPrimary} w-full`}>
          Continue with Google
        </button>
      </div>
    </main>
  );
}
