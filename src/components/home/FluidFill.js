'use client';

import fx from './HealthTiles.module.css';

/**
 * A liquid layer behind a card's content that fills to `pct` (0-100), with
 * a slowly moving wave on its surface.
 *
 *   direction="up"     fills from the bottom (tall cards: metric tiles, orbit)
 *   direction="right"  fills from the left (wide cards: weight bar, meal rows)
 *
 * The parent must be `relative` and `isolate` (its own stacking context) so
 * the liquid sits behind the content (z-index -1) but above the card's own
 * background. `rgb` is a space-separated colour triplet, e.g. "14 165 233".
 */
export default function FluidFill({ pct = 0, rgb = '16 185 129', direction = 'up', strength = 1 }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const up = direction === 'up';
  const a1 = (0.18 * strength).toFixed(3);
  const a2 = (0.07 * strength).toFixed(3);

  return (
    <div aria-hidden="true" className={fx.fluidClip} style={{ '--fluid': rgb, '--wave-a': up ? a2 : a1 }}>
      <div
        className={up ? fx.fluidUp : fx.fluidRight}
        style={{
          [up ? 'height' : 'width']: `${p}%`,
          background: up
            ? `linear-gradient(to top, rgb(${rgb} / ${a1}), rgb(${rgb} / ${a2}))`
            : `linear-gradient(to right, rgb(${rgb} / ${a2}), rgb(${rgb} / ${a1}))`,
        }}
      >
        {p > 0 && p < 100 && (
          <>
            <span className={up ? fx.waveUp : fx.waveRight} />
            <span className={`${up ? fx.waveUp : fx.waveRight} ${fx.waveSlow}`} style={{ opacity: 0.55 }} />
          </>
        )}
      </div>
    </div>
  );
}
