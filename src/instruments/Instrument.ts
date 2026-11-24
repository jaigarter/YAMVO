import type * as Tone from 'tone';
import type { InstrumentConfig } from '../model/types';

/**
 * Common interface for every playable instrument. Times are AudioContext
 * seconds; `undefined` means "now".
 */
export interface Instrument {
  readonly output: Tone.ToneAudioNode;
  /** Schedules a full note (sequencer). */
  trigger(pitch: number, velocity: number, time: number, duration: number): void;
  /** Live playing (MIDI / computer keyboard). */
  noteOn(pitch: number, velocity: number, time?: number): void;
  noteOff(pitch: number, time?: number): void;
  /** Applies a new config. Returns false if the instrument must be rebuilt. */
  update(config: InstrumentConfig): boolean;
  releaseAll(time?: number): void;
  /** Resolves when all buffers needed for playback are loaded. */
  ready(): Promise<void>;
  dispose(): void;
}

export function num(params: InstrumentConfig['params'], key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function str<T extends string>(params: InstrumentConfig['params'], key: string, fallback: T): T {
  const v = params[key];
  return (typeof v === 'string' ? v : fallback) as T;
}

export function bool(params: InstrumentConfig['params'], key: string, fallback: boolean): boolean {
  const v = params[key];
  return typeof v === 'boolean' ? v : fallback;
}

/** Perceptual velocity curve. */
export function velocityGain(v: number): number {
  return Math.pow(Math.min(1, Math.max(0, v)), 1.4);
}
