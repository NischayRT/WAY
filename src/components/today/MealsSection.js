'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Plus, ChefHat, UtensilsCrossed, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { syncToGoogleHealth, syncToGoogleHealthAndWait } from '@/lib/googleHealthSyncClient';
import { MEAL_CATEGORIES } from '@/lib/mealCategories';
import { mealTypeForGroup } from '@/lib/daily';
import { Btn, Eyebrow, Modal, Chip, fmt, cx } from '@/components/way/ui';

function MacroMini({ item, width = 64 }) {
  const pk = item.protein * 4;
  const ck = item.carbs * 4;
  const fk = item.fat * 9;
  return (
    <div
      title={`P ${Math.round(item.protein)}g · C ${Math.round(item.carbs)}g · F ${Math.round(item.fat)}g`}
      className="flex h-[3px] shrink-0 gap-px overflow-hidden rounded-sm md:h-1"
      style={{ width }}
    >
      <div style={{ flex: pk || 0.001, background: '#34d399' }} />
      <div style={{ flex: ck || 0.001, background: '#60a5fa' }} />
      <div style={{ flex: fk || 0.001, background: '#a78bfa' }} />
    </div>
  );
}

/** Edit an entry's amount, meal or day, or remove it. */
function EntryDialog({ entry, onClose, today, minDate }) {
  const supabase = createClient();
  const router = useRouter();
  const [qty, setQty] = useState(String(Math.round(Number(entry.log.quantity_g))));
  const [meal, setMeal] = useState(entry.log.meal_type);
  const [date, setDate] = useState(entry.log.logged_at || today);
  const [busy, setBusy] = useState(null);

  const id = entry.log.id;
  const per = entry.log.foods || {};
  const q = Number(qty) || 0;

  const save = async () => {
    if (!(q > 0)) return;
    setBusy('save');
    await supabase.from('food_logs').update({ quantity_g: q, meal_type: meal, logged_at: date }).eq('id', id);
    syncToGoogleHealth({ action: 'food_upsert', logIds: [id] });
    setBusy(null);
    onClose();
    router.refresh();
  };
  const remove = async () => {
    setBusy('delete');
    // Remove the Google Health copy first, while the row still knows its id.
    await syncToGoogleHealthAndWait({ action: 'food_delete', logIds: [id] });
    await supabase.from('food_logs').delete().eq('id', id);
    setBusy(null);
    onClose();
    router.refresh();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={460}
      title={per.name || 'Entry'}
      subtitle={`${fmt(((per.calories_kcal || 0) * q) / 100)} kcal · P ${fmt(((per.protein_g || 0) * q) / 100)} · C ${fmt(((per.carbs_g || 0) * q) / 100)} · F ${fmt(((per.fat_g || 0) * q) / 100)}`}
      footer={
        <>
          <Btn variant="dangerOutline" onClick={remove} disabled={!!busy} className="mr-auto">
            <Trash2 size={14} />
            {busy === 'delete' ? 'Removing…' : 'Remove'}
          </Btn>
          <Btn variant="primary" onClick={save} disabled={!!busy || !(q > 0)}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-way-mute">
            Amount
            <span className="flex h-11 items-center gap-1 rounded-xl border border-way-line2 bg-way-rail px-3">
              <input
                type="number"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="way-num w-full bg-transparent font-mono text-[15px] font-semibold text-way-ink outline-none"
              />
              <span className="font-mono text-[10px] text-way-dim">g</span>
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-way-mute">
            Day
            <input
              type="date"
              value={date}
              min={minDate}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl border border-way-line2 bg-way-rail px-3 font-mono text-[13px] text-way-ink outline-none"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-way-mute">Meal</span>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_CATEGORIES.map((m) => (
              <Chip key={m.value} on={meal === m.value} onClick={() => setMeal(m.value)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The day's four meals. Phones: one card of rows that expand on tap.
 * Desktop: a 2×2 grid of meal cards with every item showing.
 */
export default function MealsSection({ meals, k, selectedDate, today, minDate }) {
  const [open, setOpen] = useState({ lunch: true });
  const [editing, setEditing] = useState(null);
  const logHref = (key) => `/log-food?date=${selectedDate}${key ? `&meal=${mealTypeForGroup(key)}` : ''}`;

  return (
    <section className="flex flex-col gap-3.5" aria-label="Meals">
      <div className="flex items-center justify-between px-0.5 pt-1.5 lg:p-0">
        <Link href="/nutrition#day" className="group flex items-center gap-1">
          <Eyebrow>Meals</Eyebrow>
          <ChevronRight size={13} className="text-way-faint transition-colors group-hover:text-way-ink2" />
        </Link>
        <div className="flex gap-2">
          <Btn as={Link} href="/log-food/recipe" variant="outline" className="hidden rounded-[11px] lg:inline-flex">
            <ChefHat size={15} />
            Add recipe
          </Btn>
          <Btn as={Link} href={logHref(null)} variant="primary" size="sm" className="lg:h-10 lg:rounded-[11px] lg:px-3.5 lg:text-[13px]">
            <Plus size={13} className="lg:hidden" />
            <UtensilsCrossed size={15} className="hidden lg:block" />
            Log food
          </Btn>
        </div>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-way-line bg-way-card lg:grid lg:grid-cols-2 lg:gap-5 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent">
        {meals.map((m, mi) => {
          const isOpen = !!open[m.key];
          return (
            <div
              key={m.key}
              className={cx(
                'lg:flex lg:flex-col lg:gap-3.5 lg:rounded-[20px] lg:border lg:border-way-line lg:bg-way-card lg:px-[22px] lg:py-5 lg:transition-colors lg:hover:border-way-line2',
                mi && 'border-t border-way-line lg:border-t'
              )}
            >
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [m.key]: !o[m.key] }))}
                aria-expanded={isOpen}
                className="flex w-full flex-col gap-[9px] px-4 py-3.5 text-left lg:pointer-events-none lg:gap-3.5 lg:p-0"
              >
                <div className="flex w-full items-center justify-between lg:items-baseline">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold lg:text-[15px]">{m.label}</span>
                    <span className="text-[11px] text-way-dim lg:text-xs">{m.countStr}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold lg:text-[13px]" style={{ color: m.valColor }}>
                      {fmt(m.totals.calories)}
                      <span className="text-way-faint"> / {fmt(m.budget)}</span>
                    </span>
                    <ChevronDown
                      size={14}
                      className="text-way-dim transition-transform duration-[250ms] lg:hidden"
                      style={{ transform: `rotate(${isOpen ? 180 : 0}deg)` }}
                    />
                  </div>
                </div>
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-way-track">
                  <div
                    className="h-full transition-[width] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                    style={{ width: `${m.fill * k}%`, background: m.barColor }}
                  />
                </div>
              </button>
              <div
                className={cx('grid transition-[grid-template-rows] duration-300 ease-out lg:grid-rows-[1fr]', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-col gap-2.5 px-4 pb-3.5 lg:gap-3 lg:p-0">
                    {m.items.map((it) => (
                      <button
                        key={it.log.id}
                        type="button"
                        onClick={() => setEditing(it)}
                        title="Edit or remove"
                        className="group -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-0.5 text-left transition-colors hover:bg-way-hover lg:gap-3"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-[5px] lg:flex-row lg:items-baseline lg:gap-2">
                          <div className="flex min-w-0 items-baseline gap-1.5 lg:gap-2">
                            <span className="truncate text-[13px] lg:text-sm">{it.log.foods?.name}</span>
                            <span className="shrink-0 font-mono text-[10px] font-medium text-way-dim lg:text-[11px]">
                              {fmt(it.log.quantity_g)} g
                            </span>
                          </div>
                          <span className="lg:hidden">
                            <MacroMini item={it} />
                          </span>
                        </div>
                        <span className="hidden lg:block">
                          <MacroMini item={it} width={56} />
                        </span>
                        <span className="w-11 text-right font-mono text-xs font-semibold text-way-ink2 lg:text-[13px]">{fmt(it.calories)}</span>
                      </button>
                    ))}
                    {m.items.length === 0 ? (
                      <Link
                        href={logHref(m.key)}
                        className="rounded-xl border border-dashed border-way-line2 p-3 text-center text-xs text-way-mute transition-colors hover:border-way-faint hover:text-way-ink lg:p-[18px] lg:text-[13px]"
                      >
                        + Log {m.label.toLowerCase()}
                        <span className="hidden lg:inline"> · {fmt(m.budget)} kcal budget</span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editing ? <EntryDialog key={editing.log.id} entry={editing} onClose={() => setEditing(null)} today={today} minDate={minDate} /> : null}
    </section>
  );
}
