import * as Tone from 'tone';
import type { Project } from '../model/types';
import { ProjectRenderer } from '../engine/ProjectRenderer';
import { STEP, beatsPerBar, secondsPerBeat } from '../sequencer/timing';
import { encodeWav } from './wav';

export interface RenderRange {
  startBar: number;
  endBar: number;
  /** Seconds of reverb/delay tail rendered after the last bar. */
  tail?: number;
}

/**
 * Renders a project offline with the same graph used for live playback.
 * Notes are scheduled directly at absolute audio times (no realtime clock).
 */
export async function renderProject(project: Project, range: RenderRange, sampleRate = 44100): Promise<AudioBuffer> {
  const bpb = beatsPerBar(project);
  const startBeat = range.startBar * bpb;
  const endBeat = range.endBar * bpb;
  const spb = secondsPerBeat(project.bpm);
  const tail = range.tail ?? 2;
  const duration = (endBeat - startBeat) * spb + tail;
  const lead = 0.05;

  const result = await Tone.Offline(async () => {
    const renderer = new ProjectRenderer();
    renderer.sync(project);
    await renderer.ready();
    for (let beat = startBeat; beat < endBeat - 1e-9; beat += STEP) {
      renderer.scheduleStep(project, beat, lead + (beat - startBeat) * spb);
    }
  }, duration + lead, 2, sampleRate);
  return result.get() as AudioBuffer;
}

export async function exportWav(project: Project, range: RenderRange, bitDepth: 16 | 24 = 24): Promise<Blob> {
  const buffer = await renderProject(project, range);
  return new Blob([encodeWav(buffer, bitDepth)], { type: 'audio/wav' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
