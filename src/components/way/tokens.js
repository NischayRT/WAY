/** Class helpers shared by server and client components (no 'use client' here). */

export const cx = (...parts) => parts.filter(Boolean).join(' ');

/** Page body: 12px gutters on phones, room for the bottom bar; 24px (32px wide) gutters on desktop. */
export const PAGE =
  'mx-auto flex w-full max-w-[1360px] flex-col gap-3 px-3 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:gap-4 md:px-6 md:pt-6 md:pb-8 xl:px-8';
