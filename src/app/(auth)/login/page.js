'use client';

import { createClient } from '@/lib/supabaseClient';
import { Soup, UtensilsCrossed, Coffee, Wheat, Flame, Leaf, CookingPot, Cookie } from 'lucide-react';

const LANE_ICONS = [Soup, Wheat, Coffee, Flame, Leaf, UtensilsCrossed, CookingPot, Cookie];

// Softer, atmospheric tones to prevent background distraction
const TONES = ['rgba(255, 255, 255, 0.4)', 'rgba(226, 232, 240, 0.5)', 'rgba(203, 213, 225, 0.45)', 'rgba(248, 250, 252, 0.55)'];

function IconLane({ icons, duration, reverse }) {
  // Triplicated sequence ensures seamless, infinite loop scrolling without gaps
  const sequence = [...icons, ...icons, ...icons];
  return (
    <div className="relative h-full w-16 sm:w-24 overflow-hidden">
      <div
        className="lane-track flex flex-col items-center gap-20 sm:gap-24"
        style={{
          animationDuration: `${duration}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {sequence.map((Icon, i) => (
          <div 
            key={i} 
            className="transition-transform duration-700 hover:scale-125"
            style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.15))' }}
          >
            <Icon
              size={42}
              strokeWidth={1.5}
              style={{ color: TONES[i % TONES.length] }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const lanes = [
    { icons: [LANE_ICONS[0], LANE_ICONS[3], LANE_ICONS[6]], duration: 24, reverse: false },
    { icons: [LANE_ICONS[1], LANE_ICONS[4], LANE_ICONS[7]], duration: 30, reverse: true },
    { icons: [LANE_ICONS[2], LANE_ICONS[5], LANE_ICONS[0]], duration: 22, reverse: false },
    { icons: [LANE_ICONS[5], LANE_ICONS[1], LANE_ICONS[3]], duration: 28, reverse: true },
    { icons: [LANE_ICONS[6], LANE_ICONS[2], LANE_ICONS[4]], duration: 26, reverse: false },
    { icons: [LANE_ICONS[7], LANE_ICONS[0], LANE_ICONS[5]], duration: 29, reverse: true },
  ];

  return (
    <main className="hero relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Background gradient layer: Silver top fading down to deep black */}
      <div className="hero-bg absolute inset-0 z-0" />

      {/* Atmospheric blurred food-icon lanes layer (Lower opacity + blur for pristine readability) */}
      <div className="absolute inset-0 flex items-center justify-between px-2 sm:px-6 md:px-16 pointer-events-none z-10 opacity-60 blur-[0.5px]">
        {lanes.map((lane, i) => (
          <IconLane key={i} {...lane} />
        ))}
      </div>

      {/* Subtle radial vignette overlay behind content box to guarantee absolute text clarity */}
      <div className="absolute inset-0 z-15 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.6)_0%,transparent_70%)]" />

      {/* Content wrapper */}
      <div className="relative z-20 w-full max-w-md px-6 py-10 text-center space-y-8 flex flex-col items-center">
        
        {/* Inverse text container utilizing mix-blend-mode difference for optimal adaptive contrast */}
        <div className="text-inverse-wrapper space-y-2">
          <h2 className="font-semibold text-xs tracking-widest uppercase mb-1 opacity-90">
            WELCOME TO
          </h2>
          
          <h1 className="logo-text font-brand text-8xl sm:text-9xl pt-1 pb-2 tracking-normal leading-none select-none">
            WAY
          </h1>
          
          <p className="text-sm font-medium tracking-wide opacity-90">
            Track meals, the Indian way.
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="cta-btn inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/30 backdrop-blur-2xl px-8 py-4 text-sm font-semibold text-white shadow-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer w-full"
        >
          Continue with Google
        </button>
      </div>

      <style jsx>{`
        .hero-bg {
          background: linear-gradient(#7db9ff 0%, #335789 45%, #101215 70%, #000 100%) 0 0 / 100% 180%;
          background-size: 100% 180%;
          background-position: 0% 0%;
          transition: background-position 900ms cubic-bezier(0.16, 1, 0.3, 1), transform 800ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hero:has(.cta-btn:hover) .hero-bg {
          background-position: 0% 100%;
          transform: scale(1.05);
        }

        .text-inverse-wrapper {
          color: #ffffff;
          mix-blend-mode: difference;
        }

        .logo-text {
          background: linear-gradient(180deg, #ffffff 0%, #aec8ec 100%);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          transition: background-position 900ms cubic-bezier(0.16, 1, 0.3, 1);
          mix-blend-mode: normal;
        }

        .hero:has(.cta-btn:hover) .logo-text {
          background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 50%, #475569 100%);
          background-size: 100% 200%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: logoSilverRise 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes logoSilverRise {
          from { background-position: 0% 100%; }
          to { background-position: 0% 0%; }
        }

        .lane-track {
          display: flex;
          flex-direction: column;
          animation-name: laneScroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }

        @keyframes laneScroll {
          0% {
            transform: translateY(0%);
          }
          100% {
            transform: translateY(-33.333%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lane-track {
            animation: none;
          }
          .hero-bg {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}