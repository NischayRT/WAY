'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { ui } from '@/lib/ui';
import { ArrowRight, Sparkles, Cookie, Pizza, Coffee, IceCream, CupSoda, Sandwich } from 'lucide-react';

// Lightweight, zero-lag CSS/Lucide floating food pattern replacing heavy GLB models
const FLOATING_FOODS = [
  { Icon: Cookie, top: '10%', left: '15%', delay: '0s', duration: '14s', size: 36 },
  { Icon: Pizza, top: '25%', left: '80%', delay: '2s', duration: '18s', size: 42 },
  { Icon: Coffee, top: '65%', left: '10%', delay: '1s', duration: '16s', size: 38 },
  { Icon: IceCream, top: '80%', left: '85%', delay: '3s', duration: '15s', size: 40 },
  { Icon: CupSoda, top: '40%', left: '90%', delay: '4s', duration: '20s', size: 34 },
  { Icon: Sandwich, top: '85%', left: '20%', delay: '1.5s', duration: '17s', size: 44 },
  { Icon: Cookie, top: '45%', left: '5%', delay: '2.5s', duration: '19s', size: 32 },
  { Icon: Pizza, top: '5%', left: '70%', delay: '0.5s', duration: '15s', size: 36 },
];

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden transition-all duration-700 select-none">
      {/* 
        Background screen: Silver to black gradient that transitions/inverts on hover 
        Silver = #cbd5e1 / #94a3b8, Black = #090d16 / #000000
      */}
      <div
        className={`absolute inset-0 transition-all duration-700 ease-in-out ${
          isHovered
            ? 'bg-gradient-to-b from-[#000000] via-[#090d16] to-[#1e293b] scale-105'
            : 'bg-gradient-to-b from-[#f1f5f9] via-[#cbd5e1] to-[#090d16]'
        }`}
      />

      {/* Looping moving icons from bottom to top */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {FLOATING_FOODS.map((item, idx) => {
          const IconComponent = item.Icon;
          return (
            <div
              key={idx}
              className={`absolute opacity-20 transition-colors duration-700 animate-float-up ${
                isHovered ? 'text-slate-400' : 'text-slate-900'
              }`}
              style={{
                top: item.top,
                left: item.left,
                animationDuration: item.duration,
                animationDelay: item.delay,
                animationIterationCount: 'infinite',
                animationTimingFunction: 'linear',
              }}
            >
              <IconComponent size={item.size} strokeWidth={1.8} />
            </div>
          );
        })}
      </div>

      {/* Central Content Card */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative z-10 w-full mx-4 p-8 sm:p-10 rounded-3xl border transition-all duration-500 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center space-y-8 cursor-pointer ${
          isHovered
            ? 'bg-black/90 border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.9)] scale-[1.02]'
            : 'bg-white/80 dark:bg-slate-950/80 border-slate-200/80 dark:border-slate-800 shadow-xl'
        }`}
      >
        {/* Brand Logo: WAY in Instrument Serif with inverse gradient fill matching interaction */}
        <div className="space-y-2">
          <h1
            className={`font-brand text-6xl sm:text-7xl tracking-wide transition-all duration-500 bg-clip-text text-transparent ${
              isHovered
                ? 'bg-gradient-to-r from-slate-100 via-slate-300 to-slate-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                : 'bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500'
            }`}
          >
            WAY
          </h1>
          <p
            className={`text-xs font-semibold uppercase tracking-widest transition-colors duration-500 ${
              isHovered ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Diet &amp; Physique Studio
          </p>
        </div>

        <p
          className={`text-sm transition-colors duration-500 max-w-xs leading-relaxed ${
            isHovered ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          Track authentic Indian meals, analyze body composition, and project your scientific transformation.
        </p>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="group relative inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-semibold text-sm shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Sparkles size={16} className="text-amber-400 dark:text-amber-600 shrink-0" />
          <span>{loading ? 'Connecting...' : 'Enter Studio'}</span>
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 shrink-0" />
        </button>
      </div>

      <style jsx global>{`
        @keyframes floatUp {
          0% {
            transform: translateY(30vh) rotate(0deg);
            opacity: 0;
          }
          20% {
            opacity: 0.25;
          }
          80% {
            opacity: 0.25;
          }
          100% {
            transform: translateY(-70vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation-name: floatUp;
        }
      `}</style>
    </main>
  );
}