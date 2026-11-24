import * as Tone from 'tone';
import type { DrumLaneConfig, InstrumentConfig } from '../model/types';
import { type Instrument, num, velocityGain } from './Instrument';
import { isDrumVoice, renderDrumVoice } from './drumSynthesis';
import { kitLanes } from './drumKits';
import { getSampleBuffer } from '../library/sampleStore';

interface Lane {
  config: DrumLaneConfig;
  buffer: Tone.ToneAudioBuffer | null;
  /** Playback rate for sample sources (synth voices bake tune in). */
  rate: number;
  gain: Tone.Gain;
  panner: Tone.Panner;
  loading: Promise<void>;
  key: string;
}

/**
 * Eight-lane drum machine. Each lane plays either a synthesized voice
 * (rendered to a buffer) or a sample from the library. Supports velocity,
 * per-lane tune/decay/level/pan and choke groups (closed hat cuts open hat).
 */
export class DrumMachine implements Instrument {
  readonly output = new Tone.Gain(1);
  private lanes = new Map<number, Lane>();
  private active = new Map<number, Tone.ToneBufferSource[]>();

  constructor(config: InstrumentConfig) {
    this.update(config);
  }

  static lanesOf(config: InstrumentConfig): DrumLaneConfig[] {
    return config.lanes && config.lanes.length ? config.lanes : kitLanes(config.presetId);
  }

  update(config: InstrumentConfig): boolean {
    const lanes = DrumMachine.lanesOf(config);
    const master = Tone.dbToGain(num(config.params, 'level', 0));
    this.output.gain.value = master;
    const seen = new Set<number>();
    for (const lc of lanes) {
      seen.add(lc.note);
      let lane = this.lanes.get(lc.note);
      if (!lane) {
        const panner = new Tone.Panner(lc.pan).connect(this.output);
        const gain = new Tone.Gain(Tone.dbToGain(lc.level)).connect(panner);
        lane = { config: lc, buffer: null, rate: 1, gain, panner, loading: Promise.resolve(), key: '' };
        this.lanes.set(lc.note, lane);
      }
      lane.config = lc;
      lane.gain.gain.value = Tone.dbToGain(lc.level);
      lane.panner.pan.value = lc.pan;
      const key = JSON.stringify([lc.source, lc.tune, lc.decay]);
      if (key !== lane.key) {
        lane.key = key;
        lane.loading = this.loadLane(lane, lc, key);
      }
    }
    for (const [note, lane] of this.lanes) {
      if (!seen.has(note)) {
        lane.gain.dispose();
        lane.panner.dispose();
        this.lanes.delete(note);
      }
    }
    return true;
  }

  private async loadLane(lane: Lane, lc: DrumLaneConfig, key: string): Promise<void> {
    try {
      let buf: AudioBuffer;
      let rate = 1;
      if (lc.source.kind === 'synth' && isDrumVoice(lc.source.voice)) {
        buf = await renderDrumVoice(lc.source.voice, lc.tune, lc.decay);
      } else if (lc.source.kind === 'sample') {
        buf = await getSampleBuffer(lc.source.sampleId);
        rate = Math.pow(2, lc.tune / 12);
      } else {
        return;
      }
      if (lane.key !== key) return; // superseded by a newer edit
      lane.buffer = new Tone.ToneAudioBuffer(buf);
      lane.rate = rate;
    } catch (err) {
      console.warn('[DrumMachine] lane failed to load', lc, err);
    }
  }

  trigger(pitch: number, velocity: number, time: number): void {
    const lane = this.lanes.get(pitch);
    if (!lane || !lane.buffer) return;
    const { choke } = lane.config;
    if (choke !== undefined) {
      for (const [note, other] of this.lanes) {
        if (note === pitch || other.config.choke !== choke) continue;
        for (const src of this.active.get(note) ?? []) {
          try {
            src.stop(time);
          } catch {
            /* not started yet */
          }
        }
        this.active.set(note, []);
      }
    }
    const src = new Tone.ToneBufferSource({
      url: lane.buffer,
      playbackRate: lane.rate,
      fadeOut: 0.008,
    }).connect(lane.gain);
    // Sample lanes honour the decay control with a fade.
    const duration =
      lane.config.source.kind === 'sample' && lane.config.decay < 1
        ? (lane.buffer.duration / lane.rate) * lane.config.decay
        : undefined;
    src.start(time, 0, duration, velocityGain(velocity));
    const list = this.active.get(pitch) ?? [];
    list.push(src);
    this.active.set(pitch, list);
    src.onended = () => {
      const l = this.active.get(pitch);
      if (l) this.active.set(pitch, l.filter((s) => s !== src));
      src.dispose();
    };
  }

  noteOn(pitch: number, velocity: number, time?: number): void {
    this.trigger(pitch, velocity, time ?? Tone.now());
  }

  noteOff(): void {
    /* one-shots ignore note-off */
  }

  releaseAll(time?: number): void {
    for (const list of this.active.values()) {
      for (const s of list) {
        try {
          s.stop(time);
        } catch {
          /* ignore */
        }
      }
    }
  }

  async ready(): Promise<void> {
    await Promise.all([...this.lanes.values()].map((l) => l.loading));
  }

  dispose(): void {
    this.releaseAll();
    for (const lane of this.lanes.values()) {
      lane.gain.dispose();
      lane.panner.dispose();
    }
    this.lanes.clear();
    this.output.dispose();
  }
}
