import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Utensils, Scale, Footprints, Boxes, ShieldCheck, ArrowRight } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import ThemeToggle from '@/components/layout/ThemeToggle';
import { LEGAL } from '@/lib/legal';

// Public homepage. Visitors who are not signed in (including Google's
// verification reviewers) see what the app is for without logging in;
// signed-in users go straight to their dashboard.
export const metadata = {
  title: { absolute: 'WAY Studio — Indian food diet & physique tracker' },
  description:
    'WAY Studio is a free web app for tracking calories and macros of Indian food, logging your weight, and viewing your progress. Optional Google Health sync.',
  alternates: { canonical: '/' },
};

const FEATURES = [
  {
    Icon: Utensils,
    title: 'Track Indian food, your way',
    text: 'Log meals from a food database built around Indian dishes, or build your own recipes. See calories, protein, carbs and fat for every meal and for the whole day.',
  },
  {
    Icon: Scale,
    title: 'Weight and body progress',
    text: 'Record your weight over time, set a target, and see your trend. Add body measurements to preview your physique projection in 3D.',
  },
  {
    Icon: Footprints,
    title: 'Activity at a glance',
    text: 'Optionally connect Google Health to see your daily steps, distance and calories burned next to what you eat.',
  },
  {
    Icon: Boxes,
    title: 'Targets that fit you',
    text: 'Daily calorie and macro targets are calculated from your height, weight, age, activity level and goal, and you can set your own.',
  },
];

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/home');

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white text-slate-900 dark:bg-[#050b18] dark:text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.18),transparent)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-5">
        <Link href="/" className="font-brand text-3xl leading-none tracking-tight">
          {LEGAL.APP_NAME}
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-3">
          <Link href="/privacy" className="hidden rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:block">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hidden rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:block">
            Terms of Service
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Sign in
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 space-y-16 px-5 pb-16 pt-8 sm:pt-14">
        {/* Purpose */}
        <section className="max-w-3xl space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Diet &amp; physique tracking for Indian food
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Know what you eat. See where you&apos;re heading.
          </h1>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
            {LEGAL.APP_NAME} is a free web app that helps you track the calories and macros
            (protein, carbohydrates and fat) of the Indian food you actually eat, log your weight, and
            follow your progress toward a goal such as losing weight, maintaining, or building muscle.
            You can optionally connect Google Health to bring in your steps, distance and calories burned,
            and to send your logged meals and weight to the Google Health app.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              Get started <ArrowRight size={16} />
            </Link>
            <Link href="/privacy" className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              Read our Privacy Policy
            </Link>
          </div>
        </section>

        {/* What it does */}
        <section aria-labelledby="what" className="space-y-6">
          <h2 id="what" className="text-2xl font-semibold">
            What {LEGAL.APP_NAME} does
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22]"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Google Health */}
        <section aria-labelledby="google-health" className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-[#14305a] dark:bg-[#071225]">
          <h2 id="google-health" className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck size={22} className="text-emerald-500" /> How {LEGAL.APP_NAME} uses Google Health
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Connecting Google Health is optional and always your choice. If you connect it,
            {' '}{LEGAL.APP_NAME} asks for permission to:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <li>
              <strong>Read your activity</strong> (steps, distance and calories burned) to show on your dashboard.
            </li>
            <li>
              <strong>Write nutrition data</strong> (calories, protein, carbohydrates and fat) for meals you log in
              {' '}{LEGAL.APP_NAME}, so they appear in the Google Health app.
            </li>
            <li>
              <strong>Write your weight</strong> so the weight you log appears in the Google Health app.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            You can disconnect at any time from Settings. We do not sell your data or use it for advertising.{' '}
            {LEGAL.APP_NAME}&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
            <a
              className="font-medium text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Details are in our{' '}
            <Link className="font-medium text-emerald-600 underline underline-offset-2 dark:text-emerald-400" href="/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-slate-500 dark:text-slate-400">
          <span>
            &copy; {new Date().getFullYear()} {LEGAL.APP_NAME}
          </span>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms of Service</Link>
            <a href={`mailto:${LEGAL.CONTACT_EMAIL}`} className="hover:text-slate-900 dark:hover:text-white">{LEGAL.CONTACT_EMAIL}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}