'use client';

import fx from './HealthTiles.module.css';

const AMP = 10; // px height of the wave on the liquid's surface

/**
 * A liquid layer behind a card's content that fills to `pct` (0-100).
 *
 * The wave IS the liquid's surface: the layer's edge is cut into a moving
 * wave by a CSS mask, centred on the progress value. So there is no separate
 * strip sitting on top (which drew a seam line), and the average water level
 * is exactly `pct`: the layer extends half a wave past it, so crests rise
 * above and troughs dip below the true value by the same amount.
 *
 *   direction="up"     fills from the bottom (tall cards: metric tiles, orbit)
 *   direction="right"  fills from the left (wide cards: weight bar, meal rows)
 *
 * The parent must be `relative` and `isolate` so the liquid sits behind the
 * content (z-index -1) but above the card's own background.
 * `rgb` is a space-separated colour triplet, e.g. "14 165 233".
 */
export default function FluidFill({ pct = 0, rgb = '16 185 129', direction = 'up', strength = 1 }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  if (p <= 0) return null;
  const up = direction === 'up';
  const full = p >= 100;
  const a1 = (0.18 * strength).toFixed(3); // deep end
  const a2 = (0.08 * strength).toFixed(3); // surface end
  // Half a wave beyond the value, so the wave's mid-line sits exactly on it.
  const size = full ? '100%' : `calc(${p}% + ${AMP / 2}px)`;
  const layer = (extra, alphaScale) => ({
    [up ? 'height' : 'width']: size,
    '--amp': `${AMP}px`,
    background: up
      ? `linear-gradient(to top, rgb(${rgb} / ${(a1 * alphaScale).toFixed(3)}), rgb(${rgb} / ${(a2 * alphaScale).toFixed(3)}))`
      : `linear-gradient(to right, rgb(${rgb} / ${(a2 * alphaScale).toFixed(3)}), rgb(${rgb} / ${(a1 * alphaScale).toFixed(3)}))`,
    ...extra,
  });

  const base = up ? fx.liquidUp : fx.liquidRight;
  return (
    <div aria-hidden="true" className={fx.fluidClip}>
      {/* back layer: slower, offset wave, fainter (gives the surface depth) */}
      <div className={`${base} ${full ? fx.liquidFull : fx.liquidBack}`} style={layer({}, 0.6)} />
      {/* front layer */}
      <div className={`${base} ${full ? fx.liquidFull : ''}`} style={layer({}, 1)} />
    </div>
  );
}
