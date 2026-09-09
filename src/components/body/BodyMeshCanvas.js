'use client';

export default function BodyMeshCanvas({
  chestCm = 99,
  waistCm = 86,
  hipCm = 93,
  bicepCm = 35,
  bodyFatPct = 15,
  title = 'Silhouette',
  isDream = false,
}) {
  // Safe numerical coercion so coordinates never produce NaN
  const cCm = Number(chestCm) || 99;
  const wCm = Number(waistCm) || 86;
  const hCm = Number(hipCm) || 93;
  const bCm = Number(bicepCm) || 35;
  const bf = Number(bodyFatPct) || 15;

  // Center coordinate and proportional SVG units
  const cx = 110;
  const shoulderW = Math.max(70, (cCm / 100) * 94);
  const chestW = Math.max(55, (cCm / 100) * 78);
  const waistW = Math.max(40, (wCm / 85) * 54 + (bf - 10) * 0.45);
  const hipW = Math.max(48, (hCm / 95) * 62 + (bf - 10) * 0.35);
  const armThick = Math.max(10, (bCm / 35) * 15.5);
  const thighW = hipW / 2 + 3;

  const vTaper = (cCm / Math.max(1, wCm)).toFixed(2);

  // Theme accents
  const strokeColor = isDream ? '#10b981' : '#38bdf8';
  const fillColor = isDream ? 'rgba(16, 185, 129, 0.22)' : 'rgba(56, 189, 248, 0.20)';
  const glow = isDream
    ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]'
    : 'drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]';

  // Muscle definition visibility (abs appear sharper as body fat drops below 14%)
  const showAbs = bf <= 15;

  return (
    <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-xl relative min-h-[380px]">
      {/* Header bar that never overlaps the model */}
      <div className="flex w-full items-center justify-between border-b border-slate-800/80 pb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {title}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-bold font-numeric ${
            isDream ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'
          }`}
        >
          {vTaper}x V-Taper
        </span>
      </div>

      {/* SVG Wireframe Model */}
      <svg
        viewBox="0 0 220 310"
        className={`w-44 h-64 overflow-visible my-auto ${glow} transition-all duration-300`}
      >
        {/* Head */}
        <circle
          cx={cx}
          cy="30"
          r="14"
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.8"
        />

        {/* Neck */}
        <path
          d={`M ${cx - 6} 44 L ${cx + 6} 44 L ${cx + 6} 56 L ${cx - 6} 56 Z`}
          fill={strokeColor}
          opacity="0.5"
        />

        {/* Traps & Shoulders */}
        <path
          d={`M ${cx - 6} 54 L ${cx - shoulderW / 2} 66 L ${cx + shoulderW / 2} 66 L ${cx + 6} 54 Z`}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.2"
        />

        {/* Torso (Chest down to Waist and Pelvis) */}
        <path
          d={`
            M ${cx - shoulderW / 2} 66
            L ${cx + shoulderW / 2} 66
            L ${cx + chestW / 2} 105
            L ${cx + waistW / 2} 155
            L ${cx + hipW / 2} 185
            L ${cx - hipW / 2} 185
            L ${cx - waistW / 2} 155
            L ${cx - chestW / 2} 105
            Z
          `}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="2"
        />

        {/* Chest / Pec Line Details */}
        <path
          d={`M ${cx - chestW / 2 + 4} 98 Q ${cx} 108 ${cx + chestW / 2 - 4} 98`}
          stroke={strokeColor}
          strokeWidth="1.2"
          fill="none"
          opacity="0.7"
        />
        <line
          x1={cx}
          y1="66"
          x2={cx}
          y2="104"
          stroke={strokeColor}
          strokeWidth="1.2"
          opacity="0.5"
        />

        {/* Abdominal Definition (dynamically sharpened if BF is low) */}
        {showAbs && (
          <g opacity={(16 - bf) / 10} stroke={strokeColor} strokeWidth="1">
            <line x1={cx - 10} y1="120" x2={cx + 10} y2="120" />
            <line x1={cx - 9} y1="135" x2={cx + 9} y2="135" />
            <line x1={cx - 8} y1="150" x2={cx + 8} y2="150" />
            <line x1={cx} y1="110" x2={cx} y2="158" />
          </g>
        )}

        {/* Left Arm (Deltoid, Bicep, Forearm) */}
        <path
          d={`
            M ${cx - shoulderW / 2} 66
            Q ${cx - shoulderW / 2 - armThick - 2} 115 ${cx - waistW / 2 - armThick} 175
            L ${cx - waistW / 2 - armThick + 9} 175
            Q ${cx - shoulderW / 2 + 4} 115 ${cx - chestW / 2} 105
            Z
          `}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.6"
        />

        {/* Right Arm */}
        <path
          d={`
            M ${cx + shoulderW / 2} 66
            Q ${cx + shoulderW / 2 + armThick + 2} 115 ${cx + waistW / 2 + armThick} 175
            L ${cx + waistW / 2 + armThick - 9} 175
            Q ${cx + shoulderW / 2 - 4} 115 ${cx + chestW / 2} 105
            Z
          `}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.6"
        />

        {/* Left Leg */}
        <path
          d={`
            M ${cx - hipW / 2} 185
            L ${cx - 3} 198
            L ${cx - thighW + 3} 295
            L ${cx - thighW - 6} 295
            L ${cx - hipW / 2 - 3} 198
            Z
          `}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.6"
        />

        {/* Right Leg */}
        <path
          d={`
            M ${cx + hipW / 2} 185
            L ${cx + 3} 198
            L ${cx + thighW - 3} 295
            L ${cx + thighW + 6} 295
            L ${cx + hipW / 2 + 3} 198
            Z
          `}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.6"
        />
      </svg>

      {/* Real-Time Measurement Pill Badges */}
      <div className="w-full flex items-center justify-around border-t border-slate-800/80 pt-2 font-numeric text-[11px] text-slate-300">
        <span className="font-semibold text-amber-400">{bf}% Fat</span>
        <span className="text-slate-600">·</span>
        <span>{Math.round(wCm / 2.54)}&quot; Waist</span>
        <span className="text-slate-600">·</span>
        <span>{Math.round(hCm / 2.54)}&quot; Hips</span>
      </div>
    </div>
  );
}