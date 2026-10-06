import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Soup, UtensilsCrossed, Coffee, Wheat, Flame, Leaf, CookingPot, Cookie } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import LoginForm from '@/components/auth/LoginForm';
import styles from './login.module.css';

// Server Component. Everything visual on this page (gradient, icon lanes,
// wordmark, card) is plain HTML + a CSS module, so it ships in the first
// response and paints before any JavaScript loads. Only <LoginForm/> needs
// the client bundle.
//
// The old page was one 'use client' file whose styles lived in a
// <style jsx> block. The App Router does not server-render styled-jsx
// without a registry, so the background and wordmark gradient only showed
// up after hydration. That was the delayed paint.

export const metadata = {
  title: 'Sign in',
  description: 'Sign in to WAY Studio to track Indian food, macros and your weight.',
  robots: { index: false, follow: true },
};

const ICONS = [Soup, Wheat, Coffee, Flame, Leaf, UtensilsCrossed, CookingPot, Cookie];

// [icon indexes, seconds per loop, reverse]
const LANES = [
  [[0, 3, 6], 24, false],
  [[1, 4, 7], 30, true],
  [[2, 5, 0], 22, false],
  [[5, 1, 3], 28, true],
  [[6, 2, 4], 26, false],
  [[7, 0, 5], 29, true],
];

function IconLane({ icons, duration, reverse }) {
  // Four copies scrolled by 50% (= two copies) loop seamlessly and always
  // cover the full viewport height, even on tall screens.
  const sequence = [...icons, ...icons, ...icons, ...icons];
  return (
    <div className={styles.lane}>
      <div
        className={styles.laneTrack}
        style={{ animationDuration: `${duration}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        {sequence.map((i, n) => {
          const Icon = ICONS[i];
          return <Icon key={n} size={40} strokeWidth={1.5} className={styles.laneIcon} aria-hidden="true" />;
        })}
      </div>
    </div>
  );
}

// Supabase keeps the session in cookies named sb-<project>-auth-token
// (sometimes chunked as .0, .1). If none exist nobody is signed in, so the
// network round trip to Supabase can be skipped entirely.
async function hasSessionCookie() {
  const store = await cookies();
  return store.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
}

export default async function LoginPage({ searchParams }) {
  if (await hasSessionCookie()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect('/home');
  }

  const params = await searchParams;
  const initialError =
    params?.error === 'auth_failed' ? 'That sign-in attempt expired or was already used. Please try again.' : null;

  return (
    <main className={styles.hero}>
      <div className={styles.bg} aria-hidden="true" />

      <div className={styles.lanes} aria-hidden="true">
        {LANES.map(([icons, duration, reverse], i) => (
          <IconLane key={i} icons={icons} duration={duration} reverse={reverse} />
        ))}
      </div>

      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.content}>
        <header className={styles.brand}>
          <p className={styles.eyebrow}>Welcome to</p>
          <h1 className={styles.wordmark}>WAY</h1>
          <p className={styles.tagline}>Track meals, the Indian way.</p>
        </header>

        <section className={styles.card} aria-label="Sign in">
          <LoginForm initialError={initialError} />
        </section>

        <footer className={styles.footer}>
          <Link href="/privacy">Privacy Policy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms">Terms of Service</Link>
        </footer>
      </div>
    </main>
  );
}
