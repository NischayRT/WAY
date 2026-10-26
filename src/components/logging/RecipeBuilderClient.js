'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Save, Plus, Minus, X, CircleAlert, Search, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { getCurrentUserId } from '@/lib/currentUser';
import { getCachedIngredients, peekCachedIngredients, invalidateFoodCache } from '@/lib/cache/foodCache';
import { computeDishNutrition } from '@/lib/recipeNutrition';
import { PAGE, Card, Eyebrow, Segmented, Chip, Dot, fmt, cx } from '@/components/way/ui';

const METHODS = ['curry', 'dry_curry', 'deep_fried', 'shallow_fried', 'baked', 'grilled', 'steamed', 'boiled', 'roasted', 'stir_fried', 'raw', 'fermented', 'pickled'];
const CLASSES = ['main', 'snack', 'dessert', 'beverage', 'bread', 'rice_dish', 'soup_stew', 'dairy', 'condiment', 'leftover'];
const lbl = (s) => s.replace(/_/g, ' ').replace(/^./, (m) => m.toUpperCase());
const f1 = (n) => String(Math.round(n * 10) / 10);
const FAT_RE = /\b(oil|ghee|butter|vanaspati|dalda)\b/i;

/**
 * Build a dish from raw ingredients. The cooked weight turns the totals into
 * per-100 g values (water lost or absorbed is accounted for), and servings
 * give a per-plate number that logs in one tap.
 */
export default function RecipeBuilderClient({ authorName, starters, initialName = '', editing = null }) {
  const supabase = createClient();
  const [ingredients, setIngredients] = useState(() => peekCachedIngredients() ?? []);
  const [name, setName] = useState(editing?.name ?? initialName);
  const [starter, setStarter] = useState(null);
  const [sq, setSq] = useState(''); // similar-dish search
  const [method, setMethod] = useState(editing?.cooking_method || 'curry');
  const [cls, setCls] = useState(editing?.dish_class || 'main');
  const [lines, setLines] = useState([]); // [{ ingredient, g }]
  const [finalG, setFinalG] = useState(editing?.final_weight_g ? String(Math.round(Number(editing.final_weight_g))) : '');
  const [servings, setServings] = useState(() =>
    editing?.final_weight_g && editing?.serving_size_g
      ? Math.max(1, Math.round(Number(editing.final_weight_g) / Number(editing.serving_size_g)))
      : 4
  );
  const [editId, setEditId] = useState(editing?.id ?? null); // set when editing one of your dishes
  const [editNote, setEditNote] = useState(null);
  const [iq, setIq] = useState('');
  const [basis, setBasis] = useState('serving');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // saved dish name
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    getCachedIngredients(supabase)
      .then((data) => live && setIngredients(data))
      .catch((e) => live && setError(e.message || 'Could not load ingredients.'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Editing: fill in the dish's recipe lines once the ingredient list is here.
  const [linesLoaded, setLinesLoaded] = useState(!editing?.lines?.length);
  useEffect(() => {
    if (linesLoaded || !ingredients.length) return;
    const byId = new Map(ingredients.map((i) => [i.id, i]));
    setLines(editing.lines.map((l) => ({ ingredient: byId.get(l.ingredient_id), g: Number(l.quantity_g) })).filter((l) => l.ingredient));
    setLinesLoaded(true);
  }, [ingredients, linesLoaded, editing]);

  const touch = () => {
    setSaved(null);
    setError(null);
  };
  const ingById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  // Every dish with a recipe is searchable; the name you type also suggests one.
  const sql = sq.trim().toLowerCase();
  const similar = sql ? starters.filter((s) => s.name.toLowerCase().includes(sql)).slice(0, 12) : [];
  const nl = name.trim().toLowerCase();
  const nameMatch =
    nl.length >= 3 && !lines.length
      ? starters.find((s) => s.name.toLowerCase() === nl) ||
        starters.find((s) => s.name.toLowerCase().includes(nl) || nl.includes(s.name.toLowerCase()))
      : null;

  const applyStarter = (s) => {
    const ls = s.lines.map((l) => ({ ingredient: ingById.get(l.ingredient_id), g: Number(l.quantity_g) })).filter((l) => l.ingredient);
    setStarter(s.id);
    if (!name.trim() || starters.some((x) => x.name === name)) setName(s.name);
    if (s.cooking_method) setMethod(s.cooking_method);
    if (s.dish_class) setCls(s.dish_class);
    setLines(ls);
    const raw = ls.reduce((a, l) => a + l.g, 0);
    setFinalG(s.final_weight_g ? String(Math.round(Number(s.final_weight_g))) : String(Math.round(raw)));
    touch();
  };

  const sum = lines.reduce(
    (a, l) => {
      const r = (Number(l.g) || 0) / 100;
      const x = l.ingredient;
      return {
        k: a.k + (x.calories_kcal || 0) * r,
        p: a.p + (x.protein_g || 0) * r,
        c: a.c + (x.carbs_g || 0) * r,
        f: a.f + (x.fat_g || 0) * r,
        fb: a.fb + (x.fiber_g || 0) * r,
        raw: a.raw + (Number(l.g) || 0),
      };
    },
    { k: 0, p: 0, c: 0, f: 0, fb: 0, raw: 0 }
  );
  const fg = Number(finalG) || 0;
  const setLineG = (i, g) => {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, g } : l)));
    touch();
  };
  const removeLine = (i) => {
    setLines((ls) => ls.filter((_, j) => j !== i));
    touch();
  };

  const ql = iq.trim().toLowerCase();
  const have = new Set(lines.map((l) => l.ingredient.id));
  const res = ql ? ingredients.filter((i) => !have.has(i.id) && i.name.toLowerCase().includes(ql)).slice(0, 8) : [];
  const addIng = (ing) => {
    setLines((ls) => [...ls, { ingredient: ing, g: 100 }]);
    setIq('');
    touch();
  };

  const yieldPct = sum.raw ? (fg / sum.raw) * 100 : 0;
  const diff = Math.round(fg - sum.raw);
  const servingG = fg / Math.max(1, servings);
  const c = {
    rawStr: `${fmt(sum.raw)} g total`,
    metaStr: `${lines.length} ingredient${lines.length === 1 ? '' : 's'} · ${fmt(sum.k)} kcal in the pot`,
    yieldBar: Math.min(100, yieldPct / 2.5),
    yieldStr: !fg
      ? 'Enter the cooked weight'
      : diff < 0
        ? `${fmt(-diff)} g water cooked off · ${Math.round(yieldPct)}% of raw`
        : diff > 0
          ? `Absorbed ${fmt(diff)} g water · ${Math.round(yieldPct)}% of raw`
          : 'Same as raw weight',
  };

  const div = basis === 'serving' ? Math.max(1, servings) : fg ? fg / 100 : 1;
  const v0 = { k: sum.k / div, p: sum.p / div, c: sum.c / div, f: sum.f / div, fb: sum.fb / div };
  const eP = v0.p * 4;
  const eC = v0.c * 4;
  const eF = v0.f * 9;
  const eT = eP + eC + eF || 1;
  const note = basis === 'serving' ? `1 of ${servings} · ${fmt(servingG)} g` : 'per 100 g cooked';
  const noteD =
    basis === 'serving' ? `per serving · 1 of ${servings} · ${fmt(servingG)} g` : `per 100 g of the cooked dish · ${fmt(sum.k / Math.max(1, servings))} kcal per serving`;
  const macros = [
    ['Protein', v0.p, '#34d399', eP],
    ['Carbs', v0.c, '#60a5fa', eC],
    ['Fat', v0.f, '#a78bfa', eF],
    ['Fibre', v0.fb, '#7c8aa0', null],
  ];

  const sorted = lines.map((l) => ({ name: l.ingredient.name, k: ((l.ingredient.calories_kcal || 0) * (Number(l.g) || 0)) / 100 })).sort((a, b) => b.k - a.k);
  const top = sorted[0]?.k || 1;
  const contrib = sorted.slice(0, 6);
  const fat = lines.find((l) => FAT_RE.test(l.ingredient.name));
  const tip = fat
    ? `${fat.ingredient.name}: ${fmt(Number(fat.g) || 0)} g adds ${fmt(((fat.ingredient.calories_kcal || 0) * (Number(fat.g) || 0)) / 100)} kcal to the pot. Cutting 10 g saves ${fmt(((fat.ingredient.calories_kcal || 0) * 10) / 100 / Math.max(1, servings))} kcal per serving.`
    : 'Biggest contributors first. Change an amount to see this update.';

  const issue = !name.trim() ? 'Give the dish a name to save it.' : !lines.length ? 'Add at least one ingredient.' : !fg ? 'Enter the cooked weight.' : '';

  const save = async () => {
    if (issue || saving) return;
    let result;
    try {
      result = computeDishNutrition(
        lines.map((l) => ({ ingredient: l.ingredient, quantityG: Number(l.g) || 0 })),
        fg
      );
    } catch (e) {
      setError(e.message);
      return;
    }
    setSaving(true);
    setError(null);
    let userId;
    try {
      userId = await getCurrentUserId(supabase);
    } catch (e) {
      setSaving(false);
      setError(e.message);
      return;
    }
    const row = {
      name: name.trim(),
      category: 'custom',
      cooking_method: method || null,
      dish_class: cls || null,
      calories_kcal: result.per100g.calories_kcal,
      protein_g: result.per100g.protein_g,
      carbs_g: result.per100g.carbs_g,
      fat_g: result.per100g.fat_g,
      fiber_g: result.per100g.fiber_g,
      raw_weight_g: result.rawWeightG,
      final_weight_g: result.finalWeightG,
      source: 'user_calculated',
      created_by: userId,
      author_name: authorName || null,
    };
    if (editId) {
      // Only your own dish; the database checks it again. If someone else has
      // logged the old version, it is kept for them and this becomes a new one.
      const { created_by: _c, author_name: _a, source: _s, category: _g, ...food } = row;
      const { data: newId, error: upErr } = await supabase.rpc('update_my_food', {
        p_food_id: editId,
        p_food: { ...food, serving_size_g: Math.round(servingG) },
        p_lines: lines.map((l) => ({ ingredient_id: l.ingredient.id, quantity_g: Number(l.g) || 0 })),
      });
      setSaving(false);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      if (newId && newId !== editId) {
        setEditNote('Others had logged the earlier version, so it stays as it was for them. Your logs now use this one.');
        setEditId(newId);
      }
      invalidateFoodCache();
      setSaved(name.trim());
      return;
    }
    const ins = await supabase
      .from('foods')
      .insert({ ...row, serving_size_g: Math.round(servingG) })
      .select('id')
      .single();
    if (ins.error) {
      setSaving(false);
      setError(ins.error.message);
      return;
    }
    const { error: lineError } = await supabase
      .from('dish_ingredients')
      .insert(lines.map((l) => ({ food_id: ins.data.id, ingredient_id: l.ingredient.id, quantity_g: Number(l.g) || 0 })));
    setSaving(false);
    if (lineError) {
      setError(lineError.message);
      return;
    }
    invalidateFoodCache();
    setSaved(name.trim());
  };

  const saveBtn = saved
    ? { label: 'Saved', Icon: Check, cls: 'bg-way-track text-way-protein' }
    : issue
      ? { label: 'Save recipe', Icon: Save, cls: 'bg-way-track text-way-faint' }
      : { label: saving ? 'Saving…' : 'Save recipe', Icon: Save, cls: 'bg-way-protein text-way-page hover:bg-emerald-300' };
  const logHref = saved ? `/log-food?q=${encodeURIComponent(saved)}` : '/log-food';

  const servingsStepper = (big) => (
    <div className="flex shrink-0 items-center rounded-xl border border-way-line2 bg-way-page">
      <button
        type="button"
        aria-label="Fewer servings"
        onClick={() => {
          setServings((s) => Math.max(1, s - 1));
          touch();
        }}
        className={cx('flex w-[42px] items-center justify-center text-way-mute', big ? 'h-12' : 'h-11')}
      >
        <Minus size={15} />
      </button>
      <span className={cx('min-w-[30px] text-center font-mono font-semibold', big ? 'text-[17px]' : 'text-[15px]')}>{servings}</span>
      <button
        type="button"
        aria-label="More servings"
        onClick={() => {
          setServings((s) => Math.min(20, s + 1));
          touch();
        }}
        className={cx('flex w-[42px] items-center justify-center text-way-mute', big ? 'h-12' : 'h-11')}
      >
        <Plus size={15} />
      </button>
    </div>
  );

  const basisToggle = (desktop) => (
    <Segmented
      size="sm"
      mono
      className="rounded-[10px] bg-way-page p-[3px]"
      value={basis}
      onChange={setBasis}
      options={[
        { value: 'serving', label: desktop ? 'Per serving' : '1 serving' },
        { value: '100', label: desktop ? 'Per 100 g' : '100 g' },
      ]}
    />
  );

  return (
    <main className={cx(PAGE, 'pb-[calc(230px+env(safe-area-inset-bottom))] md:pb-[150px] lg:pb-10')}>
      <header className="flex items-center justify-between gap-4 md:gap-6">
        <div className="flex min-w-0 items-center gap-1.5 md:flex-col md:items-start md:gap-2">
          <Link href="/log-food" aria-label="Back to Log food" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-way-ink2 md:h-auto md:w-auto md:gap-1.5 md:text-[13px] md:text-way-mute md:hover:text-way-ink">
            <ArrowLeft size={19} className="md:h-3.5 md:w-3.5" />
            <span className="hidden md:inline">Log food</span>
          </Link>
          <div className="flex min-w-0 flex-col gap-px md:flex-row md:items-baseline md:gap-3.5">
            <h1 className="font-heading text-xl font-bold leading-none md:text-[34px] md:tracking-[-0.01em]">{editId ? 'Edit recipe' : 'New recipe'}</h1>
            <span className="truncate font-mono text-[10px] font-medium text-way-dim md:text-xs">{c.metaStr}</span>
          </div>
        </div>
        <div className="hidden gap-2.5 md:flex">
          <Link href="/log-food" className="flex h-11 items-center rounded-xl border border-way-line2 px-4 text-[13px] font-semibold text-way-ink2 hover:bg-way-hover">
            Cancel
          </Link>
          <button type="button" onClick={save} disabled={!!issue || saving} className={cx('flex h-11 items-center gap-[7px] rounded-xl px-[18px] text-[13px] font-semibold transition-colors', saveBtn.cls)}>
            <saveBtn.Icon size={15} />
            {saveBtn.label}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-[18px] md:gap-5">
          {saved ? (
            <div className="flex items-center gap-2.5 rounded-[14px] bg-emerald-400/12 px-3.5 py-3 text-[13px] font-medium text-way-protein md:px-4 md:text-sm">
              <Check size={15} />
              <span className="flex-1">
                <span className="md:hidden">Saved to My recipes.</span>
                <span className="hidden md:inline">“{saved}” is saved to My recipes and shows up in search.</span>
                {editNote ? <span className="mt-1 block text-xs font-normal text-way-ink2">{editNote}</span> : null}
              </span>
              <Link href={logHref} className="font-semibold">
                Log a serving<span className="hidden md:inline"> now</span> →
              </Link>
            </div>
          ) : null}

          <Card className="flex flex-col gap-[18px] border-0 bg-transparent p-0 md:border md:bg-way-card md:p-6">
            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 md:gap-5">
              <label className="flex flex-col gap-2">
                <Eyebrow>Dish name</Eyebrow>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    touch();
                  }}
                  placeholder="e.g. Amma's Chicken Chettinad"
                  className="h-[50px] rounded-[14px] border border-way-line2 bg-way-card px-3.5 text-base font-medium text-way-ink outline-none placeholder:text-way-faint focus:border-way-faint md:bg-way-page md:px-4 md:text-[17px]"
                />
              </label>
              <div className="flex min-w-0 flex-col gap-2">
                <Eyebrow>Start from a similar dish</Eyebrow>
                {starters.length ? (
                  <div className="relative">
                    <div className="flex items-center gap-2 rounded-xl border border-way-line2 bg-way-card px-3 focus-within:border-way-faint md:bg-way-page">
                      <Search size={15} className="text-way-dim" />
                      <input
                        value={sq}
                        onChange={(e) => setSq(e.target.value)}
                        placeholder={`Search ${starters.length} dishes to copy their ingredients`}
                        className="h-11 flex-1 bg-transparent text-sm text-way-ink outline-none placeholder:text-way-faint"
                      />
                      {sq ? (
                        <button type="button" onClick={() => setSq('')} aria-label="Clear" className="text-way-dim hover:text-way-ink">
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                    {similar.length && sq.trim() ? (
                      <div className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-auto rounded-xl border border-way-line2 bg-[#111827] shadow-[0_12px_30px_rgba(0,0,0,.45)]">
                        {similar.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              applyStarter(s);
                              setSq('');
                            }}
                            className="flex w-full items-center justify-between gap-2 border-t border-way-line px-3 py-2.5 text-left text-[13px] first:border-t-0 hover:bg-way-hover"
                          >
                            <span className="truncate">{s.name}</span>
                            <span className="shrink-0 font-mono text-[11px] text-way-dim">{s.lines.length} ingredients</span>
                          </button>
                        ))}
                      </div>
                    ) : sq.trim() ? (
                      <p className="pt-1.5 text-xs text-way-dim">No dish called “{sq.trim()}” has a recipe yet.</p>
                    ) : null}
                  </div>
                ) : null}
                {nameMatch && starter !== nameMatch.id ? (
                  <button
                    type="button"
                    onClick={() => applyStarter(nameMatch)}
                    className="way-rise flex items-center gap-2 self-start rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-2 text-left text-xs text-amber-100"
                  >
                    <Sparkles size={13} className="shrink-0 text-way-kcal" />
                    Looks like “{nameMatch.name}”. Copy its {nameMatch.lines.length} ingredients?
                  </button>
                ) : null}
                {starters.length ? (
                  <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
                    {starters.slice(0, 6).map((s) => (
                      <Chip key={s.id} on={starter === s.id} onClick={() => applyStarter(s)} className="min-h-[38px] px-3.5 text-[13px] font-medium md:min-h-9">
                        {s.name}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-way-dim">No saved recipes to start from yet.</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 md:gap-5 md:border-t md:border-way-line md:pt-[18px]">
              <div className="flex flex-col gap-2">
                <Eyebrow>Cooking method</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <Chip key={m} on={method === m} onClick={() => setMethod(m)} className="min-h-8 font-medium">
                      {lbl(m)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Eyebrow>Type of dish</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {CLASSES.map((m) => (
                    <Chip key={m} on={cls === m} onClick={() => setCls(m)} className="min-h-8 font-medium">
                      {lbl(m)}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Ingredients */}
          <div className="flex flex-col gap-2 md:gap-0">
            <div className="flex items-baseline justify-between md:hidden">
              <Eyebrow>Ingredients · raw</Eyebrow>
              <span className="font-mono text-[11px] font-medium text-way-dim">{c.rawStr}</span>
            </div>
            <Card className="flex flex-col overflow-hidden rounded-[18px] md:rounded-[22px]">
              <div className="hidden items-baseline justify-between px-6 pb-3.5 pt-5 md:flex">
                <Eyebrow>Ingredients · raw weight</Eyebrow>
                <span className="font-mono text-xs font-medium text-way-dim">{c.rawStr}</span>
              </div>
              <div className="hidden grid-cols-[minmax(0,1fr)_130px_70px_70px_70px_80px_40px] items-center gap-3 border-b border-way-line px-6 pb-2.5 font-mono text-[10px] font-semibold tracking-[0.06em] text-way-dim md:grid">
                <span>INGREDIENT</span>
                <span className="text-right">AMOUNT</span>
                <span className="text-right text-way-protein">PROTEIN</span>
                <span className="text-right text-way-carbs">CARBS</span>
                <span className="text-right text-way-fat">FAT</span>
                <span className="text-right text-way-kcal">KCAL</span>
                <span />
              </div>
              {lines.map((l, i) => {
                const r = (Number(l.g) || 0) / 100;
                const x = l.ingredient;
                return (
                  <div
                    key={x.id}
                    className={cx(
                      'flex items-center gap-2 py-2 pl-3.5 pr-2 md:grid md:grid-cols-[minmax(0,1fr)_130px_70px_70px_70px_80px_40px] md:gap-3 md:px-6 md:hover:bg-[#121927]',
                      i && 'border-t border-[#161d2b]'
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{x.name}</span>
                      <span className="font-mono text-[10px] font-medium text-way-dim md:hidden">
                        {fmt((x.calories_kcal || 0) * r)} kcal · P {f1((x.protein_g || 0) * r)}
                      </span>
                    </div>
                    <div className="flex h-10 shrink-0 items-center rounded-[10px] border border-way-line2 md:h-[38px] md:justify-self-end md:bg-way-page">
                      <button type="button" aria-label="Less" onClick={() => setLineG(i, Math.max(0, (Number(l.g) || 0) - 10))} className="hidden h-full w-[30px] items-center justify-center text-way-dim md:flex">
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={l.g}
                        onChange={(e) => setLineG(i, e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        className="way-num h-full w-[52px] bg-transparent p-0 text-right font-mono text-[13px] font-semibold text-way-ink outline-none md:w-11"
                      />
                      <span className="pl-[3px] pr-2.5 font-mono text-[11px] font-medium text-way-dim md:pl-0.5 md:pr-0">g</span>
                      <button type="button" aria-label="More" onClick={() => setLineG(i, (Number(l.g) || 0) + 10)} className="hidden h-full w-[30px] items-center justify-center text-way-dim md:flex">
                        <Plus size={12} />
                      </button>
                    </div>
                    {[x.protein_g, x.carbs_g, x.fat_g].map((v, j) => (
                      <span key={j} className="hidden text-right font-mono text-[13px] font-medium text-way-ink2 md:block">
                        {f1((v || 0) * r)}
                      </span>
                    ))}
                    <span className="hidden text-right font-mono text-sm font-semibold md:block">{fmt((x.calories_kcal || 0) * r)}</span>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      title="Remove"
                      aria-label={`Remove ${x.name}`}
                      className="flex h-10 w-9 shrink-0 items-center justify-center rounded-[10px] text-way-dim transition-colors hover:bg-way-track hover:text-way-over md:h-9"
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
              <div className="relative flex items-center border-t border-way-line">
                <Plus size={15} className="pointer-events-none absolute left-3.5 text-way-protein md:left-6" />
                <input
                  type="text"
                  value={iq}
                  onChange={(e) => setIq(e.target.value)}
                  placeholder="Add an ingredient — onion, ghee, toor dal…"
                  className="h-[50px] w-full bg-transparent pl-[38px] pr-3.5 text-sm text-way-ink outline-none placeholder:text-way-faint md:h-[54px] md:pl-[50px] md:pr-6"
                />
              </div>
              {ql ? (
                <div className="grid grid-cols-1 border-t border-way-line bg-way-rail md:grid-cols-2">
                  {res.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => addIng(r)}
                      className="flex min-h-11 items-center justify-between gap-2 border-t border-[#161d2b] px-3.5 text-left first:border-t-0 hover:bg-[#121927] md:min-h-[46px] md:px-6 md:[&:nth-child(2)]:border-t-0"
                    >
                      <span className="flex items-center gap-2 text-[13px]">
                        <Plus size={13} className="hidden text-way-protein md:block" />
                        {r.name}
                      </span>
                      <span className="font-mono text-[10px] font-medium text-way-dim md:text-[11px]">{fmt(r.calories_kcal)} kcal/100g</span>
                    </button>
                  ))}
                  {!res.length ? <div className="px-3.5 py-3 text-xs text-way-dim md:px-6 md:text-[13px]">No ingredient called “{iq.trim()}”.</div> : null}
                </div>
              ) : null}
            </Card>
          </div>

          {/* Cooked weight + servings */}
          <Card className="flex flex-col gap-2.5 rounded-[18px] border-way-line2 p-4 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-7 md:rounded-[22px] md:p-6">
            <div className="flex flex-col gap-2.5 md:gap-3">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex flex-1 flex-col gap-[3px] md:gap-1">
                  <span className="text-sm font-semibold md:text-[15px]">Cooked weight</span>
                  <span className="text-[11px] text-way-dim [text-wrap:pretty] md:text-xs">
                    Weigh the finished dish, minus the pot.<span className="hidden md:inline"> This accounts for water lost or absorbed while cooking.</span>
                  </span>
                </div>
                <div className="flex h-[46px] shrink-0 items-center rounded-xl border border-way-line3 bg-way-page md:h-[50px]">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={finalG}
                    onChange={(e) => {
                      setFinalG(e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value))));
                      touch();
                    }}
                    className="way-num h-full w-[70px] bg-transparent p-0 text-right font-mono text-base font-semibold text-way-ink outline-none md:w-[84px] md:text-lg"
                  />
                  <span className="pl-1 pr-3 font-mono text-xs font-medium text-way-dim md:pr-3.5">g</span>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-[3px] bg-way-track">
                <div className="h-full rounded-[3px] bg-way-carbs transition-[width] duration-500" style={{ width: `${c.yieldBar}%` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-2.5">
                <span className="font-mono text-[11px] font-medium text-way-mute md:text-xs">{c.yieldStr}</span>
                {sum.raw ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFinalG(String(Math.round(sum.raw)));
                      touch();
                    }}
                    className="text-xs text-way-protein"
                  >
                    Didn&apos;t weigh it? Use raw weight
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-way-line pt-3 md:border-l md:border-t-0 md:pl-7 md:pt-0">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex flex-1 flex-col gap-[3px] md:gap-1">
                  <span className="text-sm font-semibold md:text-[15px]">Servings</span>
                  <span className="font-mono text-[11px] font-medium text-way-dim md:font-sans md:text-xs md:font-normal">
                    <span className="md:hidden">{fmt(servingG)} g each</span>
                    <span className="hidden md:inline">How many plates this makes</span>
                  </span>
                </div>
                {servingsStepper(true)}
              </div>
              <span className="hidden font-mono text-xs font-medium text-way-mute md:block">{fmt(servingG)} g per serving · logs as 1 serving</span>
            </div>
          </Card>
          {error ? <p className="text-[13px] text-rose-300">{error}</p> : null}
        </div>

        {/* Desktop: live nutrition + where the calories come from */}
        <aside className="sticky top-6 hidden flex-col gap-4 lg:flex">
          <Card className="flex flex-col gap-5 border-way-line2 p-6">
            <div className="flex items-center justify-between gap-2.5">
              <Eyebrow>Nutrition</Eyebrow>
              {basisToggle(true)}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-5xl font-semibold leading-none text-way-kcal">{fmt(v0.k)}</span>
                <span className="font-mono text-sm font-medium text-way-dim">kcal</span>
              </div>
              <span className="text-[13px] text-way-mute">{noteD}</span>
            </div>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]">
              <div className="transition-[flex] duration-500" style={{ flex: eP || 0.001, background: '#34d399' }} />
              <div className="transition-[flex] duration-500" style={{ flex: eC || 0.001, background: '#60a5fa' }} />
              <div className="transition-[flex] duration-500" style={{ flex: eF || 0.001, background: '#a78bfa' }} />
            </div>
            <div className="grid grid-cols-4">
              {macros.map(([label, val, color, e], i) => (
                <div key={label} className={cx('flex flex-col gap-1 px-3', i ? 'border-l border-way-line' : 'pl-0')}>
                  <span className="flex items-center gap-1.5 text-[11px] text-way-mute">
                    <Dot color={color} />
                    {label}
                  </span>
                  <span className="font-mono text-lg font-semibold">
                    {f1(val)}
                    <span className="text-[11px] text-way-dim">g</span>
                  </span>
                  <span className="font-mono text-[10px] font-medium text-way-dim">{e == null ? '—' : `${Math.round((e / eT) * 100)}% kcal`}</span>
                </div>
              ))}
            </div>
            {issue ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-400/8 px-3 py-2.5 text-xs text-way-kcal">
                <CircleAlert size={14} />
                {issue}
              </div>
            ) : null}
          </Card>
          <Card className="flex flex-col gap-3.5 p-6">
            <div className="flex items-baseline justify-between">
              <Eyebrow>Where the calories come from</Eyebrow>
              <span className="font-mono text-[11px] font-medium text-way-dim">whole pot</span>
            </div>
            {contrib.length ? (
              contrib.map((x, i) => (
                <div key={x.name} className="grid grid-cols-[130px_minmax(0,1fr)_44px] items-center gap-2.5">
                  <span className="truncate text-xs text-way-ink2">{x.name}</span>
                  <div className="h-2 overflow-hidden rounded bg-way-track">
                    <div className="h-full rounded bg-way-kcal transition-[width] duration-500" style={{ width: `${(x.k / top) * 100}%`, opacity: i === 0 ? 1 : 0.55 }} />
                  </div>
                  <span className="text-right font-mono text-[11px] font-semibold text-way-mute">{sum.k ? Math.round((x.k / sum.k) * 100) : 0}%</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-way-dim">Add ingredients to see what drives the calories.</span>
            )}
            <span className="border-t border-way-line pt-3 text-xs text-way-mute [text-wrap:pretty]">{tip}</span>
          </Card>
        </aside>
      </div>

      {/* Phones and tablets: live nutrition bar above the bottom bar */}
      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2.5 rounded-t-[20px] border-t border-way-line2 bg-[#0d1320] px-3.5 pb-3 pt-3 shadow-[0_-12px_30px_rgba(0,0,0,.4)] md:bottom-0 md:left-[76px] md:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex items-center justify-between gap-2">
          {basisToggle(false)}
          <span className="font-mono text-[10px] font-medium text-way-dim">{note}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline gap-[5px]">
              <span className="font-mono text-2xl font-semibold leading-none text-way-kcal">{fmt(v0.k)}</span>
              <span className="font-mono text-[11px] font-medium text-way-dim">kcal</span>
            </div>
            <span className="font-mono text-[11px] font-medium text-way-mute">
              <span className="text-way-protein">P {fmt(v0.p)}g</span> · <span className="text-way-carbs">C {fmt(v0.c)}g</span> ·{' '}
              <span className="text-way-fat">F {fmt(v0.f)}g</span> · Fb {f1(v0.fb)}g
            </span>
          </div>
          <button type="button" onClick={save} disabled={!!issue || saving} className={cx('flex h-[50px] shrink-0 items-center gap-[7px] rounded-[14px] px-5 text-sm font-semibold transition-colors', saveBtn.cls)}>
            <saveBtn.Icon size={15} />
            {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {issue ? <span className="text-[11px] text-way-kcal">{issue}</span> : null}
      </div>
    </main>
  );
}
