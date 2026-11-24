import * as Tone from 'tone';
import type { MixerSettings } from '../model/types';
import { InsertChain } from './insertChain';

/**
 * A mixer channel strip. All processing is real Web Audio DSP:
 *
 *   input → [filter] → [low shelf · peak · high shelf] → [compressor] → channel ─┬→ master
 *                                                                                ├→ reverb send
 *                                                                                └→ delay send
 *
 * Stages in brackets are only connected while active, to save CPU.
 */
export class TrackChain {
  readonly input = new Tone.Gain(1);
  private readonly filter = new Tone.Filter({ type: 'lowpass', frequency: 20000, Q: 0.7, rolloff: -12 });
  private readonly low = new Tone.Filter({ type: 'lowshelf', frequency: 220, gain: 0 });
  private readonly mid = new Tone.Filter({ type: 'peaking', frequency: 1200, Q: 0.8, gain: 0 });
  private readonly high = new Tone.Filter({ type: 'highshelf', frequency: 4000, gain: 0 });
  private readonly comp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.005, release: 0.12, knee: 6 });
  private readonly channel = new Tone.Channel({ volume: 0, pan: 0 });
  private readonly inserts = new InsertChain(this.input, this.channel);
  private readonly reverbSend = new Tone.Gain(0);
  private readonly delaySend = new Tone.Gain(0);
  readonly meter = new Tone.Meter({ smoothing: 0.75 });

  constructor(master: Tone.InputNode, reverbBus: Tone.InputNode, delayBus: Tone.InputNode) {
    this.channel.connect(master);
    this.channel.connect(this.reverbSend);
    this.channel.connect(this.delaySend);
    this.channel.connect(this.meter);
    this.reverbSend.connect(reverbBus);
    this.delaySend.connect(delayBus);
  }

  apply(m: MixerSettings, audible: boolean): void {
    this.channel.volume.value = m.volume <= -60 ? -Infinity : m.volume;
    this.channel.pan.value = m.pan;
    this.channel.mute = !audible;
    this.low.gain.value = m.eq.low;
    this.mid.gain.value = m.eq.mid;
    this.high.gain.value = m.eq.high;
    this.filter.type = m.filter.type;
    this.filter.frequency.value = m.filter.cutoff;
    this.filter.Q.value = m.filter.q;
    this.comp.threshold.value = m.comp.threshold;
    this.comp.ratio.value = m.comp.ratio;
    this.inserts.set([
      m.filter.enabled && this.filter,
      Math.abs(m.eq.low) > 0.05 && this.low,
      Math.abs(m.eq.mid) > 0.05 && this.mid,
      Math.abs(m.eq.high) > 0.05 && this.high,
      m.comp.enabled && this.comp,
    ]);
    this.reverbSend.gain.value = m.sends.reverb;
    this.delaySend.gain.value = m.sends.delay;
  }

  /** Post-fader level in dB (for meters). */
  level(): number {
    const v = this.meter.getValue();
    return typeof v === 'number' ? v : Math.max(...v);
  }

  dispose(): void {
    for (const n of [this.input, this.filter, this.low, this.mid, this.high, this.comp, this.channel, this.reverbSend, this.delaySend, this.meter]) n.dispose();
  }
}
