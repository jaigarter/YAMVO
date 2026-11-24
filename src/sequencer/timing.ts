import type { Project } from '../model/types';

export const STEP = 0.25; // a 16th note in beats

export function beatsPerBar(project: Pick<Project, 'timeSignature'>): number {
  const [num, den] = project.timeSignature;
  return num * (4 / den);
}

/**
 * MPC-style swing as a piecewise-linear time warp over each 8th-note pair.
 *
 * With swing s (50..75 %), the first 16th of every 8th note is stretched to s %
 * of the 8th and the second 16th is compressed into the remainder. Straight 8ths
 * are untouched; off-beat 16ths are delayed by (s - 50)/100 * 0.5 beats. Notes
 * between grid lines are warped proportionally, so the groove stays coherent.
 */
export function swingWarp(beat: number, swingPct: number): number {
  const s = Math.min(75, Math.max(50, swingPct)) / 100;
  if (s === 0.5) return beat;
  const pair = 0.5;
  const base = Math.floor(beat / pair + 1e-9) * pair;
  const local = beat - base; // 0..0.5
  const split = s * pair;
  const warped = local < 0.25 ? (local / 0.25) * split : split + ((local - 0.25) / 0.25) * (pair - split);
  return base + warped;
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

export function songLengthBeats(project: Project): number {
  return project.lengthBars * beatsPerBar(project);
}

export function loopRangeBeats(project: Project): { start: number; end: number } {
  const bpb = beatsPerBar(project);
  return { start: project.loop.startBar * bpb, end: project.loop.endBar * bpb };
}

/**
 * Advances the song cursor by one step, honouring the loop region and the song
 * end. Returns null when playback should stop.
 */
export function nextCursor(project: Project, cursor: number): number | null {
  const next = cursor + STEP;
  if (project.loop.enabled) {
    const { start, end } = loopRangeBeats(project);
    if (end > start && next >= end - 1e-9 && cursor < end) return start;
  }
  if (next >= songLengthBeats(project) - 1e-9) {
    return project.loop.enabled ? loopRangeBeats(project).start : null;
  }
  return next;
}
