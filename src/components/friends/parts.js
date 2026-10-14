'use client';

import {
  Footprints,
  Navigation,
  Flame,
  Building2,
  Moon,
  HeartPulse,
  Scale,
  Utensils,
  Beef,
  PartyPopper,
  Swords,
  Lock,
} from 'lucide-react';
import { FIELDS, avatarOf, initialOf } from '@/lib/friends';
import { cx } from '@/components/way/ui';

export const FIELD_ICONS = {
  steps: Footprints,
  distance_km: Navigation,
  active_kcal: Flame,
  floors: Building2,
  sleep_hours: Moon,
  resting_hr: HeartPulse,
  weight_kg: Scale,
  calories_in: Utensils,
  protein_g: Beef,
};
export const ICONS = {
  footprints: Footprints,
  navigation: Navigation,
  flame: Flame,
  building: Building2,
  moon: Moon,
  utensils: Utensils,
  party: PartyPopper,
  swords: Swords,
};

export function Avatar({ person, isMe, size = 36, className = '', ring, children }) {
  const { bg, fg } = avatarOf(person, isMe);
  return (
    <div
      className={cx('relative flex shrink-0 items-center justify-center rounded-full font-semibold', className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.38), boxShadow: ring }}
    >
      {initialOf(person)}
      {children}
    </div>
  );
}

/** Small coloured pill for a stat ("Steps", "Weight 🔒"). */
export function FieldChip({ field, size = 'sm' }) {
  const f = FIELDS[field];
  if (!f) return null;
  return (
    <span
      className={cx('flex items-center gap-[3px] rounded-full font-semibold', size === 'sm' ? 'px-[7px] py-0.5 text-[10px] md:px-2 md:py-[3px] md:text-[11px]' : 'px-2 py-[3px] text-[11px]')}
      style={{ background: `${f.color}22`, color: f.color }}
    >
      {f.label}
      {f.sensitive ? <Lock size={9} /> : null}
    </span>
  );
}
