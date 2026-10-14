'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X, Plus, Carrot } from 'lucide-react';
import { getCachedIngredients, peekCachedIngredients } from '@/lib/cache/foodCache';
import { cx } from '@/components/way/ui';

const MAX_SHOWN = 8;

/**
 * "Cook from what you have": pick ingredients, and the list below shows
 * dishes that use them (see /api/dish-builder). Chosen ingredients live in
 * the parent so the results survive switching tabs.
 */
export default function IngredientPicker({ supabase, chosen, onChange }) {
  const [all, setAll] = useState(() => peekCachedIngredients() ?? []);
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    getCachedIngredients(supabase)
      .then((data) => live && setAll(data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [supabase]);

  const ql = q.trim().toLowerCase();
  const chosenIds = useMemo(() => new Set(chosen.map((c) => c.id)), [chosen]);
  const matches = useMemo(() => {
    if (!ql) return [];
    const starts = [];
    const contains = [];
    for (const i of all) {
      if (chosenIds.has(i.id)) continue;
      const nm = i.name.toLowerCase();
      if (nm.startsWith(ql)) starts.push(i);
      else if (nm.includes(ql)) contains.push(i);
    }
    return [...starts, ...contains].slice(0, MAX_SHOWN);
  }, [all, ql, chosenIds]);

  const add = (ing) => {
    onChange([...chosen, { id: ing.id, name: ing.name }]);
    setQ('');
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-way-line2 bg-way-card p-3 md:p-4">
      <div className="flex items-center gap-2 text-xs text-way-mute md:text-[13px]">
        <Carrot size={15} className="text-way-kcal" />
        Pick what you have. Dishes that use them show up below, best match first.
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-way-line2 bg-way-rail px-3 focus-within:border-way-faint">
          <Search size={15} className="text-way-dim" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) add(matches[0]);
            }}
            placeholder={all.length ? 'Add an ingredient — onion, paneer, rice…' : 'Loading ingredients…'}
            className="h-11 flex-1 bg-transparent text-sm text-way-ink outline-none placeholder:text-way-faint"
          />
        </div>
        {ql ? (
          <div className="absolute inset-x-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-xl border border-way-line2 bg-[#111827] shadow-[0_12px_30px_rgba(0,0,0,.45)]">
            {matches.length ? (
              matches.map((ing) => (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => add(ing)}
                  className="flex w-full items-center justify-between gap-2 border-t border-way-line px-3 py-2.5 text-left text-[13px] first:border-t-0 hover:bg-way-hover"
                >
                  {ing.name}
                  <Plus size={14} className="text-way-dim" />
                </button>
              ))
            ) : (
              <p className="px-3 py-2.5 text-[13px] text-way-dim">No ingredient called “{q.trim()}”.</p>
            )}
          </div>
        ) : null}
      </div>
      {chosen.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chosen.map((c) => (
            <span key={c.id} className="flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 py-1 pl-2.5 pr-1 text-xs font-medium text-amber-100">
              {c.name}
              <button
                type="button"
                onClick={() => onChange(chosen.filter((x) => x.id !== c.id))}
                aria-label={`Remove ${c.name}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-amber-200/70 hover:bg-amber-400/20 hover:text-amber-100"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])} className={cx('px-1.5 text-xs text-way-dim hover:text-way-ink')}>
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
