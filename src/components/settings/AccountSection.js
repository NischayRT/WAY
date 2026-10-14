'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { getCurrentUserId } from '@/lib/currentUser';
import { MODEL_CREDITS } from '@/lib/bodyModels';
import { Card, Eyebrow, Btn } from '@/components/way/ui';

/** Sign out, delete everything, legal links and the 3D model credits (CC BY 4.0 requires them). */
export default function AccountSection({ name, email }) {
  const supabase = createClient();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const display = (name || '').trim() || 'WAY member';

  const logout = async () => {
    setBusy('logout');
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const remove = async () => {
    setBusy('delete');
    setError(null);
    let userId;
    try {
      userId = await getCurrentUserId(supabase);
    } catch (e) {
      setBusy(null);
      return setError(e.message);
    }
    // Revoke Google Health access and delete the stored tokens (best effort).
    await fetch('/api/google-health/disconnect', { method: 'POST' }).catch(() => {});
    for (const [table, col, label] of [
      ['food_logs', 'user_id', 'food logs'],
      ['weight_logs', 'user_id', 'weight logs'],
      ['profiles', 'id', 'profile'],
    ]) {
      const { error: e } = await supabase.from(table).delete().eq(col, userId);
      if (e) {
        setBusy(null);
        return setError(`Could not remove your ${label}: ${e.message}`);
      }
    }
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex max-w-[980px] flex-col gap-3.5 md:grid md:grid-cols-2 md:items-start md:gap-5">
      <Card className="flex flex-col gap-3.5 p-[18px] md:gap-[18px] md:p-[26px]">
        <Eyebrow>Account</Eyebrow>
        <div className="flex items-center gap-3 md:gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-way-line2 bg-way-track text-base font-semibold md:h-[52px] md:w-[52px] md:text-lg">
            {display.charAt(0).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 md:gap-[3px]">
            <span className="text-[15px] font-semibold md:text-base">{display}</span>
            <span className="truncate font-mono text-[11px] font-medium text-way-dim md:text-xs">{email}</span>
          </div>
        </div>
        <Btn variant="outline" onClick={logout} disabled={busy === 'logout'} className="h-11 md:self-start">
          <LogOut size={14} />
          {busy === 'logout' ? 'Signing out…' : 'Log out'}
        </Btn>
      </Card>

      <Card className="flex flex-col gap-3 border-rose-400/25 p-[18px] md:gap-3.5 md:p-[26px]">
        <Eyebrow className="text-way-over">Delete account</Eyebrow>
        <span className="text-xs leading-normal text-way-mute md:text-[13px]">
          Erases your profile, every food log and every weight log, and revokes Google Health access. This can&apos;t be undone.
        </span>
        {!confirm ? (
          <Btn variant="dangerOutline" onClick={() => setConfirm(true)} className="h-11 md:self-start">
            <Trash2 size={14} />
            Delete account
          </Btn>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-[14px] border border-rose-400/35 bg-rose-400/7 p-3.5 md:p-4">
            <span className="text-[13px] font-semibold text-rose-200 md:text-sm">Delete everything for {email}?</span>
            <span className="text-xs text-way-mute">You can sign in again later, but you&apos;ll start from onboarding.</span>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => setConfirm(false)} className="flex-1 rounded-[10px] font-medium md:order-2 md:flex-none">
                Cancel
              </Btn>
              <Btn variant="danger" onClick={remove} disabled={busy === 'delete'} className="flex-1 rounded-[10px] md:order-1 md:flex-none">
                {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
              </Btn>
            </div>
          </div>
        )}
        {error ? <p className="text-[13px] text-rose-300">{error}</p> : null}
      </Card>

      <section className="flex flex-col gap-2 px-1 pt-1 md:col-span-2 md:gap-2.5">
        <div className="flex gap-4 text-xs md:gap-5 md:text-[13px]">
          <Link href="/privacy" className="text-way-protein hover:text-emerald-300">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-way-protein hover:text-emerald-300">
            Terms of Service
          </Link>
        </div>
        <span className="pt-1.5 font-heading text-[10px] font-bold tracking-[0.12em] text-way-dim md:pt-2 md:text-[11px]">3D MODEL CREDITS</span>
        {MODEL_CREDITS.map((c) => (
          <span key={c.title} className="text-[11px] leading-normal text-way-dim md:text-xs">
            “
            <a href={c.url} target="_blank" rel="noreferrer" className="text-way-mute hover:text-way-ink">
              {c.title}
            </a>
            ” by {c.author} ·{' '}
            <a href={c.licenseUrl} target="_blank" rel="noreferrer" className="text-way-mute hover:text-way-ink">
              {c.license}
            </a>{' '}
            · {c.changes}
          </span>
        ))}
      </section>
    </div>
  );
}
