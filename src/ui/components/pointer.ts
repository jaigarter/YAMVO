import type { PointerEvent as RPointerEvent } from 'react';

/**
 * Tracks a pointer drag from a React pointerdown. `onMove` receives the total
 * offset from the start point. Returns nothing; listeners clean themselves up.
 */
export function startDrag(
  e: RPointerEvent | PointerEvent,
  onMove: (dx: number, dy: number, ev: PointerEvent) => void,
  onUp?: (moved: boolean, ev: PointerEvent) => void,
): void {
  const x0 = e.clientX;
  const y0 = e.clientY;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - x0;
    const dy = ev.clientY - y0;
    if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    moved = true;
    onMove(dx, dy, ev);
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    onUp?.(moved, ev);
  };
  // A touch that turns into a scroll is cancelled by the browser: treat it as
  // a completed drag so taps-to-create do not fire.
  const cancel = (ev: PointerEvent) => {
    moved = true;
    up(ev);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}
