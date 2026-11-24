import * as Tone from 'tone';
import type { Project } from '../model/types';
import { ProjectRenderer } from './ProjectRenderer';
import { nextCursor, secondsPerBeat, STEP, loopRangeBeats } from '../sequencer/timing';

interface Anchor {
  time: number;
  beat: number;
}

/**
 * Live audio engine: owns the realtime ProjectRenderer and drives the Tone
 * Transport. The scheduler fires every 16th note (sample-accurate audio time)
 * and reads the *current* project, so edits are heard on the next pass without
 * rebuilding any parts.
 */
export class AudioEngine {
  private renderer: ProjectRenderer | null = null;
  private getProject: () => Project;
  private cursor: number | null = null;
  private startBeat = 0;
  private repeatId: number | null = null;
  private anchors: Anchor[] = [];
  private stopListeners = new Set<() => void>();
  private _playing = false;

  constructor(getProject: () => Project) {
    this.getProject = getProject;
    Tone.getContext().lookAhead = 0.08;
  }

  /** Builds the renderer lazily (Tone creates its AudioContext on first use). */
  private ensure(): ProjectRenderer {
    if (!this.renderer) {
      this.renderer = new ProjectRenderer();
      this.renderer.sync(this.getProject());
    }
    return this.renderer;
  }

  get playing(): boolean {
    return this._playing;
  }

  async unlock(): Promise<void> {
    if (Tone.getContext().state !== 'running') await Tone.start();
    this.ensure();
  }

  sync(project: Project): void {
    if (!this.renderer) return;
    this.renderer.sync(project);
    Tone.getTransport().bpm.value = project.bpm;
  }

  async play(fromBeat?: number): Promise<void> {
    await this.unlock();
    const project = this.getProject();
    const r = this.ensure();
    r.sync(project);
    await r.ready();
    if (this._playing) this.stop(false);
    const transport = Tone.getTransport();
    transport.bpm.value = project.bpm;
    let start = fromBeat ?? this.startBeat;
    if (project.loop.enabled) {
      const { start: ls, end: le } = loopRangeBeats(project);
      if (start < ls || start >= le) start = ls;
    }
    this.startBeat = start;
    this.cursor = start;
    this.anchors = [];
    this._playing = true;
    this.repeatId = transport.scheduleRepeat((time) => this.tick(time), '16n', 0);
    transport.start('+0.03');
  }

  private tick(time: number): void {
    const project = this.getProject();
    if (this.cursor === null) {
      // Song end reached on the previous step.
      Tone.getDraw().schedule(() => this.stop(), time);
      return;
    }
    const beat = this.cursor;
    this.renderer?.scheduleStep(project, beat, time);
    this.anchors.push({ time, beat });
    if (this.anchors.length > 32) this.anchors.shift();
    this.cursor = nextCursor(project, beat);
  }

  stop(notify = true): void {
    const transport = Tone.getTransport();
    transport.stop();
    if (this.repeatId !== null) transport.clear(this.repeatId);
    this.repeatId = null;
    transport.cancel(0);
    this.renderer?.releaseAll();
    this._playing = false;
    this.cursor = null;
    this.anchors = [];
    if (notify) for (const l of this.stopListeners) l();
  }

  onStop(l: () => void): () => void {
    this.stopListeners.add(l);
    return () => this.stopListeners.delete(l);
  }

  /** Sets where playback starts (and jumps there if already playing). */
  seek(beat: number): void {
    this.startBeat = Math.max(0, beat);
    if (this._playing) this.cursor = this.startBeat;
  }

  /** Current musical position in beats, derived from audio time. */
  position(): number {
    if (!this._playing) return this.startBeat;
    const now = Tone.getContext().currentTime;
    const spb = secondsPerBeat(this.getProject().bpm);
    let current: Anchor | undefined;
    for (const a of this.anchors) if (a.time <= now) current = a;
    if (!current) return this.anchors[0]?.beat ?? this.startBeat;
    return current.beat + Math.min(STEP, (now - current.time) / spb);
  }

  // ------------------------------------------------------------ live input

  noteOn(trackId: string, pitch: number, velocity: number): void {
    void this.unlock().then(() => this.renderer?.instrument(trackId)?.noteOn(pitch, velocity));
  }

  noteOff(trackId: string, pitch: number): void {
    this.renderer?.instrument(trackId)?.noteOff(pitch);
  }

  /** One-shot audition (e.g. clicking a piano-roll key or a step). */
  audition(trackId: string, pitch: number, velocity = 0.8, duration = 0.3): void {
    void this.unlock().then(() => this.renderer?.instrument(trackId)?.trigger(pitch, velocity, Tone.now() + 0.01, duration));
  }

  // ---------------------------------------------------------------- meters

  trackLevel(trackId: string): number {
    return this.renderer?.trackLevel(trackId) ?? -Infinity;
  }

  masterLevel(): number {
    return this.renderer?.masterLevel() ?? -Infinity;
  }
}
