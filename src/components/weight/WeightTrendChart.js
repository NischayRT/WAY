export default function WeightTrendChart({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No weigh-ins yet — log your first one below.
      </p>
    );
  }

  const width = 600;
  const height = 200;
  const padding = 24;
  const weights = entries.map((e) => e.weight_kg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1;

  const points = entries.map((entry, i) => {
    const x =
      entries.length === 1
        ? width / 2
        : padding + (i / (entries.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((entry.weight_kg - minWeight) / range) * (height - padding * 2);
    return { x, y, ...entry };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible">
        {/* Subtle reference grid line */}
        <line
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-800"
          strokeWidth="1"
        />
        <path
          d={pathD}
          fill="none"
          className="stroke-amber-500 dark:stroke-amber-400 neon-amber"
          strokeWidth="2.5"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            className="fill-amber-500 dark:fill-amber-400 stroke-white dark:stroke-slate-900"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-xs font-numeric text-slate-400 dark:text-slate-500">
        <span>{entries[0].logged_at}</span>
        <span>{entries[entries.length - 1].logged_at}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Latest:{' '}
        <span className="font-numeric font-bold text-slate-900 dark:text-white">
          {entries[entries.length - 1].weight_kg} kg
        </span>{' '}
        · Range:{' '}
        <span className="font-numeric font-medium text-slate-700 dark:text-slate-300">
          {minWeight} – {maxWeight} kg
        </span>
      </p>
    </div>
  );
}