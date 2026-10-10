'use client';
import { useState, useEffect, useRef } from 'react';
import { Flame, Pause, Play, Orbit, LayoutGrid, CheckCircle2, AlertTriangle, Trophy } from 'lucide-react';
import { OrbitCenter } from './NutritionalOrbitPanelA';
import MacroRings from './MacroRings';
import FluidFill from './FluidFill';
import fx from './HealthTiles.module.css';
import { activityStatus, intakeStatus, CALORIE_BUFFER_KCAL } from '@/lib/goalState';

// Goal states (lib/goalState.js):
//   calories      intake: on target within +/-50 kcal, over beyond that
//   protein       more is better: reached at 100%, exceeded at +20%
//   carbs, fat    intake: on target within +/-10%, over beyond that
const MACRO_STATUS = {
  protein: (v, t) => activityStatus(v, t),
  carbs: (v, t) => intakeStatus(v, t),
  fat: (v, t) => intakeStatus(v, t),
};
const STATE_ICON = { reached: CheckCircle2, exceeded: Trophy, onTarget: CheckCircle2, over: AlertTriangle };
const CAL_RGB = { progress: '245 158 11', onTarget: '16 185 129', over: '244 63 94' };

export default function NutritionalOrbitPanel({consumed={},targets={}}){
 const [playing,setPlaying]=useState(true);
 const [hovered,setHovered]=useState(null);
 const [off,setOff]=useState(0);
 const [viewMode,setViewMode]=useState('planets');
 const raf=useRef();
 useEffect(()=>{
  let last=performance.now();
  const loop=(now)=>{
   const dt=(now-last)/1000; last=now;
   if(viewMode==='planets' && playing && !hovered) setOff(v=>(v+dt*0.2)%(Math.PI*2));
   raf.current=requestAnimationFrame(loop);
  };
  raf.current=requestAnimationFrame(loop);
  return()=>cancelAnimationFrame(raf.current);
 },[playing,hovered,viewMode]);
 const planets=[
  {k:'protein',n:'Protein',v:consumed.protein||0,t:targets.proteinG||0,bg:'bg-emerald-500',glow:'rgba(16,185,129,.5)',base:0},
  {k:'carbs',n:'Carbs',v:consumed.carbs||0,t:targets.carbsG||0,bg:'bg-blue-500',glow:'rgba(59,130,246,.5)',base:2.09},
  {k:'fat',n:'Fat',v:consumed.fat||0,t:targets.fatG||0,bg:'bg-violet-500',glow:'rgba(139,92,246,.5)',base:4.18},
 ].map(p=>({...p,status:MACRO_STATUS[p.k](p.v,p.t)}));
 const calC=Math.round(consumed.calories||0), calT=Math.round(targets.targetCalories||0);
 const calStatus=intakeStatus(calC,calT,CALORIE_BUFFER_KCAL);
 const calPct=calT>0?Math.min(100,(calC/calT)*100):0;
 const panelFx=calStatus==='over'?fx.over:calStatus==='onTarget'?fx.reached:'';
 return (
  <div style={{'--accent':CAL_RGB[calStatus]}} className={`relative isolate border rounded-2xl transition-shadow ${panelFx} hover:shadow-lg dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] bg-white border-slate-200/90 px-2 py-3 sm:px-3 sm:py-4 shadow-xs flex flex-col h-full min-h-[280px] sm:min-h-[320px]`}>
   {/* Calories eaten, as a liquid level behind the panel */}
   <FluidFill pct={calPct} rgb={CAL_RGB[calStatus]} direction="up" strength={0.9} />
   <div className="flex items-center justify-between px-1 mb-1">
    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-900 dark:text-white"><Flame size={12} className="text-amber-500"/> Nutritional Orbit
     {calStatus!=='progress' && (
      <span key={calStatus} role="status" className={`${fx.badge} ml-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${calStatus==='over'?'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300':'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
       {calStatus==='over'?<AlertTriangle size={10}/>:<CheckCircle2 size={10}/>}
       {calStatus==='over'?`Over by ${(calC-calT).toLocaleString('en-IN')}`:'On target'}
      </span>
     )}
    </span>
    <div className="flex items-center gap-1.5">
     <button type="button" onClick={()=>setViewMode(v=>v==='planets'?'rings':'planets')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition" title={viewMode==='planets'? 'Switch to rings view':'Switch to orbit view'}>
      {viewMode==='planets' ? <><LayoutGrid size={12}/> Rings</> : <><Orbit size={12}/> Orbit</>}
     </button>
     {viewMode==='planets' && (
      <button type="button" onClick={()=>setPlaying(p=>!p)} className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition">{playing?<Pause size={12}/>:<Play size={12}/>}<span className="hidden lg:inline">{playing?'Pause':'Play'}</span></button>
     )}
    </div>
   </div>
   {viewMode==='planets' ? (
    <OrbitCenter consumed={consumed} targets={targets} off={off} hovered={hovered} setHovered={setHovered} planets={planets} />
   ) : (
    <div className="flex flex-1 items-center justify-center py-2 min-h-[200px] sm:min-h-[220px]"><MacroRings consumed={consumed} targets={targets} /></div>
   )}
   <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
    {planets.map(p=>{const pct=p.t>0?Math.min(Math.round((p.v/p.t)*100),100):0; const Ico=STATE_ICON[p.status]; const warn=p.status==='over'; const good=p.status!=='progress'&&!warn; return (<div key={p.k} className="flex flex-col gap-1"><div className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${p.bg}`}/><span className="text-[10px] font-bold text-slate-700 dark:text-white truncate">{p.n}</span><span className={`ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold ${warn?'text-rose-500':good?'text-emerald-500':'text-slate-400'}`}>{Ico&&<Ico key={p.status} size={10} className={fx.badge}/>}{p.t>0?Math.round((p.v/p.t)*100):0}%</span></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${warn?'bg-rose-500':p.bg} ${p.status==='exceeded'?fx.barShimmer:good?fx.barShine:''}`} style={{width:`${pct}%`}}/></div><span className="text-[10px] font-numeric text-slate-500 dark:text-slate-400">{Math.round(p.v)}g / {p.t}g</span></div>);})}
   </div>
  </div>
 );
}