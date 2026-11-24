import * as Tone from 'tone';
import type { InstrumentConfig } from '../model/types';
import { type Instrument, num, str, velocityGain } from './Instrument';
import { midiToFreq } from '../model/theory';
import { InsertChain } from '../engine/insertChain';

/**
 * Tonewheel-style drawbar organ (additive synthesis).
 *
 * Nine drawbars (16', 5⅓', 8', 4', 2⅔', 2', 1⅗', 1⅓', 1') are mapped onto
 * harmonics of a fundamental one octave below the played note, so they become
 * integer partials of a single periodic wave: [1, 3, 2, 4, 6, 8, 10, 12, 16].
 * Each drawbar step is ~3 dB, as on the real instrument. Includes harmonic
 * percussion, rotary-speaker simulation (vibrato + tremolo) and drive.
 */
export const DRAWBAR_LABELS = ["16'", "5⅓'", "8'", "4'", "2⅔'", "2'", "1⅗'", "1⅓'", "1'"];
const DRAWBAR_HARMONICS = [1, 3, 2, 4, 6, 8, 10, 12, 16];

export function drawbarPartials(drawbars: number[]): number[] {
  const partials = new Array(16).fill(0);
  drawbars.forEach((v, i) => {
    const amp = v <= 0 ? 0 : Math.pow(10, ((Math.min(8, v) - 8) * 3) / 20);
    partials[DRAWBAR_HARMONICS[i] - 1] += amp;
  });
  const total = partials.reduce((a, b) => a + b, 0) || 1;
  return partials.map((p) => p / Math.max(1, total * 0.6));
}

export class OrganInstrument implements Instrument {
  readonly output = new Tone.Gain(1);
  private readonly voices = new Tone.PolySynth(Tone.Synth);
  private readonly perc = new Tone.PolySynth(Tone.Synth);
  private readonly pre = new Tone.Gain(1);
  private readonly inserts = new InsertChain(this.pre, this.output);
  private drive?: Tone.Distortion;
  private vibrato?: Tone.Vibrato;
  private tremolo?: Tone.Tremolo;
  private transpose = 0;

  constructor(config: InstrumentConfig) {
    this.voices.maxPolyphony = 16;
    this.perc.maxPolyphony = 16;
    this.voices.connect(this.pre);
    this.perc.connect(this.pre);
    this.update(config);
  }

  update(config: InstrumentConfig): boolean {
    const p = config.params;
    const drawbars = DRAWBAR_LABELS.map((_, i) => num(p, `db${i + 1}`, i === 2 ? 8 : 0));
    this.voices.set({
      oscillator: { type: 'custom', partials: drawbarPartials(drawbars) } as never,
      envelope: { attack: 0.004, decay: 0.05, sustain: 1, release: num(p, 'release', 0.08) },
      detune: -1200,
    });
    const percHarm = str<string>(p, 'percHarm', 'third') === 'second' ? 4 : 6;
    this.perc.set({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: num(p, 'percDecay', 0.25), sustain: 0, release: 0.05 },
      detune: 1200 * Math.log2(percHarm / 2),
      volume: Tone.gainToDb(Math.max(0.0001, num(p, 'perc', 0) * 0.7)),
    });
    const drive = num(p, 'drive', 0.1);
    if (drive > 0) {
      this.drive ??= new Tone.Distortion({ distortion: 0, oversample: '2x' });
      this.drive.distortion = drive * 0.8;
    }
    const fast = str<string>(p, 'rotarySpeed', 'slow') === 'fast';
    const rot = num(p, 'rotary', 0.5);
    if (rot > 0) {
      this.vibrato ??= new Tone.Vibrato({ frequency: 0.8, depth: 0.06 });
      this.tremolo ??= new Tone.Tremolo({ frequency: 0.8, depth: 0.25, spread: 180 }).start();
      this.vibrato.frequency.value = fast ? 6.6 : 0.8;
      this.vibrato.depth.value = 0.08 * rot;
      this.tremolo.frequency.value = fast ? 6.6 : 0.8;
      this.tremolo.depth.value = 0.35 * rot;
    }
    this.inserts.set([drive > 0 && this.drive, rot > 0 && this.vibrato, rot > 0 && this.tremolo]);
    this.transpose = num(p, 'transpose', 0);
    this.output.gain.value = Tone.dbToGain(num(p, 'level', 0) - 4);
    return true;
  }

  private f(pitch: number) {
    return midiToFreq(pitch + this.transpose);
  }

  trigger(pitch: number, velocity: number, time: number, duration: number): void {
    // Organs are not velocity sensitive, but a gentle curve helps programmed parts.
    const v = 0.6 + 0.4 * velocityGain(velocity);
    this.voices.triggerAttackRelease(this.f(pitch), duration, time, v);
    this.perc.triggerAttackRelease(this.f(pitch), duration, time, v);
  }

  noteOn(pitch: number, velocity: number, time?: number): void {
    const t = time ?? Tone.now();
    const v = 0.6 + 0.4 * velocityGain(velocity);
    this.voices.triggerAttack(this.f(pitch), t, v);
    this.perc.triggerAttack(this.f(pitch), t, v);
  }

  noteOff(pitch: number, time?: number): void {
    const t = time ?? Tone.now();
    this.voices.triggerRelease(this.f(pitch), t);
    this.perc.triggerRelease(this.f(pitch), t);
  }

  releaseAll(time?: number): void {
    this.voices.releaseAll(time);
    this.perc.releaseAll(time);
  }

  async ready(): Promise<void> {}

  dispose(): void {
    for (const n of [this.voices, this.perc, this.pre, this.drive, this.vibrato, this.tremolo, this.output]) n?.dispose();
  }
}
