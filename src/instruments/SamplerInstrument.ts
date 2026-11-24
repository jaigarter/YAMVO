import * as Tone from 'tone';
import type { InstrumentConfig } from '../model/types';
import { type Instrument, num, str, velocityGain } from './Instrument';
import { getSampleBuffer } from '../library/sampleStore';
import { getPackZones } from '../library/samplePacks';
import { midiToFreq, noteName } from '../model/theory';

/**
 * Multi-sample instrument built on Tone.Sampler.
 *
 * Sources:
 *  - `params.sampleId` + `params.root`: a single library/user sample played
 *    chromatically (vocal chops, one-shots, textures).
 *  - `params.pack`: a multisample pack (see library/samplePacks.ts) whose zones
 *    are loaded lazily the first time the preset is used.
 */
export class SamplerInstrument implements Instrument {
  readonly output = new Tone.Gain(1);
  private readonly filter = new Tone.Filter({ type: 'lowpass', frequency: 20000, Q: 0.5 });
  private sampler: Tone.Sampler | null = null;
  private sourceKey = '';
  private loading: Promise<void> = Promise.resolve();
  private transpose = 0;

  constructor(config: InstrumentConfig) {
    this.filter.connect(this.output);
    this.update(config);
  }

  update(config: InstrumentConfig): boolean {
    const p = config.params;
    const key = JSON.stringify([p.pack, p.sampleId, p.root]);
    if (key !== this.sourceKey) {
      this.sourceKey = key;
      this.loading = this.load(config, key);
    }
    this.transpose = num(p, 'transpose', 0);
    this.filter.frequency.value = num(p, 'cutoff', 20000);
    this.filter.Q.value = num(p, 'resonance', 0.5);
    this.output.gain.value = Tone.dbToGain(num(p, 'level', 0));
    if (this.sampler) {
      this.sampler.attack = num(p, 'attack', 0.002);
      this.sampler.release = num(p, 'release', 0.4);
    }
    return true;
  }

  private async load(config: InstrumentConfig, key: string): Promise<void> {
    const p = config.params;
    const urls: Record<string, Tone.ToneAudioBuffer> = {};
    try {
      const pack = str(p, 'pack', '');
      if (pack) {
        const zones = await getPackZones(pack);
        for (const z of zones) urls[noteName(z.note)] = new Tone.ToneAudioBuffer(z.buffer);
      } else {
        const sampleId = str(p, 'sampleId', '');
        if (!sampleId) return;
        const buf = await getSampleBuffer(sampleId);
        urls[noteName(num(p, 'root', 60))] = new Tone.ToneAudioBuffer(buf);
      }
    } catch (err) {
      console.warn('[Sampler] failed to load source', err);
      return;
    }
    if (key !== this.sourceKey) return;
    const next = new Tone.Sampler({
      urls: urls as never,
      attack: num(p, 'attack', 0.002),
      release: num(p, 'release', 0.4),
    }).connect(this.filter);
    this.sampler?.dispose();
    this.sampler = next;
  }

  private f(pitch: number) {
    return midiToFreq(pitch + this.transpose);
  }

  trigger(pitch: number, velocity: number, time: number, duration: number): void {
    this.sampler?.triggerAttackRelease(this.f(pitch), duration, time, velocityGain(velocity));
  }

  noteOn(pitch: number, velocity: number, time?: number): void {
    this.sampler?.triggerAttack(this.f(pitch), time ?? Tone.now(), velocityGain(velocity));
  }

  noteOff(pitch: number, time?: number): void {
    this.sampler?.triggerRelease(this.f(pitch), time ?? Tone.now());
  }

  releaseAll(time?: number): void {
    this.sampler?.releaseAll(time);
  }

  ready(): Promise<void> {
    return this.loading;
  }

  dispose(): void {
    this.sampler?.dispose();
    this.filter.dispose();
    this.output.dispose();
  }
}
