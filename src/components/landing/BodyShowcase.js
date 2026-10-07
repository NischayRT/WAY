'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '@/app/landing.module.css';

// three.js only downloads when this card scrolls into view.
const BodyShowcaseCanvas = dynamic(() => import('./BodyShowcaseCanvas'), { ssr: false });

const TYPES = [
  { key: 'SLIM', label: 'Slim' },
  { key: 'LEAN', label: 'Lean' },
  { key: 'MUSCULAR', label: 'Muscular' },
  { key: 'SOFT_BELLY', label: 'Soft belly' },
  { key: 'OBESE', label: 'Heavyset' },
];

export default function BodyShowcase() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [sex, setSex] = useState('female');
  const [index, setIndex] = useState(1);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  // Cycle through the body types until the visitor picks one.
  useEffect(() => {
    if (!auto || !ready) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % TYPES.length), 2600);
    return () => clearInterval(id);
  }, [auto, ready]);

  const onReady = useCallback(() => setReady(true), []);

  const pickType = (i) => {
    setAuto(false);
    setIndex(i);
  };
  const pickSex = (s) => {
    setAuto(false);
    setSex(s);
  };

  return (
    <div ref={ref} className={styles.showcase}>
      <div className={styles.showcaseStage}>
        <svg className={styles.spinBadge} viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <path id="badge-circle" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
          </defs>
          <circle cx="60" cy="60" r="58" />
          <text>
            <textPath href="#badge-circle">SEE YOUR GOAL BODY ✦ IN 3D ✦ </textPath>
          </text>
        </svg>

        {!ready && (
          <div className={styles.showcasePoster} aria-hidden="true">
            <span className={styles.posterBody} />
            <span className={styles.posterLabel}>{inView ? 'Loading 3D…' : '3D preview'}</span>
          </div>
        )}
        {inView && (
          <div className={styles.showcaseCanvas} aria-hidden="true">
            <BodyShowcaseCanvas sex={sex} archetypeKey={TYPES[index].key} onReady={onReady} />
          </div>
        )}

        <span className={styles.showcaseTag} aria-live="polite">
          {TYPES[index].label}
        </span>
      </div>

      <div className={styles.showcaseControls}>
        <div className={styles.segment} role="radiogroup" aria-label="Body model">
          {['female', 'male'].map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sex === s}
              className={sex === s ? styles.segmentOn : undefined}
              onClick={() => pickSex(s)}
            >
              {s === 'female' ? 'Female' : 'Male'}
            </button>
          ))}
        </div>
        <div className={styles.chips} role="radiogroup" aria-label="Body type">
          {TYPES.map((t, i) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={index === i}
              className={index === i ? styles.chipOn : styles.chip}
              onClick={() => pickType(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
