import type { PitchClass, ScaleName } from './types';

export const PITCH_CLASSES: PitchClass[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES: Record<ScaleName, { label: string; intervals: number[] }> = {
  minor: { label: 'Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  major: { label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian: { label: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { label: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  mixolydian: { label: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  harmonicMinor: { label: 'Harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  minorPentatonic: { label: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
};

export function pitchClassIndex(pc: PitchClass): number {
  return PITCH_CLASSES.indexOf(pc);
}

export function noteName(midi: number): string {
  const pc = PITCH_CLASSES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${pc}${octave}`;
}

export function isInScale(midi: number, root: PitchClass, scale: ScaleName): boolean {
  const rel = (((midi - pitchClassIndex(root)) % 12) + 12) % 12;
  return SCALES[scale].intervals.includes(rel);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export type ChordQuality = 'triad' | 'seventh' | 'ninth' | 'minor9-house' | 'stab';

/**
 * Builds a diatonic chord on the given scale degree (0-based) of the key.
 * Returns MIDI notes starting at the given octave.
 */
export function diatonicChord(
  root: PitchClass,
  scale: ScaleName,
  degree: number,
  quality: ChordQuality,
  octave = 4,
): number[] {
  const intervals = SCALES[scale].intervals;
  const base = (octave + 1) * 12 + pitchClassIndex(root);
  const n = intervals.length;
  const step = (i: number) => {
    const idx = degree + i;
    return base + intervals[((idx % n) + n) % n] + 12 * Math.floor(idx / n);
  };
  switch (quality) {
    case 'triad':
      return [step(0), step(2), step(4)];
    case 'seventh':
      return [step(0), step(2), step(4), step(6)];
    case 'ninth':
      return [step(0), step(2), step(4), step(6), step(8)];
    case 'minor9-house':
      // Classic house voicing: root, 7th, 9th, 3rd(+8), 5th(+8) — open and airy.
      return [step(0), step(6), step(8), step(2) + 12, step(4) + 12].sort((a, b) => a - b);
    case 'stab':
      return [step(0), step(2), step(4), step(0) + 12];
  }
}

/** Snap a beat position down to the given grid. */
export function snap(beats: number, grid: number): number {
  return Math.round(beats / grid) * grid;
}

export function snapFloor(beats: number, grid: number): number {
  return Math.floor(beats / grid + 1e-6) * grid;
}
