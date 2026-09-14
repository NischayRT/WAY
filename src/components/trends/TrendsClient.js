'use client';

import { useMemo } from 'react';
import { ui } from '@/lib/ui';
import MacroBarChart from '@/components/trends/MacroBarChart';

export default function TrendsClient({ days, targets }) {
  const { caloriesData, proteinData, carbsData, fatData, avgCalories, avgProtein } = useMemo(() => {
    const calories = days.map((d) => ({ dayLabel: d.dayLabel, value: d.calories }));
    const protein = days.map((d) => ({ dayLabel: d.dayLabel, value: d.protein }));
    const carbs = days.map((d) => ({ dayLabel: d.dayLabel, value: d.carbs }));
    const fat = days.map((d) => ({ dayLabel: d.dayLabel, value: d.fat }));

    const avgCal = Math.round(calories.reduce((acc, d) => acc + d.value, 0) / days.length);
    const avgProt = Math.round(protein.reduce((acc, d) => acc + d.value, 0) / days.length);

    return {
      caloriesData: calories,
      proteinData: protein,
      carbsData: carbs,
      fatData: fat,
      avgCalories: avgCal,
      avgProtein: avgProt,
    };
  }, [days]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink/60 dark:text-slate-400">
        Last 7 days · Avg{' '}
        <span className={`font-numeric font-bold ${ui.macroText.calories}`}>{avgCalories} kcal</span> · Avg{' '}
        <span className={`font-numeric font-bold ${ui.macroText.protein}`}>{avgProtein}g protein</span>
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className={ui.card}>
          <MacroBarChart
            title="Calories"
            unit=" kcal"
            data={caloriesData}
            target={targets.targetCalories}
            colorClass="fill-turmeric"
          />
        </div>
        <div className={ui.card}>
          <MacroBarChart
            title="Protein"
            unit="g"
            data={proteinData}
            target={targets.proteinG}
            colorClass="fill-cardamom"
          />
        </div>
        <div className={ui.card}>
          <MacroBarChart
            title="Carbs"
            unit="g"
            data={carbsData}
            target={targets.carbsG}
            colorClass="fill-brick"
          />
        </div>
        <div className={ui.card}>
          <MacroBarChart
            title="Fat"
            unit="g"
            data={fatData}
            target={targets.fatG}
            colorClass="fill-brinjal"
          />
        </div>
      </div>
    </div>
  );
}