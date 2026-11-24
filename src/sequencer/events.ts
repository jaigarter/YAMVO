import type { Project, Track } from '../model/types';
import { swingWarp } from './timing';

export interface NoteEvent {
  trackId: string;
  pitch: number;
  velocity: number;
  /** Offset in beats from the start of the requested window (swing applied). */
  offset: number;
  /** Duration in beats. */
  duration: number;
}

/** Tracks that should be heard given mute/solo state. */
export function audibleTracks(project: Project): Track[] {
  const anySolo = project.tracks.some((t) => t.mixer.solo);
  return project.tracks.filter((t) => !t.mixer.mute && (!anySolo || t.mixer.solo));
}

/**
 * Collects every note whose (unswung) start lies in [from, to) on the song
 * timeline. Clip patterns repeat every `loopLength` within the clip length and
 * notes are clipped at the clip end.
 */
export function collectEvents(project: Project, from: number, to: number, tracks = audibleTracks(project)): NoteEvent[] {
  const out: NoteEvent[] = [];
  const eps = 1e-6;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.start + clip.length;
      if (to <= clip.start || from >= clipEnd) continue;
      const loopLen = Math.max(0.25, clip.loopLength);
      // Pattern repetitions that may intersect the window.
      const firstRep = Math.max(0, Math.floor((from - clip.start) / loopLen) - 1);
      const lastRep = Math.floor((to - clip.start) / loopLen);
      for (let rep = firstRep; rep <= lastRep; rep++) {
        const repStart = clip.start + rep * loopLen;
        for (const n of clip.notes) {
          if (n.start >= loopLen - eps) continue;
          const abs = repStart + n.start;
          if (abs < from - eps || abs >= to - eps) continue;
          if (abs >= clipEnd - eps) continue;
          const end = Math.min(abs + n.duration, clipEnd);
          const swingOn = track.swing && project.swing > 50;
          const s = swingOn ? swingWarp(abs, project.swing) : abs;
          const e = swingOn ? swingWarp(end, project.swing) : end;
          out.push({
            trackId: track.id,
            pitch: n.pitch,
            velocity: n.velocity,
            offset: s - from,
            duration: Math.max(0.02, e - s),
          });
        }
      }
    }
  }
  return out;
}
