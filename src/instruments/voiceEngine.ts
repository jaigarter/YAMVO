/**
 * Lightweight polyphonic voice engine built from raw Web Audio nodes.
 *
 * Each note creates its own small graph (oscillators → filter → amp) which is
 * started at note-on and stopped after the release, after which the browser
 * frees it. Compared with long-lived wrapper voices this keeps the number of
 * always-running nodes at zero when nothing plays, so dense chords, unison
 * pads and FM pianos stay cheap enough for realtime use.
 *
 * Envelopes are scheduled on AudioParams with exact audio times. Releases use
 * an analytic envelope value instead of cancelAndHoldAtTime (not available in
 * every browser).
 */

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface Adsr {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface SubtractiveSpec {
  kind: 'subtractive';
  wave: Wave;
  unison: number;
  /** Total detune spread in cents. */
  detune: number;
  cutoff: number;
  resonance: number;
  /** Filter envelope amount in octaves. */
  envAmount: number;
  filterEnv: Adsr;
  amp: Adsr;
}

export interface FmSpec {
  kind: 'fm';
  harmonicity: number;
  modIndex: number;
  modWave: Wave;
  modEnv: Adsr;
  amp: Adsr;
}

export interface EpianoSpec {
  kind: 'epiano';
  bark: number;
  tine: number;
  modEnv: Adsr;
  amp: Adsr;
}

export type VoiceSpec = SubtractiveSpec | FmSpec | EpianoSpec;

type Ctx = BaseAudioContext;

/** Value of the scheduled ADSR (attack linear, decay exponential) at `elapsed`. */
export function adsrValue(env: Adsr, peak: number, elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed < env.attack) return (elapsed / env.attack) * peak;
  const tau = Math.max(0.001, env.decay / 4);
  const s = env.sustain * peak;
  return s + (peak - s) * Math.exp(-(elapsed - env.attack) / tau);
}

class Env {
  constructor(
    private readonly param: AudioParam,
    private readonly env: Adsr,
    private readonly peak: number,
    private readonly floor = 0,
  ) {}

  private start = 0;

  attack(t: number): void {
    const { param, env, peak, floor } = this;
    this.start = t;
    param.cancelScheduledValues(t);
    param.setValueAtTime(floor, t);
    param.linearRampToValueAtTime(floor + peak, t + Math.max(0.001, env.attack));
    param.setTargetAtTime(floor + env.sustain * peak, t + Math.max(0.001, env.attack), Math.max(0.001, env.decay / 4));
  }

  /** Cancels a future release so the note keeps sounding from `t` (legato). */
  hold(t: number): void {
    const { param, env, peak, floor } = this;
    const v = floor + adsrValue({ ...env, attack: Math.max(0.001, env.attack) }, peak, t - this.start);
    param.cancelScheduledValues(t);
    param.setValueAtTime(v, t);
    param.setTargetAtTime(floor + env.sustain * peak, t, Math.max(0.001, env.decay / 4));
  }

  release(t: number): number {
    const { param, env, peak, floor } = this;
    const v = floor + adsrValue({ ...env, attack: Math.max(0.001, env.attack) }, peak, t - this.start);
    param.cancelScheduledValues(t);
    param.setValueAtTime(v, t);
    param.setTargetAtTime(floor, t, Math.max(0.002, env.release / 4));
    return t + env.release * 1.6 + 0.02;
  }
}

export interface Voice {
  pitch: number;
  start: number;
  /** Scheduled end (after release) or Infinity while held. */
  end: number;
  /** When the release phase begins (Infinity while held). */
  releaseStart: number;
  releaseAt(t: number): void;
  /** Legato: keep the voice sounding from t and glide to a new frequency. */
  legato(freq: number, t: number, glide: number): void;
  hardStop(t: number): void;
}

const centsToRatio = (c: number) => Math.pow(2, c / 1200);

function makeVoice(ctx: Ctx, out: AudioNode, spec: VoiceSpec, pitch: number, freq: number, velocity: number, t: number, fromFreq?: number, glide = 0): Voice {
  const oscs: OscillatorNode[] = [];
  const envs: Env[] = [];
  const amp = ctx.createGain();
  amp.gain.value = 0;
  amp.connect(out);

  const setFreq = (osc: OscillatorNode, f: number) => {
    if (fromFreq && glide > 0) {
      osc.frequency.setValueAtTime(fromFreq * (f / freq), t);
      osc.frequency.exponentialRampToValueAtTime(f, t + glide);
    } else {
      osc.frequency.setValueAtTime(f, t);
    }
  };
  const ratios: number[] = []; // per oscillator, relative to the note frequency

  if (spec.kind === 'subtractive') {
    const n = Math.max(1, Math.min(7, Math.round(spec.unison)));
    const f1 = ctx.createBiquadFilter();
    const f2 = ctx.createBiquadFilter();
    f1.type = f2.type = 'lowpass';
    f1.Q.value = 0.7;
    f2.Q.value = spec.resonance;
    f1.connect(f2);
    f2.connect(amp);
    let left: StereoPannerNode | null = null;
    let right: StereoPannerNode | null = null;
    if (n > 1) {
      left = ctx.createStereoPanner();
      right = ctx.createStereoPanner();
      left.pan.value = -0.6;
      right.pan.value = 0.6;
      left.connect(f1);
      right.connect(f1);
    }
    const voiceGain = 1 / Math.sqrt(n);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = spec.wave;
      const cents = n === 1 ? 0 : -spec.detune / 2 + (spec.detune * i) / (n - 1);
      ratios.push(centsToRatio(cents));
      setFreq(o, freq * ratios[i]);
      const g = ctx.createGain();
      g.gain.value = voiceGain;
      o.connect(g);
      g.connect(n > 1 ? (i % 2 ? right! : left!) : f1);
      oscs.push(o);
    }
    const nyq = ctx.sampleRate / 2 - 500;
    const base = Math.min(spec.cutoff, nyq);
    const peak = Math.min(nyq, spec.cutoff * Math.pow(2, spec.envAmount * (0.5 + 0.5 * velocity))) - base;
    for (const f of [f1, f2]) {
      f.frequency.value = base;
      if (peak > 1) envs.push(new Env(f.frequency, spec.filterEnv, peak, base));
    }
  } else {
    const pairs: { h: number; index: number; env: Adsr; level: number; wave: Wave }[] =
      spec.kind === 'fm'
        ? [{ h: spec.harmonicity, index: spec.modIndex, env: spec.modEnv, level: 1, wave: spec.modWave }]
        : [
            { h: 1, index: spec.bark, env: spec.modEnv, level: 1, wave: 'sine' },
            { h: 14, index: 1.6 + velocity * 1.4, env: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }, level: spec.tine, wave: 'sine' },
          ];
    for (const pr of pairs) {
      if (pr.level <= 0) continue;
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      car.type = 'sine';
      mod.type = pr.wave;
      ratios.push(1, pr.h);
      setFreq(car, freq);
      setFreq(mod, freq * pr.h);
      const modGain = ctx.createGain();
      modGain.gain.value = 0;
      mod.connect(modGain);
      modGain.connect(car.frequency);
      // Velocity brightens FM tone, as on real FM electric pianos.
      envs.push(new Env(modGain.gain, pr.env, pr.index * freq * (0.4 + 0.6 * velocity)));
      const lvl = ctx.createGain();
      lvl.gain.value = pr.level;
      car.connect(lvl);
      lvl.connect(amp);
      oscs.push(car, mod);
    }
  }

  const ampEnv = new Env(amp.gain, spec.amp, 0.35 * velocity);
  envs.push(ampEnv);
  for (const e of envs) e.attack(t);
  for (const o of oscs) o.start(t);

  let stopped = false;
  const voice: Voice = {
    pitch,
    start: t,
    end: Infinity,
    releaseStart: Infinity,
    releaseAt(rt: number) {
      voice.releaseStart = rt;
      let end = rt;
      for (const e of envs) end = Math.max(end, e.release(rt));
      voice.end = end;
      for (const o of oscs) o.stop(end);
    },
    legato(f: number, gt: number, glide: number) {
      for (const e of envs) e.hold(gt);
      voice.end = Infinity;
      voice.releaseStart = Infinity;
      oscs.forEach((o, i) => {
        o.frequency.cancelScheduledValues(gt);
        o.frequency.setTargetAtTime(f * ratios[i], gt, Math.max(0.001, glide / 3));
      });
    },
    hardStop(st: number) {
      if (stopped) return;
      stopped = true;
      amp.gain.cancelScheduledValues(st);
      amp.gain.setTargetAtTime(0, st, 0.005);
      for (const o of oscs) o.stop(st + 0.05);
      voice.end = st + 0.05;
    },
  };
  oscs[0]?.addEventListener('ended', () => amp.disconnect());
  return voice;
}

/**
 * Polyphonic (or mono/legato) note manager on top of makeVoice().
 */
export class VoiceEngine {
  spec: VoiceSpec;
  mono = false;
  glide = 0;
  maxVoices = 24;
  private voices: Voice[] = [];
  private lastFreq = 0;
  /** Held keys for live mono playing (last-note priority). */
  private held: { pitch: number; freq: number }[] = [];

  constructor(
    private readonly ctx: Ctx,
    private readonly out: AudioNode,
    spec: VoiceSpec,
  ) {
    this.spec = spec;
  }

  private prune(now: number): void {
    this.voices = this.voices.filter((v) => v.end > now);
    while (this.voices.length >= this.maxVoices) this.voices.shift()?.hardStop(now);
  }

  /** Sequencer note with known duration. */
  play(pitch: number, freq: number, velocity: number, t: number, duration: number): void {
    this.prune(t);
    if (this.mono) {
      const current = this.voices[this.voices.length - 1];
      // Overlapping notes in mono mode play legato: same voice, glide, no retrigger.
      if (current && current.start < t && current.releaseStart > t) {
        current.legato(freq, t, Math.max(0.005, this.glide));
        current.releaseAt(t + duration);
        this.lastFreq = freq;
        return;
      }
    }
    const v = makeVoice(this.ctx, this.out, this.spec, pitch, freq, velocity, t, this.lastFreq || undefined, this.mono ? this.glide : 0);
    v.releaseAt(t + duration);
    this.voices.push(v);
    this.lastFreq = freq;
  }

  noteOn(pitch: number, freq: number, velocity: number, t: number): void {
    this.prune(t);
    if (this.mono) {
      this.held = this.held.filter((h) => h.pitch !== pitch).concat({ pitch, freq });
      const current = this.voices.find((v) => v.end === Infinity);
      if (current) {
        current.legato(freq, t, Math.max(0.005, this.glide));
        this.lastFreq = freq;
        return;
      }
    }
    const v = makeVoice(this.ctx, this.out, this.spec, pitch, freq, velocity, t, this.mono ? this.lastFreq || undefined : undefined, this.mono ? this.glide : 0);
    this.voices.push(v);
    this.lastFreq = freq;
  }

  noteOff(pitch: number, t: number): void {
    if (this.mono) {
      this.held = this.held.filter((h) => h.pitch !== pitch);
      const current = this.voices.find((v) => v.end === Infinity);
      if (!current) return;
      const prev = this.held[this.held.length - 1];
      if (prev) {
        current.legato(prev.freq, t, Math.max(0.005, this.glide));
        this.lastFreq = prev.freq;
      } else {
        current.releaseAt(t);
      }
      return;
    }
    for (const v of this.voices) if (v.pitch === pitch && v.end === Infinity) v.releaseAt(t);
  }

  releaseAll(t: number): void {
    this.held = [];
    for (const v of this.voices) v.hardStop(t);
    this.voices = [];
  }
}
