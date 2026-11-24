import type { InstrumentConfig, ParamValue } from '../model/types';
import { DRAWBAR_LABELS } from './OrganInstrument';

export interface ParamSpec {
  key: string;
  label: string;
  group: string;
  kind: 'range' | 'select' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Logarithmic knob response (frequencies, times). */
  log?: boolean;
  options?: { value: string; label: string }[];
  default: ParamValue;
  /** Only shown when this predicate holds. */
  when?: (p: InstrumentConfig['params']) => boolean;
}

const isSub = (p: InstrumentConfig['params']) => (p.engine ?? 'subtractive') === 'subtractive';
const isFm = (p: InstrumentConfig['params']) => p.engine === 'fm';
const isEp = (p: InstrumentConfig['params']) => p.engine === 'epiano';

const AMP: ParamSpec[] = [
  { key: 'attack', label: 'Attack', group: 'Amp', kind: 'range', min: 0.001, max: 4, log: true, unit: 's', default: 0.005 },
  { key: 'decay', label: 'Decay', group: 'Amp', kind: 'range', min: 0.01, max: 4, log: true, unit: 's', default: 0.3 },
  { key: 'sustain', label: 'Sustain', group: 'Amp', kind: 'range', min: 0, max: 1, step: 0.01, default: 0.7 },
  { key: 'release', label: 'Release', group: 'Amp', kind: 'range', min: 0.01, max: 6, log: true, unit: 's', default: 0.3 },
];

const FX: ParamSpec[] = [
  { key: 'drive', label: 'Drive', group: 'Character', kind: 'range', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'chorus', label: 'Chorus', group: 'Character', kind: 'range', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'movement', label: 'Movement', group: 'Character', kind: 'range', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'movementRate', label: 'Move Rate', group: 'Character', kind: 'range', min: 0.05, max: 8, log: true, unit: 'Hz', default: 0.5 },
  { key: 'level', label: 'Level', group: 'Character', kind: 'range', min: -24, max: 6, step: 0.5, unit: 'dB', default: 0 },
  { key: 'transpose', label: 'Transpose', group: 'Character', kind: 'range', min: -24, max: 24, step: 1, unit: 'st', default: 0 },
];

export const SYNTH_PARAMS: ParamSpec[] = [
  {
    key: 'osc', label: 'Wave', group: 'Oscillator', kind: 'select', default: 'sawtooth', when: isSub,
    options: [
      { value: 'sine', label: 'Sine' },
      { value: 'triangle', label: 'Triangle' },
      { value: 'sawtooth', label: 'Saw' },
      { value: 'square', label: 'Square' },
    ],
  },
  { key: 'unison', label: 'Voices', group: 'Oscillator', kind: 'range', min: 1, max: 7, step: 1, default: 1, when: isSub },
  { key: 'detune', label: 'Detune', group: 'Oscillator', kind: 'range', min: 0, max: 80, step: 1, unit: 'ct', default: 20, when: isSub },
  { key: 'mono', label: 'Mono', group: 'Oscillator', kind: 'toggle', default: false, when: isSub },
  { key: 'glide', label: 'Glide', group: 'Oscillator', kind: 'range', min: 0, max: 0.5, step: 0.005, unit: 's', default: 0, when: (p) => isSub(p) && p.mono === true },
  { key: 'harmonicity', label: 'Ratio', group: 'FM', kind: 'range', min: 0.5, max: 16, step: 0.5, default: 2, when: isFm },
  { key: 'modIndex', label: 'Index', group: 'FM', kind: 'range', min: 0, max: 40, step: 0.1, default: 5, when: isFm },
  {
    key: 'modWave', label: 'Mod Wave', group: 'FM', kind: 'select', default: 'sine', when: isFm,
    options: [
      { value: 'sine', label: 'Sine' },
      { value: 'triangle', label: 'Triangle' },
      { value: 'square', label: 'Square' },
    ],
  },
  { key: 'modDecay', label: 'Mod Decay', group: 'FM', kind: 'range', min: 0.01, max: 4, log: true, unit: 's', default: 0.3, when: (p) => isFm(p) || isEp(p) },
  { key: 'modSustain', label: 'Mod Sus', group: 'FM', kind: 'range', min: 0, max: 1, step: 0.01, default: 0.3, when: (p) => isFm(p) || isEp(p) },
  { key: 'bark', label: 'Bark', group: 'Tine', kind: 'range', min: 0, max: 12, step: 0.1, default: 3, when: isEp },
  { key: 'tine', label: 'Tine', group: 'Tine', kind: 'range', min: 0, max: 1, step: 0.01, default: 0.35, when: isEp },
  { key: 'tremolo', label: 'Tremolo', group: 'Tine', kind: 'range', min: 0, max: 1, step: 0.01, default: 0, when: isEp },
  { key: 'tremRate', label: 'Trem Rate', group: 'Tine', kind: 'range', min: 0.5, max: 10, step: 0.1, unit: 'Hz', default: 4.5, when: isEp },
  { key: 'cutoff', label: 'Cutoff', group: 'Filter', kind: 'range', min: 30, max: 16000, log: true, unit: 'Hz', default: 800, when: isSub },
  { key: 'resonance', label: 'Resonance', group: 'Filter', kind: 'range', min: 0.2, max: 18, step: 0.1, default: 1, when: isSub },
  { key: 'envAmount', label: 'Env Amt', group: 'Filter', kind: 'range', min: 0, max: 7, step: 0.1, unit: 'oct', default: 2, when: isSub },
  { key: 'fAttack', label: 'F Attack', group: 'Filter', kind: 'range', min: 0.001, max: 4, log: true, unit: 's', default: 0.005, when: isSub },
  { key: 'fDecay', label: 'F Decay', group: 'Filter', kind: 'range', min: 0.01, max: 4, log: true, unit: 's', default: 0.3, when: isSub },
  { key: 'fSustain', label: 'F Sustain', group: 'Filter', kind: 'range', min: 0, max: 1, step: 0.01, default: 0.4, when: isSub },
  ...AMP,
  ...FX,
];

export const ORGAN_PARAMS: ParamSpec[] = [
  ...DRAWBAR_LABELS.map<ParamSpec>((label, i) => ({
    key: `db${i + 1}`, label, group: 'Drawbars', kind: 'range', min: 0, max: 8, step: 1, default: i === 2 ? 8 : 0,
  })),
  { key: 'perc', label: 'Percussion', group: 'Voice', kind: 'range', min: 0, max: 1, step: 0.01, default: 0 },
  {
    key: 'percHarm', label: 'Perc Harm', group: 'Voice', kind: 'select', default: 'third',
    options: [
      { value: 'second', label: '2nd' },
      { value: 'third', label: '3rd' },
    ],
  },
  { key: 'percDecay', label: 'Perc Decay', group: 'Voice', kind: 'range', min: 0.05, max: 1.5, log: true, unit: 's', default: 0.25 },
  { key: 'release', label: 'Release', group: 'Voice', kind: 'range', min: 0.01, max: 1, log: true, unit: 's', default: 0.08 },
  { key: 'rotary', label: 'Rotary', group: 'Rotary', kind: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
  {
    key: 'rotarySpeed', label: 'Speed', group: 'Rotary', kind: 'select', default: 'slow',
    options: [
      { value: 'slow', label: 'Chorale' },
      { value: 'fast', label: 'Tremolo' },
    ],
  },
  { key: 'drive', label: 'Drive', group: 'Rotary', kind: 'range', min: 0, max: 1, step: 0.01, default: 0.1 },
  { key: 'level', label: 'Level', group: 'Rotary', kind: 'range', min: -24, max: 6, step: 0.5, unit: 'dB', default: 0 },
  { key: 'transpose', label: 'Transpose', group: 'Rotary', kind: 'range', min: -24, max: 24, step: 1, unit: 'st', default: 0 },
];

export const SAMPLER_PARAMS: ParamSpec[] = [
  { key: 'root', label: 'Root Note', group: 'Sample', kind: 'range', min: 24, max: 96, step: 1, default: 60, when: (p) => !p.pack },
  { key: 'attack', label: 'Attack', group: 'Sample', kind: 'range', min: 0.001, max: 2, log: true, unit: 's', default: 0.002 },
  { key: 'release', label: 'Release', group: 'Sample', kind: 'range', min: 0.01, max: 4, log: true, unit: 's', default: 0.4 },
  { key: 'cutoff', label: 'Cutoff', group: 'Tone', kind: 'range', min: 60, max: 20000, log: true, unit: 'Hz', default: 20000 },
  { key: 'resonance', label: 'Resonance', group: 'Tone', kind: 'range', min: 0.2, max: 12, step: 0.1, default: 0.5 },
  { key: 'level', label: 'Level', group: 'Tone', kind: 'range', min: -24, max: 6, step: 0.5, unit: 'dB', default: 0 },
  { key: 'transpose', label: 'Transpose', group: 'Tone', kind: 'range', min: -24, max: 24, step: 1, unit: 'st', default: 0 },
];

export const DRUM_PARAMS: ParamSpec[] = [
  { key: 'level', label: 'Kit Level', group: 'Kit', kind: 'range', min: -24, max: 6, step: 0.5, unit: 'dB', default: 0 },
];

export function paramSpecsFor(config: InstrumentConfig): ParamSpec[] {
  const list =
    config.type === 'synth' ? SYNTH_PARAMS : config.type === 'organ' ? ORGAN_PARAMS : config.type === 'sampler' ? SAMPLER_PARAMS : DRUM_PARAMS;
  return list.filter((s) => !s.when || s.when(config.params));
}
