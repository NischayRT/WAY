'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, KeyRound, Loader2, Check, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { TERMS_VERSION } from '@/lib/legal';

// Must match "Email OTP Length" in Supabase -> Authentication -> Providers -> Email.
// The old page told users "6-digit code" but only enabled the button at 8
// digits; both now come from this one constant.
const OTP_LENGTH = 8;
const RESEND_COOLDOWN_S = 60;
const TERMS_KEY = 'way-terms-accepted';

const inputCls =
  'w-full rounded-2xl border border-white/25 bg-white/10 py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-white/45 transition focus:border-white/60 focus:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';
const primaryCls =
  'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white shadow-xl transition hover:bg-white/25 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50';
const linkBtnCls =
  'text-xs font-medium text-white/65 underline underline-offset-2 transition hover:text-white disabled:opacity-50 disabled:no-underline';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function LoginForm({ initialError = null }) {
  const router = useRouter();
  // One browser client for the life of the component, not one per render.
  const [supabase] = useState(() => createClient());

  const [accepted, setAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null); // null | 'google' | 'send' | 'verify'
  const [error, setError] = useState(initialError);
  const [cooldown, setCooldown] = useState(0);
  const optionsRef = useRef(null);

  // While the sign-in options are folded away (Terms not yet accepted) they
  // must not be reachable by Tab or screen readers either.
  useEffect(() => {
    if (optionsRef.current) optionsRef.current.inert = !accepted;
  }, [accepted]);

  // The page background darkens once the person actually starts signing in
  // (clicks Google or sends an email code), not on hover. The login page's
  // CSS reacts to this attribute with :has([data-engaged]).
  const engaged = busy === 'google' || busy === 'send' || busy === 'verify' || step === 'code';

  // Remember acceptance of the current Terms version on this device.
  useEffect(() => {
    try {
      if (localStorage.getItem(TERMS_KEY) === TERMS_VERSION) setAccepted(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const onAcceptChange = (checked) => {
    setAccepted(checked);
    if (checked) setTermsError(false);
    try {
      if (checked) localStorage.setItem(TERMS_KEY, TERMS_VERSION);
      else localStorage.removeItem(TERMS_KEY);
    } catch {}
  };

  const requireAccepted = () => {
    if (accepted) return true;
    setTermsError(true);
    return false;
  };

  const signInWithGoogle = async () => {
    if (!requireAccepted() || busy) return;
    setBusy('google');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is already navigating away to Google.
    if (err) {
      setError('Could not start Google sign-in. Please try again.');
      setBusy(null);
    }
  };

  const sendCode = async (e) => {
    e?.preventDefault();
    const address = email.trim();
    if (!address || busy || cooldown > 0) return;
    if (!requireAccepted()) return;
    setBusy('send');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      // Records which Terms version a new account accepted (stored in
      // auth.users.raw_user_meta_data on sign-up).
      options: { data: { terms_version: TERMS_VERSION } },
    });
    setBusy(null);
    if (err) {
      setError(err.status === 429 ? 'Too many requests. Please wait a minute and try again.' : err.message);
      return;
    }
    setCode('');
    setStep('code');
    setCooldown(RESEND_COOLDOWN_S);
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    if (code.length !== OTP_LENGTH || busy) return;
    setBusy('verify');
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    if (err) {
      setBusy(null);
      setError('That code is incorrect or has expired. Check the latest email, or resend a new code.');
      return;
    }
    router.replace('/home');
    router.refresh();
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
  };

  return (
    <div data-engaged={engaged ? 'true' : undefined}>
      {/* 1. Consent: the only thing shown until it is ticked */}
      <div>
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
            termsError ? 'border-rose-300/70 bg-rose-500/10' : 'border-white/20 bg-white/5 hover:bg-white/10'
          }`}
        >
          <input
            type="checkbox"
            data-terms
            checked={accepted}
            onChange={(e) => onAcceptChange(e.target.checked)}
            className="peer sr-only"
            aria-describedby={termsError ? 'terms-error' : undefined}
          />
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border border-white/55 bg-white/10 text-transparent transition peer-checked:border-white peer-checked:bg-white peer-checked:text-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-white/70"
          >
            <Check size={13} strokeWidth={3} />
          </span>
          <span className="text-xs leading-relaxed text-white/85">
            I agree to the{' '}
            <Link href="/terms" target="_blank" rel="noopener" className="font-semibold text-white underline underline-offset-2">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" rel="noopener" className="font-semibold text-white underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {termsError && (
          <p id="terms-error" role="alert" className="mt-2 px-1 text-xs font-medium text-rose-300">
            Please accept the Terms of Service and Privacy Policy to continue.
          </p>
        )}
      </div>

      {/* 2 + 3. Sign-in options: unfold (grid-rows 0fr -> 1fr) once the Terms are accepted */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-700 ease-[cubic-bezier(0.2,0.9,0.25,1)] motion-reduce:transition-none ${
          accepted ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
      <div ref={optionsRef} className="min-h-0 overflow-hidden">
      <div className="space-y-5 px-0.5 pb-0.5 pt-5">
      {/* 2. Google */}
      <button type="button" data-cta onClick={signInWithGoogle} disabled={!!busy} className={primaryCls}>
        {busy === 'google' ? <Loader2 size={16} className="animate-spin" /> : <GoogleMark />}
        Continue with Google
      </button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/20" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/55">or</span>
        <span className="h-px flex-1 bg-white/20" />
      </div>

      {/* 3. Email code */}
      {step === 'email' ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label htmlFor="login-email" className="sr-only">
            Email address
          </label>
          <div className="relative">
            <Mail size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/55" />
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />
          </div>
          <button type="submit" data-cta disabled={!!busy || !email.trim()} className={primaryCls}>
            {busy === 'send' ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Sending code…
              </>
            ) : (
              'Email me a sign-in code'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <div className="space-y-1 px-1">
            <p className="text-xs leading-relaxed text-white/80">
              We sent a {OTP_LENGTH}-digit code to <span className="font-medium text-white">{email.trim()}</span>.
            </p>
            <p className="text-[11px] leading-relaxed text-white/55">
              Not there? Check spam or promotions. It can take a minute to arrive.
            </p>
          </div>
          <label htmlFor="login-code" className="sr-only">
            Sign-in code
          </label>
          <div className="relative">
            <KeyRound size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/55" />
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern={`\\d{${OTP_LENGTH}}`}
              maxLength={OTP_LENGTH}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
              placeholder={'•'.repeat(OTP_LENGTH)}
              className={`${inputCls} tracking-[0.35em]`}
            />
          </div>
          <button type="submit" data-cta disabled={!!busy || code.length !== OTP_LENGTH} className={primaryCls}>
            {busy === 'verify' ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Verifying…
              </>
            ) : (
              'Verify & sign in'
            )}
          </button>
          <div className="flex items-center justify-between px-1 pt-1">
            <button type="button" onClick={changeEmail} className={`${linkBtnCls} inline-flex items-center gap-1`}>
              <ArrowLeft size={12} aria-hidden="true" /> Different email
            </button>
            <button type="button" onClick={sendCode} disabled={!!busy || cooldown > 0} className={linkBtnCls}>
              {busy === 'send' ? 'Resending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      </div>
      </div>
      </div>

      <p role="alert" aria-live="polite" className={`mt-4 min-h-[1rem] px-1 text-xs font-medium text-rose-300 ${error ? '' : 'sr-only'}`}>
        {error}
      </p>
    </div>
  );
}
