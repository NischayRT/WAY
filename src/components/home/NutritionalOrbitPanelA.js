'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Flame } from 'lucide-react';

// Layout effect in the browser (so the graphic is sized before first paint,
// no flash of an oversized ring), plain effect on the server (no SSR warning).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const BASE_WIDTH = 340; // width the graphics are drawn at when scale = 1
const MIN_SCALE = 0.5;

// Scale the graphic to the width its card ACTUALLY has.
//
// This used to also multiply in a viewport ratio (vw / 640) below 640px,
// which shrank the rings on every phone however much room the card had:
// a 390px phone has ~340px of real space (scale ~1.0) but got 0.61.
// `margin` is total horizontal px kept free around the graphic.
//
// The wrapper's own width is set by its parent (w-full in a flex column),
// not by the graphic inside it, so observing it can't feed back on itself.
function useFitScale(wrapperRef, margin = 0) {
  const [scale, setScale] = useState(1);
  useIsoLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return undefined;
    const compute = () => {
      const width = el.clientWidth;
      if (!width) return;
      setScale(Math.max(MIN_SCALE, Math.min(1, (width - margin) / BASE_WIDTH)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrapperRef, margin]);
  return scale;
}

// ---------- helpers for dotted rings ----------
function DottedRingsView({ consumed, targets }){
  const wrapperRef = useRef(null);
  const scale = useFitScale(wrapperRef, 8);
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
  const calRatio = (targets.targetCalories||0) > 0 ? (consumed.calories||0) / targets.targetCalories : 0;
  const proteinRatio = (targets.proteinG||0) > 0 ? (consumed.protein||0) / targets.proteinG : 0;
  const activeOuterDots = Math.min(Math.round(calRatio * outerDotsCount), outerDotsCount);
  const activeInnerDots = Math.min(Math.round(proteinRatio * innerDotsCount), innerDotsCount);
  const getCalorieColor = (ratio) => {
    if (ratio > 1.05) return { active: 'fill-rose-500', text: 'text-rose-600 dark:text-rose-400', desc: 'Over Target' };
    if (ratio >= 0.9) return { active: 'fill-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', desc: 'On Target' };
    return { active: 'fill-amber-400', text: 'text-amber-500 dark:text-amber-400', desc: 'In Activity' };
  };
  const getProteinColor = (ratio) => {
    if (ratio > 1.2) return { active: 'fill-purple-500', text: 'text-purple-600 dark:text-purple-400', desc: 'Surplus' };
    if (ratio >= 0.95) return { active: 'fill-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', desc: 'Met Goal' };
    return { active: 'fill-teal-400', text: 'text-teal-500 dark:text-teal-400', desc: 'Under Goal' };
  };
  const calColor = getCalorieColor(calRatio);
  const proteinColor = getProteinColor(proteinRatio);
  const calRemaining = Math.max(Math.round((targets.targetCalories||0) - (consumed.calories||0)), 0);
  const proteinRemaining = Math.max(Math.round((targets.proteinG||0) - (consumed.protein||0)), 0);
  const renderTrack = ({ count, radius, activeCount, activeColorClass, dotRadius, direction='ltr', metricType }) => {
    return Array.from({ length: count }, (_, i) => {
      const pct = i / (count - 1);
      const angleDeg = direction === 'ltr' ? startAngle + pct * angleSpan : endAngle - pct * angleSpan;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = cx + radius * Math.cos(angleRad);
      const y = cy + radius * Math.sin(angleRad);
      const isActive = i < activeCount;
      return (
        <circle key={i} cx={x} cy={y} r={hoveredMetric?.type===metricType? dotRadius+1: dotRadius} filter={isActive? 'url(#dot-glow-rings)': undefined} onClick={()=>setHoveredMetric({type: metricType, consumed: metricType==='calories'? consumed.calories: consumed.protein, target: metricType==='calories'? targets.targetCalories: targets.proteinG, unit: metricType==='calories'? 'kcal':'g', label: metricType==='calories'? 'Calories':'Protein', statusText: metricType==='calories'? calColor.desc: proteinColor.desc, statusTextColor: metricType==='calories'? calColor.text: proteinColor.text}) } className={`cursor-pointer transition-all duration-300 ease-out ${isActive? activeColorClass : 'fill-slate-200 dark:fill-slate-800 hover:fill-slate-300 dark:hover:fill-slate-700'}`} />
      );
    });
  };
  const W = 340 * scale;
  const H = 250 * scale;
  return (
    <div ref={wrapperRef} className="relative w-full flex-1 flex items-center justify-center overflow-hidden min-h-[200px] sm:min-h-[220px]">
      <div className="relative flex items-center justify-center shrink-0" style={{ width: W, height: H }}>
        <svg width={270*scale} height={225*scale} viewBox="0 0 260 220" className="overflow-visible select-none" style={{ maxWidth: '100%', maxHeight: '100%' }}>
          <defs><filter id="dot-glow-rings" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
          {renderTrack({ count: outerDotsCount, radius: outerRadius, activeCount: activeOuterDots, activeColorClass: calColor.active, dotRadius: 5.5, direction: 'ltr', metricType: 'calories' })}
          {renderTrack({ count: innerDotsCount, radius: innerRadius, activeCount: activeInnerDots, activeColorClass: proteinColor.active, dotRadius: 4.5, direction: 'rtl', metricType: 'protein' })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6 pointer-events-none">
          {hoveredMetric ? (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{hoveredMetric.label}</span>
              <span className="font-numeric text-2xl font-black text-slate-900 dark:text-white leading-tight">{Math.round(hoveredMetric.consumed)}<span className="text-xs font-semibold text-slate-400 font-sans ml-1">/{hoveredMetric.target}{hoveredMetric.unit}</span></span>
              <span className={`text-[10px] font-bold uppercase mt-1 ${hoveredMetric.statusTextColor}`}>{hoveredMetric.statusText}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 shadow-xs mb-1"><Flame size={14} className={calColor.text} /></div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">REMAINING</span>
              <div className="flex items-baseline gap-1 mt-0.5"><span className="font-numeric text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-none">{calRemaining.toLocaleString('en-IN')}</span><span className="font-numeric text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide">kcal</span></div>
              <div className="mt-1"><span className={`font-numeric text-xs font-bold ${proteinColor.text}`}>{proteinRemaining}g protein left</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrbitCenter({ consumed, targets, off, hovered, setHovered, planets }){
  const wrapperRef = useRef(null);
  const scale = useFitScale(wrapperRef, 32);
  const a = 145 * scale;
  const b = 58 * scale;
  const cx = 175 * scale;
  const cy = 125 * scale;
  const W = 340 * scale;
  const H = 250 * scale;
  const planetSize = 68 * scale;
  const centerSize = 116 * scale;
  const calC=Math.round(consumed.calories||0); const calT=targets.targetCalories||0; const left=Math.max(0,calT-calC); const ratio=calT>0?Math.min(calC/calT,1):0;
  const vbW = 350 * scale;
  const vbH = 250 * scale;
  // Use fixed viewBox 0 0 350 250 and scale ellipse/positions proportionally - keeps stroke consistent
  // Instead we keep viewBox constant and rely on container shrink + scaled coords; SVG stretches to fit W/H via width/height attrs
  return (
    <div ref={wrapperRef} className="relative w-full flex-1 flex items-center justify-center overflow-hidden min-h-[200px] sm:min-h-[220px]">
      <div className="relative flex items-center justify-center shrink-0" style={{ width: W, height: H }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet"><ellipse cx={cx} cy={cy} rx={a} ry={b} fill="none" stroke="#94a3b8" strokeWidth={2*scale} strokeOpacity="0.25" strokeDasharray={`${4*scale} ${6*scale}`}/><ellipse cx={cx} cy={cy} rx={a} ry={b} fill="none" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth={1.8*scale}/></svg>
        <div className="relative z-10 flex flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500 shadow-xl" style={{width: centerSize, height: centerSize}}>
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-0.5" style={{fontSize: Math.max(8, 9*scale)}}><Flame size={10*scale} className="text-amber-500"/> Remaining</span>
          <span className="font-numeric font-black tracking-tight text-slate-900 dark:text-white leading-none mt-1" style={{fontSize: 20*scale}}>{left.toLocaleString('en-IN')}</span>
          <span className="font-numeric font-semibold text-slate-400 mt-0.5" style={{fontSize: 10*scale}}>/ {calT.toLocaleString('en-IN')} kcal</span>
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox={`0 0 ${centerSize} ${centerSize}`}><circle cx={centerSize/2} cy={centerSize/2} r={centerSize/2 - 5} fill="none" stroke="currentColor" className="text-amber-100 dark:text-slate-800" strokeWidth={2.5*scale}/><circle cx={centerSize/2} cy={centerSize/2} r={centerSize/2 - 5} fill="none" stroke="#f59e0b" strokeWidth={2.5*scale} strokeLinecap="round" strokeDasharray={`${2*Math.PI*(centerSize/2 -5)}`} strokeDashoffset={`${2*Math.PI*(centerSize/2 -5)*(1-ratio)}`} className="transition-all duration-700"/></svg>
        </div>
        {planets.map(p=>{
          const ang=p.base+off; const x=cx+a*Math.cos(ang); const y=cy+b*Math.sin(ang); const depth=(Math.sin(ang)+1)/2; const sc=0.88+depth*0.22;
          const r=p.t>0?Math.min(p.v/p.t,1):0; const leftG=Math.max(0,Math.round((p.t-p.v)*10)/10);
          return (
            <div key={p.k} onMouseEnter={()=>setHovered(p)} onMouseLeave={()=>setHovered(null)} className="absolute cursor-pointer" style={{left: `${x}px`, top: `${y}px`, transform: `translate(-50%,-50%) scale(${sc})`, zIndex: Math.round(depth*30)}}>
              <div className={`relative flex flex-col items-center justify-center rounded-full text-white font-numeric shadow-lg ${p.bg}`} style={{width: planetSize, height: planetSize, boxShadow: `0 0 ${20*scale}px ${p.glow}`}}>
                <span className="font-black leading-none" style={{fontSize: 12*scale}}>{Math.round(p.v)}g</span>
                <span className="font-bold uppercase tracking-wider" style={{fontSize: 8*scale}}>{p.n}</span>
                <span className="font-medium opacity-95" style={{fontSize: 7*scale}}>{leftG}g left</span>
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox={`0 0 ${planetSize} ${planetSize}`}><circle cx={planetSize/2} cy={planetSize/2} r={planetSize/2 - 4} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2*scale}/><circle cx={planetSize/2} cy={planetSize/2} r={planetSize/2 - 4} fill="none" stroke="#fff" strokeWidth={2.5*scale} strokeDasharray={2*Math.PI*(planetSize/2 -4)} strokeDashoffset={2*Math.PI*(planetSize/2 -4)*(1-r)} strokeLinecap="round"/></svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { DottedRingsView as RingsView };
