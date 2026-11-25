import * as Tone from 'tone';
import type { InstrumentConfig } from '../model/types';
import { type Instrument, num, str, velocityGain } from './Instrument';
import { getSampleBuffer } from '../library/sampleStore';
import { getPackZones } from '../library/samplePacks';
import { midiToFreq, noteName } from '../model/theory';

interface Layer {
  /** Upper velocity bound (0..1]. */
  vel: number;
  sampler: Tone.Sampler;
}

/**
 * Multi-sample instrument built on Tone.Sampler.
 *
 * Sources:
 *  - `params.pack`: a sampled pack (piano, Rhodes, strings…) loaded lazily;
 *    packs with several velocity layers get one sampler per layer, so soft
 *    and hard notes use different recordings (e.g. Rhodes bark).
 *  - `params.sampleId` + `params.root`: a single library/user sample played
 *    chromatically (vocal chops, one-shots, textures).
 */
export class SamplerInstrument implements Instrument {
  readonly output = new Tone.Gain(1);
  private readonly filter = new Tone.Filter({ type: 'lowpass', frequency: 20000, Q: 0.5 });
  private layers: Layer[] = [];
  private sourceKey = '';
  private loading: Promise<void> = Promise.resolve();
  private transpose = 0;
  /** pitch → layer that started it, so note-off reaches the right sampler. */
  private sounding = new Map<number, Layer>();

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
    for (const l of this.layers) {
      l.sampler.attack = num(p, 'attack', 0.002);
      l.sampler.release = num(p, 'release', 0.4);
    }
    return true;
  }

  private async load(config: InstrumentConfig, key: string): Promise<void> {
    const p = config.params;
    const groups = new Map<number, Record<string, Tone.ToneAudioBuffer>>();
    try {
      const pack = str(p, 'pack', '');
      if (pack) {
        for (const z of await getPackZones(pack)) {
          const g = groups.get(z.vel) ?? {};
          g[noteName(z.note)] = new Tone.ToneAudioBuffer(z.buffer);
          groups.set(z.vel, g);
        }
      } else {
        const sampleId = str(p, 'sampleId', '');
        if (!sampleId) return;
        const buf = await getSampleBuffer(sampleId);
        groups.set(1, { [noteName(num(p, 'root', 60))]: new Tone.ToneAudioBuffer(buf) });
      }
    } catch (err) {
      console.warn('[Sampler] failed to load source', err);
      return;
    }
    if (key !== this.sourceKey) return;
    const next = [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([vel, urls]) => ({
        vel,
        sampler: new Tone.Sampler({ urls: urls as never, attack: num(p, 'attack', 0.002), release: num(p, 'release', 0.4) }).connect(this.filter),
      }));
    for (const l of this.layers) l.sampler.dispose();
    this.layers = next;
  }

  private layerFor(velocity: number): Layer | undefined {
    return this.layers.find((l) => velocity <= l.vel + 1e-6) ?? this.layers[this.layers.length - 1];
  }

  private f(pitch: number) {
    return midiToFreq(pitch + this.transpose);
  }

  trigger(pitch: number, velocity: number, time: number, duration: number): void {
    this.layerFor(velocity)?.sampler.triggerAttackRelease(this.f(pitch), duration, time, velocityGain(velocity));
  }

  noteOn(pitch: number, velocity: number, time?: number): void {
    const l = this.layerFor(velocity);
    if (!l) return;
    this.sounding.set(pitch, l);
    l.sampler.triggerAttack(this.f(pitch), time ?? Tone.now(), velocityGain(velocity));
  }

  noteOff(pitch: number, time?: number): void {
    const l = this.sounding.get(pitch);
    this.sounding.delete(pitch);
    l?.sampler.triggerRelease(this.f(pitch), time ?? Tone.now());
  }

  releaseAll(time?: number): void {
    for (const l of this.layers) l.sampler.releaseAll(time);
    this.sounding.clear();
  }

  ready(): Promise<void> {
    return this.loading;
  }

  dispose(): void {
    for (const l of this.layers) l.sampler.dispose();
    this.filter.dispose();
    this.output.dispose();
  }
}
