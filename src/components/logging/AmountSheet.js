'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, RotateCcw, Split } from 'lucide-react';
import { Modal, Segmented, Btn, Toggle, fmt, cx } from '@/components/way/ui';

/**
 * Edit how much of a food goes into this meal.
 *
 *  - Amount in portions (any fraction) or grams.
 *  - Portion size: "1 bowl = 250 g", optionally saved as the user's default.
 *  - For dishes with a recipe: the ingredients scaled to the chosen amount,
 *    each editable, with the option to log them as separate items (less oil,
 *    extra paneer, no sugar…).
 *
 * onApply({ grams, portion: {unit, g}, saveDefault, lines|null })
 */

const per100 = (f, g) => {
  const r = (Number(g) || 0) / 100;
  return {
    k: (Number(f.calories_kcal) || 0) * r,
    p: (Number(f.protein_g) || 0) * r,
    c: (Number(f.carbs_g) || 0) * r,
    f: (Number(f.fat_g) || 0) * r,
  };
};
const add = (a, b) => ({ k: a.k + b.k, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f });
const ZERO = { k: 0, p: 0, c: 0, f: 0 };
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (n) => Math.round(n * 10) / 10;

function NumberStepper({ value, onChange, step, unit, min = 0, max = 5000 }) {
  return (
    <div className="flex h-12 items-center rounded-xl border border-way-line2 bg-way-rail">
      <button type="button" aria-label="Less" onClick={() => onChange(clampNum(round1(value - step), min, max))} className="flex h-full w-11 items-center justify-center text-way-mute hover:text-way-ink">
        <Minus size={15} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : clampNum(Number(e.target.value), min, max))}
        className="way-num w-full min-w-0 flex-1 bg-transparent text-center font-mono text-lg font-semibold text-way-ink outline-none"
        aria-label={`Amount in ${unit}`}
      />
      <span className="pr-1 font-mono text-[11px] text-way-dim">{unit}</span>
      <button type="button" aria-label="More" onClick={() => onChange(clampNum(round1((Number.isFinite(value) ? value : 0) + step), min, max))} className="flex h-full w-11 items-center justify-center text-way-mute hover:text-way-ink">
        <Plus size={15} />
      </button>
    </div>
  );
}

export default function AmountSheet({ open, onClose, food, grams: startGrams, portion, defaultPortion, loadRecipe, onApply }) {
  const [mode, setMode] = useState('portions');
  const [g, setG] = useState(startGrams);
  const [unit, setUnit] = useState(portion.unit);
  const [unitG, setUnitG] = useState(portion.g);
  const [saveDefault, setSaveDefault] = useState(false);
  const [recipe, setRecipe] = useState({ state: 'idle', lines: [], cooked: 0 });
  const [edits, setEdits] = useState({}); // ingredient id -> grams
  const [split, setSplit] = useState(false);

  // Reset every time the sheet opens for a food.
  useEffect(() => {
    if (!open) return;
    setG(startGrams);
    setUnit(portion.unit);
    setUnitG(portion.g);
    setSaveDefault(false);
    setEdits({});
    setSplit(false);
    setMode(portion.unit === 'serving' && portion.g === 100 ? 'grams' : 'portions');
    if (loadRecipe) {
      setRecipe({ state: 'loading', lines: [], cooked: 0 });
      loadRecipe(food)
        .then((r) => setRecipe({ state: 'ready', ...r }))
        .catch(() => setRecipe({ state: 'error', lines: [], cooked: 0 }));
    } else {
      setRecipe({ state: 'idle', lines: [], cooked: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, food?.id]);

  const safeUnitG = unitG > 0 ? unitG : portion.g;
  const n = Number.isFinite(g) ? g / safeUnitG : 0;

  // Ingredient lines scaled from the whole recipe (cooked weight) to this amount.
  const scaled = useMemo(() => {
    if (!recipe.lines.length || !(recipe.cooked > 0) || !Number.isFinite(g)) return [];
    const factor = g / recipe.cooked;
    return recipe.lines.map((l) => {
      const auto = l.quantity_g * factor;
      const val = edits[l.ingredient.id];
      return { ...l, auto, g: val != null ? val : auto, edited: val != null };
    });
  }, [recipe, g, edits]);
  const anyEdit = scaled.some((l) => l.edited);
  const useLines = split || anyEdit;

  const total = useLines && scaled.length ? scaled.reduce((a, l) => add(a, per100(l.ingredient, l.g)), ZERO) : per100(food, g);

  const apply = () => {
    if (!Number.isFinite(g) || g <= 0) return;
    onApply({
      grams: g,
      portion: { unit: unit.trim() || portion.unit, g: safeUnitG },
      saveDefault,
      lines: useLines && scaled.length ? scaled.filter((l) => l.g > 0).map((l) => ({ ingredient: l.ingredient, g: l.g })) : null,
    });
  };

  const portionChanged = unit.trim() !== defaultPortion.unit || Math.round(safeUnitG) !== Math.round(defaultPortion.g);
  const quick = mode === 'portions' ? [0.5, 1, 1.5, 2, 3] : [50, 100, 150, 200, 250];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={food?.name || ''}
      subtitle={food?.isIngredient ? 'Ingredient · values per 100 g scale with the amount' : undefined}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" className="flex-1" onClick={apply} disabled={!Number.isFinite(g) || g <= 0}>
            <Check size={15} />
            {useLines ? `Add ${scaled.filter((l) => l.g > 0).length} ingredients` : `Use ${fmt(g)} g`}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Amount */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-way-mute">Amount</span>
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'portions', label: 'Portions' },
                { value: 'grams', label: 'Grams' },
              ]}
            />
          </div>
          {mode === 'portions' ? (
            <NumberStepper value={round1(n)} step={0.5} unit={n === 1 ? unit : `${unit}s`} max={50} onChange={(v) => setG(Number.isFinite(v) ? v * safeUnitG : NaN)} />
          ) : (
            <NumberStepper value={Number.isFinite(g) ? Math.round(g) : NaN} step={10} unit="g" max={5000} onChange={setG} />
          )}
          <div className="flex flex-wrap gap-1.5">
            {quick.map((v) => {
              const target = mode === 'portions' ? v * safeUnitG : v;
              const on = Number.isFinite(g) && Math.abs(target - g) < 0.5;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setG(target)}
                  className={cx(
                    'min-h-8 rounded-full border px-3 font-mono text-xs font-semibold transition-colors',
                    on ? 'border-way-ink bg-way-ink text-way-page' : 'border-way-line2 text-way-ink2 hover:border-way-line3'
                  )}
                >
                  {mode === 'portions' ? `${v === 0.5 ? '½' : v === 1.5 ? '1½' : v}` : `${v} g`}
                </button>
              );
            })}
          </div>
          <p className="font-mono text-[11px] text-way-dim">
            = {Number.isFinite(g) ? fmt(g) : '–'} g · {round1(n)} {n === 1 ? unit : `${unit}s`}
          </p>
        </div>

        {/* Portion size */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-way-line p-3.5">
          <span className="text-xs font-semibold text-way-mute">Portion size</span>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-way-mute">1</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value.slice(0, 20))}
              aria-label="Portion name"
              className="h-10 w-28 min-w-0 rounded-[10px] border border-way-line2 bg-way-rail px-2.5 text-way-ink outline-none focus:border-way-faint"
            />
            <span className="text-way-mute">=</span>
            <input
              type="number"
              inputMode="decimal"
              value={Number.isFinite(unitG) ? unitG : ''}
              onChange={(e) => {
                const next = e.target.value === '' ? NaN : clampNum(Number(e.target.value), 1, 5000);
                // In portions mode keep the number of portions; the grams follow the new size.
                if (mode === 'portions' && Number.isFinite(next) && Number.isFinite(g)) setG((g / safeUnitG) * next);
                setUnitG(next);
              }}
              aria-label="Grams per portion"
              className="way-num h-10 w-20 min-w-0 rounded-[10px] border border-way-line2 bg-way-rail px-2.5 text-right font-mono text-way-ink outline-none focus:border-way-faint"
            />
            <span className="text-way-mute">g</span>
            {portionChanged ? (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'portions' && Number.isFinite(g)) setG((g / safeUnitG) * defaultPortion.g);
                  setUnit(defaultPortion.unit);
                  setUnitG(defaultPortion.g);
                }}
                title="Back to the standard portion"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-way-mute hover:bg-way-hover hover:text-way-ink"
              >
                <RotateCcw size={14} />
              </button>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-way-dim">Remember this portion size for {food?.name}</span>
            <Toggle on={saveDefault} onChange={setSaveDefault} label="Remember portion size" />
          </div>
        </div>

        {/* Recipe ingredients */}
        {loadRecipe ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-way-mute">Ingredients in this amount</span>
              {scaled.length ? (
                <label className="flex items-center gap-2 text-xs text-way-dim">
                  <Split size={13} />
                  Log separately
                  <Toggle on={useLines} onChange={(v) => (v ? setSplit(true) : (setSplit(false), setEdits({})))} label="Log ingredients separately" />
                </label>
              ) : null}
            </div>
            {recipe.state === 'loading' ? <p className="text-xs text-way-dim">Loading recipe…</p> : null}
            {recipe.state === 'error' || (recipe.state === 'ready' && !scaled.length) ? (
              <p className="text-xs text-way-dim">No ingredient list for this dish.</p>
            ) : null}
            {scaled.length ? (
              <div className="flex flex-col divide-y divide-way-line rounded-2xl border border-way-line">
                {scaled.map((l) => {
                  const m = per100(l.ingredient, l.g);
                  return (
                    <div key={l.ingredient.id} className="flex items-center gap-2.5 px-3 py-2">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-medium">{l.ingredient.name}</span>
                        <span className="font-mono text-[10px] text-way-dim">
                          {fmt(m.k)} kcal · P {fmt(m.p)} · C {fmt(m.c)} · F {fmt(m.f)}
                        </span>
                      </div>
                      <span className="flex h-9 items-center rounded-[10px] border border-way-line2 bg-way-rail pr-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={Math.round(l.g)}
                          onChange={(e) =>
                            setEdits((s) => ({ ...s, [l.ingredient.id]: e.target.value === '' ? 0 : clampNum(Number(e.target.value), 0, 5000) }))
                          }
                          aria-label={`${l.ingredient.name} grams`}
                          className={cx('way-num w-16 bg-transparent px-2 text-right font-mono text-[13px] font-semibold outline-none', l.edited ? 'text-way-kcal' : 'text-way-ink')}
                        />
                        <span className="font-mono text-[10px] text-way-dim">g</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {scaled.length ? (
              <p className="text-[11px] leading-snug text-way-dim [text-wrap:pretty]">
                Raw ingredient weights for {fmt(g)} g of the cooked dish. Change any amount and it&apos;s logged as separate ingredients, so the macros
                match what you actually used.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Totals */}
        <div className="grid grid-cols-4 rounded-2xl border border-way-line py-3 text-center">
          {[
            ['kcal', total.k, 'text-way-kcal'],
            ['protein', total.p, 'text-way-protein'],
            ['carbs', total.c, 'text-way-carbs'],
            ['fat', total.f, 'text-way-fat'],
          ].map(([label, v, cls], i) => (
            <div key={label} className={cx('flex flex-col gap-0.5', i && 'border-l border-way-line')}>
              <span className={cx('font-mono text-base font-semibold', cls)}>
                {fmt(v)}
                {label === 'kcal' ? '' : <span className="text-[10px] text-way-dim">g</span>}
              </span>
              <span className="text-[10px] text-way-dim">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
