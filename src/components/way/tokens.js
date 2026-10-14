/** Class helpers shared by server and client components (no 'use client' here). */

export const cx = (...parts) => parts.filter(Boolean).join(' ');

/** Page body: 16px gutters on phones, room for the bottom bar; 40px gutters on desktop. */
export const PAGE =
  'mx-auto flex w-full max-w-[1360px] flex-col gap-3.5 px-4 pt-6 pb-[calc(104px+env(safe-area-inset-bottom))] md:gap-5 md:px-10 md:pt-8 md:pb-10';
