import { ui } from '@/lib/ui';

export default function MacroBarChart({ title, unit, data, target, colorClass }) {
  const width = 320;
  const height = 160;
  const padding = 24;
  const maxValue = Math.max(target * 1.2, ...data.map((d) => d.value), 1);
  const slotWidth = (width - padding * 2) / data.length;
  const barWidth = slotWidth - 8;
  const targetY = height - padding - (target / maxValue) * (height - padding * 2);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className={ui.subheading}>{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Target <span className="font-numeric font-bold text-slate-800 dark:text-white">{target}{unit}</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-32 w-full overflow-visible">
        <line
          x1={padding}
          x2={width - padding}
          y1={targetY}
          y2={targetY}
          strokeDasharray="4 3"
          strokeWidth="1"
          stroke="currentColor"
          className="text-slate-300 dark:text-slate-700"
        />
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * (height - padding * 2);
          const x = padding + i * slotWidth + 4;
          const y = height - padding - barHeight;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="3"
              className={colorClass}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex text-xs text-slate-500 dark:text-slate-400 font-numeric">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center font-medium">
            {d.dayLabel}
          </span>
        ))}
      </div>
    </div>
  );
}