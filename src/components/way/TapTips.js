'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from './tokens';

const TAP_SLOP = 10; // px a finger may move and still count as a tap

/**
 * Chart details that work with a mouse and a finger alike.
 *
 * Put `data-tip="..."` on each bar / cell inside (instead of `title`, which
 * phones never show). With a mouse the tip follows hover; with a finger a
 * tap shows it (tap again or anywhere else to hide). A swipe that scrolls
 * the page shows nothing. Keyboard focus shows it too. Clicks still reach
 * the bars, so bars that select a day keep doing that.
 *
 * Renders a `relative` div with the className / style you pass, so it can
 * replace the chart's own container element.
 */
export default function TapTips({ as: Tag = 'div', className = '', style, children, ...rest }) {
  const ref = useRef(null);
  const tipRef = useRef(null);
  const start = useRef(null);
  const [tip, setTip] = useState(null); // { el, text, x, y, pinned }
  const [shift, setShift] = useState(0);

  const at = (target) => {
    const el = target?.closest?.('[data-tip]');
    return el && ref.current?.contains(el) ? el : null;
  };
  const show = (el, pinned) => {
    const box = ref.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setShift(0);
    setTip({ el, text: el.getAttribute('data-tip'), x: r.left + r.width / 2 - box.left, y: r.top - box.top, pinned });
  };

  // Keep the tip inside the chart's width.
  useLayoutEffect(() => {
    if (!tip || !tipRef.current || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    const half = t.width / 2;
    const left = tip.x - half;
    const right = tip.x + half;
    const pad = 4;
    setShift(left < -pad ? -pad - left : right > box.width + pad ? box.width + pad - right : 0);
  }, [tip]);

  // A pinned (tapped) tip closes on a tap elsewhere, Escape or scrolling.
  useEffect(() => {
    if (!tip?.pinned) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target)) return;
      setTip(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', close, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close);
    };
  }, [tip?.pinned]);

  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = at(e.target);
    if (el) {
      if (el !== tip?.el) show(el, false);
    } else if (tip && !tip.pinned) setTip(null);
  };
  const onPointerLeave = (e) => {
    if (e.pointerType === 'mouse' && tip && !tip.pinned) setTip(null);
  };
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    if (e.pointerType === 'mouse' || !start.current) return;
    const moved = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y);
    start.current = null;
    if (moved > TAP_SLOP) return; // a scroll or a drag, not a tap
    const el = at(e.target);
    if (!el) return setTip(null);
    if (tip?.el === el && tip.pinned) setTip(null);
    else show(el, true);
  };
  const onFocus = (e) => {
    const el = at(e.target);
    if (el) show(el, false);
  };
  const onBlur = () => tip && !tip.pinned && setTip(null);

  return (
    <Tag
      ref={ref}
      className={cx('relative', className)}
      style={style}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (start.current = null)}
      onFocus={onFocus}
      onBlur={onBlur}
      {...rest}
    >
      {children}
      {tip?.text ? (
        <span
          ref={tipRef}
          role="tooltip"
          className="pointer-events-none absolute z-30 w-max max-w-[220px] -translate-x-1/2 -translate-y-full whitespace-pre-line rounded-lg border border-way-line2 bg-[#111827] px-2.5 py-1.5 text-center font-mono text-[11px] font-semibold leading-snug text-way-ink shadow-[0_10px_24px_rgba(0,0,0,.45)]"
          style={{ left: tip.x + shift, top: tip.y - 6 }}
        >
          {tip.text}
        </span>
      ) : null}
    </Tag>
  );
}
