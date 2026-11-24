import { useEffect } from 'react';
import { engine } from '../../engine';

/**
 * One shared requestAnimationFrame loop for everything that moves with the
 * audio (playheads, meters, step highlights). Subscribers write to the DOM
 * directly through refs, so React does not re-render 60 times per second.
 */
type FrameFn = (beat: number, playing: boolean) => void;
const subscribers = new Set<FrameFn>();
let running = false;

function loop() {
  const playing = engine.playing;
  const beat = engine.position();
  for (const fn of subscribers) fn(beat, playing);
  if (subscribers.size) requestAnimationFrame(loop);
  else running = false;
}

export function useFrame(fn: FrameFn): void {
  useEffect(() => {
    subscribers.add(fn);
    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
    return () => {
      subscribers.delete(fn);
    };
  }, [fn]);
}

/** dBFS → 0..1 meter height. */
export function meterHeight(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 60) / 63));
}
