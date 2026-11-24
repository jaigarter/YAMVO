import * as Tone from 'tone';
import type { InstrumentConfig } from '../model/types';
import { type Instrument, bool, num, str, velocityGain } from './Instrument';
import { midiToFreq } from '../model/theory';
import { InsertChain } from '../engine/insertChain';
import { VoiceEngine, type VoiceSpec, type Wave } from './voiceEngine';

export type SynthEngine = 'subtractive' | 'fm' | 'epiano';

/**
 * Virtual-analogue / FM synthesizer covering basses, pads, plucks, leads, chord
 * stabs and FM electric pianos. Voices are native per-note graphs
 * (see voiceEngine.ts).
 *
 * Signal path: voices → [drive] → [chorus] → [movement (auto-filter)] → [tremolo] → level
 * (bracketed effects are connected only while their amount is above zero).
 */
export class SynthInstrument implements Instrument {
  readonly output = new Tone.Gain(1);
  /** Voices sum here; effects are inserted between `pre` and `output` only when used. */
  private readonly pre = new Tone.Gain(1);
  private readonly inserts = new InsertChain(this.pre, this.output);
  private readonly engine: VoiceEngine;
  private fx: {
    drive?: Tone.Distortion;
    chorus?: Tone.Chorus;
    movement?: Tone.AutoFilter;
    tremolo?: Tone.Tremolo;
  } = {};
  private transpose = 0;

  constructor(config: InstrumentConfig) {
    const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext;
    this.engine = new VoiceEngine(ctx, this.pre.input as unknown as AudioNode, SynthInstrument.spec(config));
    this.update(config);
  }

  static spec(config: InstrumentConfig): VoiceSpec {
    const p = config.params;
    const engine = str<SynthEngine>(p, 'engine', 'subtractive');
    const amp = {
      attack: num(p, 'attack', 0.005),
      decay: num(p, 'decay', 0.3),
      sustain: num(p, 'sustain', 0.7),
      release: num(p, 'release', 0.3),
    };
    if (engine === 'subtractive') {
      return {
        kind: 'subtractive',
        wave: str<Wave>(p, 'osc', 'sawtooth'),
        unison: num(p, 'unison', 1),
        detune: num(p, 'detune', 20),
        cutoff: num(p, 'cutoff', 800),
        resonance: num(p, 'resonance', 1),
        envAmount: num(p, 'envAmount', 2),
        filterEnv: {
          attack: num(p, 'fAttack', 0.005),
          decay: num(p, 'fDecay', 0.3),
          sustain: num(p, 'fSustain', 0.4),
          release: num(p, 'fRelease', amp.release),
        },
        amp,
      };
    }
    const modEnv = {
      attack: num(p, 'modAttack', 0.002),
      decay: num(p, 'modDecay', engine === 'epiano' ? 0.6 : 0.3),
      sustain: num(p, 'modSustain', engine === 'epiano' ? 0.15 : 0.3),
      release: amp.release,
    };
    if (engine === 'epiano') {
      return { kind: 'epiano', bark: num(p, 'bark', 3), tine: num(p, 'tine', 0.35), modEnv, amp };
    }
    return {
      kind: 'fm',
      harmonicity: num(p, 'harmonicity', 2),
      modIndex: num(p, 'modIndex', 5),
      modWave: str<Wave>(p, 'modWave', 'sine'),
      modEnv,
      amp,
    };
  }

  update(config: InstrumentConfig): boolean {
    const p = config.params;
    this.engine.spec = SynthInstrument.spec(config);
    this.engine.mono = str<SynthEngine>(p, 'engine', 'subtractive') === 'subtractive' && bool(p, 'mono', false);
    this.engine.glide = num(p, 'glide', 0);
    this.transpose = num(p, 'transpose', 0);

    const drive = num(p, 'drive', 0);
    const chorus = num(p, 'chorus', 0);
    const mv = num(p, 'movement', 0);
    const trem = num(p, 'tremolo', 0);
    const fx = this.fx;
    if (drive > 0) {
      fx.drive ??= new Tone.Distortion({ distortion: 0, oversample: '2x' });
      fx.drive.distortion = drive * 0.9;
    }
    if (chorus > 0) {
      fx.chorus ??= new Tone.Chorus({ frequency: 1.2, delayTime: 3.5, depth: 0.6, spread: 160 }).start();
      fx.chorus.wet.value = chorus;
    }
    if (mv > 0) {
      fx.movement ??= new Tone.AutoFilter({ frequency: 0.5, baseFrequency: 200, octaves: 4 }).start();
      fx.movement.depth.value = mv;
      fx.movement.frequency.value = num(p, 'movementRate', 0.5);
      fx.movement.baseFrequency = Math.max(60, num(p, 'cutoff', 800) * 0.5);
    }
    if (trem > 0) {
      fx.tremolo ??= new Tone.Tremolo({ frequency: 4.5, depth: 0, spread: 120 }).start();
      fx.tremolo.depth.value = trem;
      fx.tremolo.frequency.value = num(p, 'tremRate', 4.5);
    }
    this.inserts.set([drive > 0 && fx.drive, chorus > 0 && fx.chorus, mv > 0 && fx.movement, trem > 0 && fx.tremolo]);
    this.output.gain.value = Tone.dbToGain(num(p, 'level', 0));
    return true;
  }

  private freq(pitch: number): number {
    return midiToFreq(pitch + this.transpose);
  }

  trigger(pitch: number, velocity: number, time: number, duration: number): void {
    this.engine.play(pitch, this.freq(pitch), velocityGain(velocity), time, duration);
  }

  noteOn(pitch: number, velocity: number, time?: number): void {
    this.engine.noteOn(pitch, this.freq(pitch), velocityGain(velocity), time ?? Tone.now());
  }

  noteOff(pitch: number, time?: number): void {
    this.engine.noteOff(pitch, time ?? Tone.now());
  }

  releaseAll(time?: number): void {
    this.engine.releaseAll(time ?? Tone.now());
  }

  async ready(): Promise<void> {}

  dispose(): void {
    this.releaseAll();
    for (const n of Object.values(this.fx)) n?.dispose();
    this.pre.dispose();
    this.output.dispose();
  }
}
