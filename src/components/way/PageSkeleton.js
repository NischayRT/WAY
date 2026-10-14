import { PAGE, cx } from './tokens';

function Block({ className }) {
  return <div className={cx('animate-pulse rounded-[22px] border border-way-line bg-way-card', className)} />;
}

/**
 * Loading placeholder in the dashboard's shape: a title, then cards in the
 * same 12-column rhythm as the real screens.
 * variant: 'today' | 'split' (8 + 4 then thirds) | 'list' (list + side column)
 */
export default function PageSkeleton({ variant = 'split' }) {
  return (
    <main className={PAGE} aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between gap-4">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-way-track md:h-9" />
        <div className="hidden h-11 w-72 animate-pulse rounded-[14px] bg-way-card md:block" />
      </div>
      {variant === 'today' ? <div className="h-[62px] animate-pulse rounded-2xl bg-way-card md:hidden" /> : null}
      {variant === 'list' ? (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
          <div className="flex flex-col gap-3.5">
            <div className="h-[52px] animate-pulse rounded-[14px] bg-way-card" />
            <Block className="h-[420px]" />
          </div>
          <Block className="hidden h-[460px] lg:block" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:gap-5">
          <Block className="h-[320px] lg:col-span-8 lg:h-[380px]" />
          <Block className="h-[240px] lg:col-span-4 lg:h-[380px]" />
          <Block className="h-[150px] lg:col-span-4 lg:h-[220px]" />
          <Block className="h-[150px] lg:col-span-4 lg:h-[220px]" />
          <Block className="h-[150px] lg:col-span-4 lg:h-[220px]" />
        </div>
      )}
    </main>
  );
}
