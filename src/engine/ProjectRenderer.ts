import * as Tone from 'tone';
import type { MasterSettings, Project, Track } from '../model/types';
import type { Instrument } from '../instruments/Instrument';
import { createInstrument } from '../instruments/factory';
import { TrackChain } from './TrackChain';
import { audibleTracks, collectEvents } from '../sequencer/events';
import { STEP, secondsPerBeat } from '../sequencer/timing';

const KICK_NOTE = 36;

const NOTE_VALUE_BEATS: Record<MasterSettings['delay']['time'], number> = {
  '16n': 0.25,
  '8n': 0.5,
  '8n.': 0.75,
  '8t': 1 / 3,
  '4n': 1,
};

interface TrackNodes {
  chain: TrackChain;
  instrument: Instrument;
  type: string;
  configKey: string;
}

/**
 * Builds and maintains the audio graph for a project in the *current* Tone
 * context. The same class drives live playback and offline WAV export, so what
 * you hear is what you export.
 */
export class ProjectRenderer {
  private readonly masterIn = new Tone.Gain(1);
  private readonly glue = new Tone.Compressor({ threshold: -14, ratio: 2, attack: 0.01, release: 0.2, knee: 10 });
  private readonly limiter = new Tone.Limiter(-0.8);
  private readonly masterVol = new Tone.Volume(0);
  readonly masterMeter = new Tone.Meter({ smoothing: 0.6 });
  private readonly reverbIn = new Tone.Filter({ type: 'highpass', frequency: 280 });
  private readonly reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: 1 });
  private readonly delayIn = new Tone.Filter({ type: 'highpass', frequency: 320 });
  private readonly delay = new Tone.FeedbackDelay({ delayTime: 0.375, feedback: 0.35, wet: 1 });
  private readonly delayOut = new Tone.Filter({ type: 'lowpass', frequency: 6500 });
  private readonly tracks = new Map<string, TrackNodes>();
  private reverbDecay = 2.8;
  private limiterOn = true;

  constructor(destination: Tone.InputNode = Tone.getDestination()) {
    this.masterIn.chain(this.glue, this.limiter, this.masterVol);
    this.masterVol.connect(destination);
    this.masterVol.connect(this.masterMeter);
    this.reverbIn.chain(this.reverb, this.masterIn);
    this.delayIn.chain(this.delay, this.delayOut, this.masterIn);
  }

  sync(project: Project): void {
    const audible = new Set(audibleTracks(project).map((t) => t.id));
    const seen = new Set<string>();
    for (const track of project.tracks) {
      seen.add(track.id);
      this.syncTrack(track, audible.has(track.id));
    }
    for (const [id, nodes] of this.tracks) {
      if (!seen.has(id)) {
        nodes.instrument.dispose();
        nodes.chain.dispose();
        this.tracks.delete(id);
      }
    }
    this.syncMaster(project);
  }

  private syncTrack(track: Track, audible: boolean): void {
    let nodes = this.tracks.get(track.id);
    const configKey = JSON.stringify(track.instrument);
    if (!nodes) {
      const chain = new TrackChain(this.masterIn, this.reverbIn, this.delayIn);
      const instrument = createInstrument(track.instrument);
      instrument.output.connect(chain.input);
      nodes = { chain, instrument, type: track.instrument.type, configKey };
      this.tracks.set(track.id, nodes);
    } else if (nodes.configKey !== configKey) {
      const sameType = nodes.type === track.instrument.type;
      if (!sameType || !nodes.instrument.update(track.instrument)) {
        nodes.instrument.releaseAll();
        nodes.instrument.dispose();
        nodes.instrument = createInstrument(track.instrument);
        nodes.instrument.output.connect(nodes.chain.input);
        nodes.type = track.instrument.type;
      }
      nodes.configKey = configKey;
    }
    nodes.chain.apply(track.mixer, audible);
  }

  private syncMaster(project: Project): void {
    const m = project.master;
    this.masterVol.volume.value = m.volume;
    if (Math.abs(m.reverb.decay - this.reverbDecay) > 0.01) {
      this.reverbDecay = m.reverb.decay;
      this.reverb.decay = m.reverb.decay;
    }
    this.reverb.wet.value = m.reverb.wet;
    this.delay.delayTime.value = NOTE_VALUE_BEATS[m.delay.time] * secondsPerBeat(project.bpm);
    this.delay.feedback.value = m.delay.feedback;
    if (m.limiter !== this.limiterOn) {
      this.limiterOn = m.limiter;
      this.limiter.threshold.value = m.limiter ? -0.8 : 24;
    }
  }

  /** Schedules every note starting in [beat, beat + STEP) at audio time `time`. */
  scheduleStep(project: Project, beat: number, time: number): void {
    const spb = secondsPerBeat(project.bpm);
    const events = collectEvents(project, beat, beat + STEP);
    for (const ev of events) {
      const nodes = this.tracks.get(ev.trackId);
      if (!nodes) continue;
      nodes.instrument.trigger(ev.pitch, ev.velocity, time + ev.offset * spb, ev.duration * spb);
    }
    // Sidechain: every kick on a drum track ducks the tracks that ask for it.
    const kicks = events.filter((ev) => ev.pitch === KICK_NOTE && this.tracks.get(ev.trackId)?.type === 'drum-machine');
    if (kicks.length) {
      for (const nodes of this.tracks.values()) {
        if (nodes.chain.sidechain <= 0) continue;
        for (const k of kicks) nodes.chain.duckAt(time + k.offset * spb, spb);
      }
    }
  }

  instrument(trackId: string): Instrument | undefined {
    return this.tracks.get(trackId)?.instrument;
  }

  trackLevel(trackId: string): number {
    return this.tracks.get(trackId)?.chain.level() ?? -Infinity;
  }

  masterLevel(): number {
    const v = this.masterMeter.getValue();
    return typeof v === 'number' ? v : Math.max(...v);
  }

  releaseAll(time?: number): void {
    for (const n of this.tracks.values()) n.instrument.releaseAll(time);
  }

  async ready(): Promise<void> {
    await Promise.all([this.reverb.ready, ...[...this.tracks.values()].map((n) => n.instrument.ready())]);
  }

  dispose(): void {
    for (const n of this.tracks.values()) {
      n.instrument.dispose();
      n.chain.dispose();
    }
    this.tracks.clear();
    for (const n of [this.masterIn, this.glue, this.limiter, this.masterVol, this.masterMeter, this.reverbIn, this.reverb, this.delayIn, this.delay, this.delayOut]) n.dispose();
  }
}
