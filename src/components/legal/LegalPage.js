import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import { LEGAL } from '@/lib/legal';

export function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}

export function UL({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-400">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export function ContactLine() {
  return (
    <a className="font-medium text-emerald-600 underline underline-offset-2 dark:text-emerald-400" href={`mailto:${LEGAL.CONTACT_EMAIL}`}>
      {LEGAL.CONTACT_EMAIL}
    </a>
  );
}

// Public page shell (no login needed) shared by /privacy and /terms.
export default function LegalPage({ title, children, otherHref, otherLabel }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12 space-y-8">
      <AppHeader title={title} backHref="/" backLabel={`Back to ${LEGAL.APP_NAME}`} />
      <p className="-mt-4 text-xs text-slate-500 dark:text-slate-400">
        Effective {LEGAL.EFFECTIVE_DATE}
      </p>

      <div className="space-y-8">{children}</div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>&copy; {new Date().getFullYear()} {LEGAL.APP_NAME}</span>
        <Link href={otherHref} className="font-medium underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
          {otherLabel}
        </Link>
      </footer>
    </main>
  );
}