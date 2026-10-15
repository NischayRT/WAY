import Link from 'next/link';

// In-app disclosure required by Google for apps using Google Health API data.
// Shown next to every "Connect / Log in to Google Health" button, in normal
// app use (not only in the privacy policy). Keep the wording in sync with
// the Google Health section of /privacy.
export const HEALTH_DATA_DISCLOSURE =
  'WAY Studio collects health and fitness data from Google Health to show your activity, sleep and heart stats, calculate your Daily Score, Body Age and Readiness, let you compare or share stats with people you choose, and save the meals and weight you log back to Google Health.';

export default function HealthDataNotice({ className = '' }) {
  return (
    <p className={`text-[11px] leading-snug text-slate-500 dark:text-slate-400 [text-wrap:pretty] ${className}`}>
      {HEALTH_DATA_DISCLOSURE}{' '}
      <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">
        Privacy policy
      </Link>
    </p>
  );
}
