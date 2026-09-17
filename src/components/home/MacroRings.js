'use client';
​
import { useState, useEffect, useRef } from 'react';
import { Flame, BicepsFlexed, Wheat, Cuboid, Pause, Play } from 'lucide-react';
​
import WeekMacroChart from '@/components/home/WeekMacroChart';
​
function MobileDottedGauge({ calorieConsumed, calorieTarget, proteinConsumed, proteinTarget }) {
  const [hoveredMetric, setHoveredMetric] = useState(null);
  const outerDotsCount = 28;
  const innerDotsCount = 22;
  const cx = 130;
  const cy = 125;
  const outerRadius = 100;
  const innerRadius = 80;
  const startAngle = 145;
  const endAngle = 395;
  const angleSpan = endAngle - startAngle;
​
  const calRatio = calorieTarget > 0 ? calorieConsumed / calorieTarget : 0;
  const proteinRatio = proteinTarget > 0 ? proteinConsumed / proteinTarget : 0;
​
  const activeOuterDots = Math.min(Math.round(calRatio * outerDotsCount), outerDotsCount);
  const activeInnerDots = Math.min(Math.round(proteinRatio * innerDotsCount), innerDotsCount);
​
  const getCalorieColor = (ratio) => {
    if (ratio > 1.05) return { active: 'fill-rose-500', text: 'text-rose-600 dark:text-rose-400', desc: 'Over Target' };
    if (ratio >= 0.9) return { active: 'fill-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', desc: 'On Target' };
    return { active: 'fill-amber-400', text: 'text-amber-500 dark:text-amber-400', desc: 'In Progress' };
  };
​
  const getProteinColor = (ratio) => {
    if (ratio > 1.2) return { active: 'fill-purple-500', text: 'text-purple-600 dark:text-purple-400', desc: 'Surplus' };
    if (ratio >= 0.95) return { active: 'fill-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', desc: 'Met Goal' };
    return { active: 'fill-teal-400', text: 'text-teal-500 dark:text-teal-400', desc: 'Under Goal' };
  };
​
  const calColor = getCalorieColor(calRatio);
  const proteinColor = getProteinColor(proteinRatio);
​
  const calRemaining = Math.max(Math.round(calorieTarget - calorieConsumed), 0);
  const proteinRemaining = Math.max(Math.round(proteinTarget - proteinConsumed), 0);
​
  const renderTrack = ({ count, radius, activeCount, activeColorClass, dotRadius, direction = 'ltr', metricType }) => {
    return Array.from({ length: count }, (_, i) => {
      const pct = i / (count - 1);
      const angleDeg = direction === 'ltr' ? startAngle + pct * angleSpan : endAngle - pct * angleSpan;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = cx + radius * Math.cos(angleRad);
      const y = cy + radius * Math.sin(angleRad);
      const isActive = i < activeCount;
​
      return (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={hoveredMetric?.type === metricType ? dotRadius + 1 : dotRadius}
          filter={isActive ? 'url(#dot-glow-mobile)' : undefined}
          onClick={() =>
            setHoveredMetric({
              type: metricType,
              consumed: metricType === 'calories' ? calorieConsumed : proteinConsumed,
              target: metricType === 'calories' ? calorieTarget : proteinTarget,
              unit: metricType === 'calories' ? 'kcal' : 'g',
              label: metricType === 'calories' ? 'Calories' : 'Protein',
              statusText: metricType === 'calories' ? calColor.desc : proteinColor.desc,
              statusTextColor: metricType === 'calories' ? calColor.text : proteinColor.text,
            })
          }
          className={`cursor-pointer transition-all duration-300 ease-out ${
            isActive ? activeColorClass : 'fill-slate-200 dark:fill-slate-800 hover:fill-slate-300 dark:hover:fill-slate-700'
          }`}
        />
      );
    });
  };
​
  return (
    <div className="relative flex flex-col items-center justify-center pt-2">
      <svg width={270} height={225} viewBox="0 0 260 220" className="overflow-visible select-none">
        <defs>
          <filter id="dot-glow-mobile" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {renderTrack({
          count: outerDotsCount,
          radius: outerRadius,
          activeCount: activeOuterDots,
          activeColorClass: calColor.active,
          dotRadius: 5.5,
          direction: 'ltr',
          metricType: 'calories',
        })}
        {renderTrack({
          count: innerDotsCount,
          radius: innerRadius,
          activeCount: activeInnerDots,
          activeColorClass: proteinColor.active,
          dotRadius: 4.5,
          direction: 'rtl',
          metricType: 'protein',
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-6 pointer-events-none">
        {hoveredMetric ? (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {hoveredMetric.label}
            </span>
            <span className="font-numeric text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {Math.round(hoveredMetric.consumed)}
              <span className="text-xs font-semibold text-slate-400 font-sans ml-1">
                /{hoveredMetric.target}{hoveredMetric.unit}
              </span>
            </span>
            <span className={`text-[10px] font-bold uppercase mt-1 ${hoveredMetric.statusTextColor}`}>
              {hoveredMetric.statusText}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 shadow-xs mb-1 neon-amber">
              <Flame size={14} className={calColor.text} />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              REMAINING
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-numeric text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                {calRemaining.toLocaleString('en-IN')}
              </span>
              <span className="font-numeric text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide">
                kcal
              </span>
            </div>
            <div className="mt-1">
              <span className={`font-numeric text-xs font-bold ${proteinColor.text}`}>
                {proteinRemaining}g protein left
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center text-[11px] font-medium text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${calColor.active}`} />
          <span>Calories</span>
        </span>
      </div>
    </div>
  );
}
​
/* =========================================================================
   2. MAIN COMPONENT
   ========================================================================= */
​
export default function MacroRings({ consumed, targets, days = [], weekBreakdowns = {} }) {
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [hoveredPlanet, setHoveredPlanet] = useState(null);
  const [angleOffset, setAngleOffset] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const animFrameRef = useRef();
const [isWide, setIsWide] = useState(false);
​
useEffect(() => {
  const mq = window.matchMedia('(min-width: 1080px)');
  setIsWide(mq.matches);
  const handler = (e) => setIsWide(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, []);
  // Guard against running orbit calculations & rendering on mobile viewports
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mediaQuery.matches);
​
    const handler = (e) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
​
  const planets = [
    {
      key: 'protein',
      name: 'Protein',
      value: consumed.protein,
      target: targets.proteinG,
      unit: 'g',
      colorBg: 'bg-emerald-500',
      glowColor: 'rgba(16, 185, 129, 0.55)',
      ringBorder: 'border-emerald-300 dark:border-emerald-500',
      textColor: 'text-emerald-700 dark:text-emerald-400',
      barColor: 'bg-emerald-500',
      tagBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      neonClass: 'neon-emerald',
      Icon: BicepsFlexed,
      baseAngle: 0,
    },
    {
      key: 'carbs',
      name: 'Carbs',
      value: consumed.carbs,
      target: targets.carbsG,
      unit: 'g',
      colorBg: 'bg-blue-500',
      glowColor: 'rgba(59, 130, 246, 0.55)',
      ringBorder: 'border-blue-300 dark:border-blue-500',
      textColor: 'text-blue-700 dark:text-blue-400',
      barColor: 'bg-blue-500',
      tagBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      neonClass: 'neon-blue',
      Icon: Wheat,
      baseAngle: (2 * Math.PI) / 3,
    },
    {
      key: 'fat',
      name: 'Fat',
      value: consumed.fat,
      target: targets.fatG,
      unit: 'g',
      colorBg: 'bg-purple-500',
      glowColor: 'rgba(168, 85, 247, 0.55)',
      ringBorder: 'border-purple-300 dark:border-purple-500',
      textColor: 'text-purple-700 dark:text-purple-400',
      barColor: 'bg-purple-500',
      tagBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      neonClass: 'neon-purple',
      Icon: Cuboid,
      baseAngle: (4 * Math.PI) / 3,
    },
  ];
​
  useEffect(() => {
    if (!isDesktop) return; // Completely pause loop when off desktop
​
    let lastTime = performance.now();
    const loop = (now) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      if (isPlaying && !hoveredPlanet) {
        setAngleOffset((prev) => (prev + (delta * Math.PI) / 16) % (2 * Math.PI));
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, hoveredPlanet, isDesktop]);
​
  const calConsumed = Math.round(consumed.calories);
  const calTarget = targets.targetCalories;
  const calLeft = Math.max(0, calTarget - calConsumed);
  const calRatio = calTarget > 0 ? Math.min(calConsumed / calTarget, 1) : 0;
​
  const a = 145;
  const b = 58;
  const centerX = 175;
  const centerY = 125;
​
  return (
    <div className="w-full flex flex-col items-center justify-center select-none overflow-hidden">
      {/* --- A. MOBILE VIEW (< 768px): Dotted Radial Gauge + Static Cards Only --- */}
      <div className="w-full flex flex-col md:hidden space-y-4">
        <MobileDottedGauge
          calorieConsumed={consumed.calories}
          calorieTarget={targets.targetCalories}
          proteinConsumed={consumed.protein}
          proteinTarget={targets.proteinG}
        />
        <div className="grid grid-cols-3 gap-2 font-numeric text-center pt-2 border-t border-slate-100 dark:border-slate-800">
          {planets.map((p) => {
            const pct = p.target > 0 ? Math.min(Math.round((p.value / p.target) * 100), 100) : 0;
            const leftG = Math.max(0, Math.round((p.target - p.value) * 10) / 10);
            return (
              <div
                key={p.key}
                className="flex flex-col justify-between bg-slate-50/80 dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs text-left"
              >
                <div className="flex items-center justify-between mb-1.5 min-w-0">
                  <div className="flex items-center gap-1 truncate">
                    <p.Icon size={12} className={p.textColor} />
                    <span className="text-[11px] font-bold text-slate-800 dark:text-white truncate">{p.name}</span>
                  </div>
                  <span className="hidden min-[360px]:inline text-[10px] font-bold text-slate-400 shrink-0 ml-1">
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800 mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${p.barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-col text-[10px] leading-tight font-numeric">
                  <span className="text-slate-400">
                    {Math.round(p.value)}g <span className="font-sans text-[9px]">eaten</span>
                  </span>
                  <span className="font-bold text-slate-700 dark:text-white mt-0.5">
                    {leftG}g <span className="font-sans font-normal text-slate-400 text-[9px]">left</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
​
      {/* --- B. DESKTOP VIEW (>= 768px): Only mounted when isDesktop is true --- */}
      {isDesktop && (
        <div className="w-full flex flex-row items-center justify-between gap-4 p-1">
          <div className="w-[350px] shrink-0 flex flex-col items-center justify-center relative">
            <div className="w-full flex items-center justify-between px-2 mb-1">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Flame size={14} className="text-amber-500" /> Nutritional Orbit
              </span>
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition"
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                <span className="text-[10px]">{isPlaying ? 'Pause' : 'Resume'}</span>
              </button>
            </div>
            <div className="relative w-[340px] h-[250px] flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 350 250">
                <ellipse
                  cx={centerX}
                  cy={centerY}
                  rx={a}
                  ry={b}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeOpacity="0.25"
                  strokeDasharray="4 6"
                />
                <ellipse
                  cx={centerX}
                  cy={centerY}
                  rx={a}
                  ry={b}
                  fill="none"
                  className="stroke-slate-300 dark:stroke-slate-700"
                  strokeWidth="1.8"
                />
              </svg>
              <div
                className="relative z-10 flex flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500 shadow-xl transition-all duration-300 neon-amber dark:neon-box-amber"
                style={{
                  width: '116px',
                  height: '116px',
                }}
              >
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                  <Flame size={10} className="text-amber-500" /> Remaining
                </span>
                <span className="font-numeric text-xl font-black tracking-tight text-slate-900 dark:text-white leading-none mt-1">
                  {calLeft.toLocaleString('en-IN')}
                </span>
                <span className="font-numeric text-[10px] font-semibold text-slate-400 mt-0.5">
                  / {calTarget.toLocaleString('en-IN')} kcal
                </span>
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 116 116">
                  <circle cx="58" cy="58" r="53" fill="none" stroke="currentColor" className="text-amber-100 dark:text-slate-800" strokeWidth="2.5" />
                  <circle
                    cx="58"
                    cy="58"
                    r="53"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray={2 * Math.PI * 53}
                    strokeDashoffset={2 * Math.PI * 53 * (1 - calRatio)}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
              </div>
              {planets.map((p) => {
                const currentAngle = p.baseAngle + angleOffset;
                const rawX = centerX + a * Math.cos(currentAngle);
                const rawY = centerY + b * Math.sin(currentAngle);
                const depth = (Math.sin(currentAngle) + 1) / 2;
                const rawScale = 0.88 + depth * 0.22;
                const zIndex = Math.round(depth * 30);
                const rawOpacity = 0.88 + depth * 0.12;
​
                const x = Math.round(rawX * 100) / 100;
                const y = Math.round(rawY * 100) / 100;
                const scale = Math.round(rawScale * 100) / 100;
                const opacity = Math.round(rawOpacity * 100) / 100;
​
                const ratio = p.target > 0 ? Math.min(p.value / p.target, 1) : 0;
                const leftG = Math.max(0, Math.round((p.target - p.value) * 10) / 10);
                const isHovered = hoveredPlanet?.key === p.key;
​
                return (
                  <div
                    key={p.key}
                    suppressHydrationWarning
                    onMouseEnter={() => setHoveredPlanet(p)}
                    onMouseLeave={() => setHoveredPlanet(null)}
                    className={`absolute cursor-pointer transition-transform duration-75 ${p.neonClass}`}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: `translate(-50%, -50%) scale(${scale})`,
                      zIndex,
                      opacity,
                    }}
                  >
                    <div
                      className={`relative flex flex-col items-center justify-center rounded-full text-white font-numeric shadow-lg transition-all duration-200 ${
                        p.colorBg
                      } ${isHovered ? 'ring-4 ring-offset-2 dark:ring-offset-slate-900 ' + p.ringBorder : ''}`}
                      style={{
                        width: '68px',
                        height: '68px',
                        boxShadow: `0 0 20px ${p.glowColor}`,
                      }}
                    >
                      <div className="flex items-center gap-0.5 leading-none">
                        <span className="text-xs font-black">{Math.round(p.value)}</span>
                        <span className="text-[8px] font-medium opacity-90">{p.unit}</span>
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">
                        {p.name}
                      </span>
                      <span className="text-[7px] font-medium opacity-95 leading-tight">
                        {leftG}g left
                      </span>
                      <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 68 68">
                        <circle cx="34" cy="34" r="30" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                        <circle
                          cx="34"
                          cy="34"
                          r="30"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          strokeDasharray={2 * Math.PI * 30}
                          strokeDashoffset={2 * Math.PI * 30 * (1 - ratio)}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex-1 w-full flex flex-row gap-3 min-w-0">
            <div className={`flex flex-col gap-3 min-w-0 ${isWide ? 'w-[280px] shrink-0' : 'flex-1'}`}>
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white">
                  Macronutrient Targets
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
              {planets.map((p) => {
                const pct = p.target > 0 ? Math.min(Math.round((p.value / p.target) * 100), 100) : 0;
                const leftG = Math.max(0, Math.round((p.target - p.value) * 10) / 10);
                const isHovered = hoveredPlanet?.key === p.key;
                return (
                  <div
                    key={p.key}
                    onMouseEnter={() => setHoveredPlanet(p)}
                    onMouseLeave={() => setHoveredPlanet(null)}
                    className={`rounded-2xl border p-2 transition-all duration-200 cursor-pointer ${
                      isHovered
                        ? 'border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/80 shadow-md scale-[1.01]'
                        : 'border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`p-1.5 rounded-xl ${p.tagBg} border`}>
                          <p.Icon size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{p.name}</h4>
                          
                        </div>
                      </div>
                      <div className="text-right font-numeric">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {Math.round(p.value)}
                          <span className="text-[10px] font-normal text-slate-400 font-sans ml-0.5">/ {p.target}g</span>
                        </span>
                        <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {pct >= 100 ? 'Met Goal' : `${leftG}g left`}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${p.barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
            {isWide && (
              <div className="flex-1 min-w-0">
                <WeekMacroChart
                  days={days}
                  weekBreakdowns={weekBreakdowns}
                  targetCalories={targets.targetCalories}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}