import type { InstrumentConfig, ParamValue } from '../model/types';
import { DRUM_KITS } from './drumKits';

export type PresetCategory = 'Drums' | 'Bass' | 'Keys' | 'Synths';

export interface InstrumentPreset {
  id: string;
  name: string;
  category: PresetCategory;
  /** Sub-category shown in the browser (e.g. "Sub Bass", "Pads"). */
  family: string;
  description: string;
  tags: string[];
  /** Default octave range for new notes (used by generators/piano roll focus). */
  focusNote: number;
  config: InstrumentConfig;
}

const synth = (params: Record<string, ParamValue>): InstrumentConfig => ({ type: 'synth', presetId: '', params });
const organ = (params: Record<string, ParamValue>): InstrumentConfig => ({ type: 'organ', presetId: '', params });

const drawbars = (reg: string): Record<string, number> =>
  Object.fromEntries(reg.split('').map((c, i) => [`db${i + 1}`, Number(c)]));

export const PRESETS: InstrumentPreset[] = [
  // ------------------------------------------------------------------ Drums
  ...DRUM_KITS.map<InstrumentPreset>((k) => ({
    id: k.id,
    name: k.name,
    category: 'Drums',
    family: 'Drum Kits',
    description: k.description,
    tags: k.tags,
    focusNote: 36,
    config: { type: 'drum-machine', presetId: k.id, params: { level: 0 } },
  })),

  // ------------------------------------------------------------------- Bass
  {
    id: 'bass-deep-sub', name: 'Deep Sub', category: 'Bass', family: 'Sub Bass', focusNote: 33,
    description: 'Pure, round sub with a touch of warmth. Sits under everything.',
    tags: ['deep house', 'ukg', 'sub'],
    config: synth({ engine: 'subtractive', osc: 'sine', mono: true, glide: 0.02, cutoff: 400, resonance: 0.7, envAmount: 0.5, fDecay: 0.2, fSustain: 0.5, attack: 0.004, decay: 0.3, sustain: 0.9, release: 0.12, drive: 0.12, level: -7 }),
  },
  {
    id: 'bass-ukg', name: 'Garage Bass', category: 'Bass', family: 'UK Garage Bass', focusNote: 33,
    description: 'Bouncy filtered saw with a plucky envelope — the classic 2-step bounce.',
    tags: ['ukg', '2-step', 'bouncy'],
    config: synth({ engine: 'subtractive', osc: 'sawtooth', mono: true, glide: 0.015, cutoff: 160, resonance: 4, envAmount: 3.4, fAttack: 0.002, fDecay: 0.17, fSustain: 0.15, attack: 0.003, decay: 0.35, sustain: 0.6, release: 0.08, drive: 0.25, level: -6 }),
  },
  {
    id: 'bass-reese', name: 'Reese', category: 'Bass', family: 'Reese Bass', focusNote: 33,
    description: 'Detuned saws phasing against each other with slow filter movement.',
    tags: ['speed garage', 'bass house', 'dark'],
    config: synth({ engine: 'subtractive', osc: 'sawtooth', unison: 3, detune: 32, mono: true, glide: 0.04, cutoff: 520, resonance: 2, envAmount: 1, fDecay: 0.6, fSustain: 0.6, attack: 0.005, decay: 0.5, sustain: 0.85, release: 0.2, drive: 0.35, movement: 0.45, movementRate: 0.25, level: -8 }),
  },
  {
    id: 'bass-organ', name: 'Organ Bass', category: 'Bass', family: 'Organ Bass', focusNote: 36,
    description: 'Short, punchy drawbar organ bass — the 90s house/garage staple.',
    tags: ['house', 'ukg', 'organ', '90s'],
    config: organ({ ...drawbars('808400000'), perc: 0.6, percHarm: 'second', percDecay: 0.18, release: 0.05, rotary: 0, drive: 0.25, level: -7 }),
  },
  {
    id: 'bass-rolling', name: 'Rolling Bass', category: 'Bass', family: 'Rolling Bass', focusNote: 33,
    description: 'Tight square-wave bass with a fast filter snap for rolling 16th lines.',
    tags: ['deep house', 'minimal', 'rolling'],
    config: synth({ engine: 'subtractive', osc: 'square', mono: true, cutoff: 220, resonance: 3, envAmount: 2.6, fDecay: 0.11, fSustain: 0.1, attack: 0.002, decay: 0.18, sustain: 0.35, release: 0.06, drive: 0.15, level: -4.5 }),
  },
  {
    id: 'bass-synth', name: 'Synth Bass', category: 'Bass', family: 'Synth Bass', focusNote: 33,
    description: 'Resonant saw bass with an acid-tinged filter envelope.',
    tags: ['house', 'bass house', 'acid'],
    config: synth({ engine: 'subtractive', osc: 'sawtooth', mono: true, glide: 0.05, cutoff: 300, resonance: 8, envAmount: 3.2, fDecay: 0.22, fSustain: 0.2, attack: 0.003, decay: 0.3, sustain: 0.5, release: 0.1, drive: 0.4, level: -7 }),
  },
  {
    id: 'bass-808', name: '808 Bass', category: 'Bass', family: 'Sub Bass', focusNote: 33,
    description: 'Long sine sub with saturation and glide — bass house & speed garage.',
    tags: ['bass house', 'speed garage', '808'],
    config: synth({ engine: 'subtractive', osc: 'sine', mono: true, glide: 0.06, cutoff: 900, resonance: 0.7, envAmount: 0, attack: 0.003, decay: 1.4, sustain: 0.4, release: 0.25, drive: 0.55, level: -9.5 }),
  },

  // ------------------------------------------------------------------- Keys
  {
    id: 'keys-tine-ep', name: 'Tine EP', category: 'Keys', family: 'Electric Piano', focusNote: 60,
    description: 'FM electric piano: warm body, bell-like tine and gentle stereo tremolo.',
    tags: ['deep house', 'soulful', 'rhodes-style', 'chords'],
    config: synth({ engine: 'epiano', bark: 2.4, tine: 0.35, modDecay: 0.7, modSustain: 0.12, attack: 0.002, decay: 2.2, sustain: 0.25, release: 0.5, tremolo: 0.35, tremRate: 4.2, chorus: 0.25, level: -2 }),
  },
  {
    id: 'keys-dyno-ep', name: 'Bright EP', category: 'Keys', family: 'Electric Piano', focusNote: 60,
    description: 'Brighter, barkier FM piano that cuts through a garage mix.',
    tags: ['ukg', 'soulful', 'bright'],
    config: synth({ engine: 'epiano', bark: 4.5, tine: 0.55, modDecay: 0.5, modSustain: 0.2, attack: 0.001, decay: 1.6, sustain: 0.2, release: 0.4, tremolo: 0.15, tremRate: 5, chorus: 0.4, drive: 0.1, level: 1 }),
  },
  {
    id: 'keys-house-stab', name: 'House Keys', category: 'Keys', family: 'House Piano', focusNote: 60,
    description: 'Percussive FM keys voiced for classic house piano stabs.',
    tags: ['house', 'piano', 'stab', '90s'],
    config: synth({ engine: 'fm', harmonicity: 2, modIndex: 9, modWave: 'sine', modDecay: 0.35, modSustain: 0.05, attack: 0.001, decay: 0.9, sustain: 0.05, release: 0.35, chorus: 0.2, level: -2 }),
  },
  {
    id: 'keys-organ-house', name: 'House Organ', category: 'Keys', family: 'Organ', focusNote: 60,
    description: 'Bright drawbar organ with 3rd-harmonic percussion and slow rotary.',
    tags: ['house', 'organ', 'stabs'],
    config: organ({ ...drawbars('888000000'), perc: 0.55, percHarm: 'third', percDecay: 0.3, rotary: 0.6, rotarySpeed: 'slow', drive: 0.15, level: 0 }),
  },
  {
    id: 'keys-organ-gospel', name: 'Gospel Organ', category: 'Keys', family: 'Organ', focusNote: 60,
    description: 'Full drawbars with fast rotary — soulful house builds.',
    tags: ['soulful house', 'gospel', 'organ'],
    config: organ({ ...drawbars('888808008'), perc: 0, rotary: 0.8, rotarySpeed: 'fast', drive: 0.3, level: -0.5 }),
  },
  {
    id: 'keys-organ-soft', name: 'Soft Organ', category: 'Keys', family: 'Organ', focusNote: 60,
    description: 'Mellow flute-like drawbars for deep, warm chord beds.',
    tags: ['deep house', 'organ', 'mellow'],
    config: organ({ ...drawbars('008600000'), perc: 0, rotary: 0.5, rotarySpeed: 'slow', drive: 0, level: -8.5 }),
  },
  {
    id: 'keys-chord-stab', name: 'Deep Chord Stab', category: 'Keys', family: 'Chord Stabs', focusNote: 60,
    description: 'Filtered detuned saws with a short envelope — dub/deep house stabs.',
    tags: ['deep house', 'minimal', 'dub', 'stab'],
    config: synth({ engine: 'subtractive', osc: 'sawtooth', unison: 3, detune: 18, cutoff: 700, resonance: 2, envAmount: 2.6, fDecay: 0.22, fSustain: 0, attack: 0.003, decay: 0.4, sustain: 0, release: 0.3, chorus: 0.3, level: -2 }),
  },
  {
    id: 'keys-garage-stab', name: 'Garage Stab', category: 'Keys', family: 'Chord Stabs', focusNote: 60,
    description: 'Bright square-wave chord stab for shuffled garage chord hits.',
    tags: ['ukg', '2-step', 'stab'],
    config: synth({ engine: 'subtractive', osc: 'square', unison: 2, detune: 12, cutoff: 1400, resonance: 1.5, envAmount: 2, fDecay: 0.15, fSustain: 0.1, attack: 0.002, decay: 0.25, sustain: 0.1, release: 0.2, chorus: 0.35, level: -4 }),
  },

  // ----------------------------------------------------------------- Synths
  {
    id: 'syn-warm-pad', name: 'Warm Pad', category: 'Synths', family: 'Pads', focusNote: 60,
    description: 'Slow-blooming detuned saws, chorus and gentle filter motion.',
    tags: ['deep house', 'soulful', 'pad', 'warm'],
    config: synth({ engine: 'subtractive', osc: 'sawtooth', unison: 4, detune: 24, cutoff: 1100, resonance: 0.8, envAmount: 1, fAttack: 0.8, fDecay: 1.5, fSustain: 0.6, attack: 0.7, decay: 1, sustain: 0.85, release: 1.8, chorus: 0.5, movement: 0.25, movementRate: 0.15, level: -3 }),
  },
  {
    id: 'syn-dark-pad', name: 'Dark Pad', category: 'Synths', family: 'Pads', focusNote: 57,
    description: 'Low, moody square pad with slow-moving filter — dark garage.',
    tags: ['ukg', 'dark', 'pad'],
    config: synth({ engine: 'subtractive', osc: 'square', unison: 3, detune: 15, cutoff: 480, resonance: 2.5, envAmount: 0.8, fAttack: 1.2, fDecay: 2, fSustain: 0.5, attack: 1, decay: 1, sustain: 0.9, release: 2.2, chorus: 0.35, movement: 0.55, movementRate: 0.1, level: -7 }),
  },
  {
    id: 'syn-glass-pluck', name: 'Glass Pluck', category: 'Synths', family: 'Plucks', focusNote: 72,
    description: 'Crystalline FM pluck for arpeggios and top lines.',
    tags: ['house', 'pluck', 'bright'],
    config: synth({ engine: 'fm', harmonicity: 3, modIndex: 6, modDecay: 0.18, modSustain: 0, attack: 0.001, decay: 0.45, sustain: 0, release: 0.3, chorus: 0.3, level: -1 }),
  },
  {
    id: 'syn-garage-pluck', name: 'Garage Pluck', category: 'Synths', family: 'Plucks', focusNote: 67,
    description: 'Short filtered saw pluck — shuffled garage riffs.',
    tags: ['ukg', '2-step', 'pluck'],
    config: synth({ engine: 'subtractive', osc: 'sawtooth', unison: 2, detune: 10, cutoff: 350, resonance: 3, envAmount: 4.5, fDecay: 0.14, fSustain: 0, attack: 0.001, decay: 0.25, sustain: 0, release: 0.15, chorus: 0.2, level: -2 }),
  },
  {
    id: 'syn-analog-lead', name: 'Analog Lead', category: 'Synths', family: 'Leads', focusNote: 72,
    description: 'Mono saw lead with glide and a resonant edge.',
    tags: ['house', 'lead'],
    config: synth({ engine: 'subtractive', osc: 'sawtooth', unison: 2, detune: 8, mono: true, glide: 0.06, cutoff: 1800, resonance: 3, envAmount: 1.5, fDecay: 0.4, fSustain: 0.5, attack: 0.005, decay: 0.3, sustain: 0.8, release: 0.25, drive: 0.15, level: -6 }),
  },
  {
    id: 'syn-soft-lead', name: 'Soft Lead', category: 'Synths', family: 'Leads', focusNote: 72,
    description: 'Gentle triangle lead with chorus for soulful hooks.',
    tags: ['soulful', 'lead', 'soft'],
    config: synth({ engine: 'subtractive', osc: 'triangle', cutoff: 3000, resonance: 0.7, envAmount: 0.5, attack: 0.02, decay: 0.4, sustain: 0.7, release: 0.4, chorus: 0.45, level: -5 }),
  },
  {
    id: 'syn-analog-poly', name: 'Analog Poly', category: 'Synths', family: 'Analog Synth', focusNote: 60,
    description: 'Classic polysynth brass/strings — versatile chords.',
    tags: ['house', 'analog', 'poly'],
    config: synth({ engine: 'subtractive', osc: 'sawtooth', unison: 2, detune: 14, cutoff: 900, resonance: 1.2, envAmount: 2, fAttack: 0.05, fDecay: 0.6, fSustain: 0.4, attack: 0.02, decay: 0.5, sustain: 0.7, release: 0.6, chorus: 0.4, level: -6 }),
  },
  {
    id: 'syn-arp', name: 'Arp Synth', category: 'Synths', family: 'Arpeggiators', focusNote: 72,
    description: 'Tight square pluck designed for fast 16th-note sequences.',
    tags: ['house', 'arp', 'sequence'],
    config: synth({ engine: 'subtractive', osc: 'square', cutoff: 600, resonance: 4, envAmount: 3.5, fDecay: 0.09, fSustain: 0, attack: 0.001, decay: 0.12, sustain: 0, release: 0.1, chorus: 0.15, level: -2 }),
  },
  {
    id: 'syn-atmos', name: 'Atmosphere', category: 'Synths', family: 'Atmospheric Textures', focusNote: 60,
    description: 'Evolving inharmonic FM texture with heavy movement — intros & breaks.',
    tags: ['atmos', 'texture', 'ambient', 'dark'],
    config: synth({ engine: 'fm', harmonicity: 3.5, modIndex: 12, modWave: 'triangle', modDecay: 3, modSustain: 0.6, attack: 2, decay: 2, sustain: 0.8, release: 3, chorus: 0.6, movement: 0.7, movementRate: 0.08, level: -6 }),
  },
];

export function getPreset(id: string): InstrumentPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Instrument config for a preset, with the preset id filled in. */
export function presetConfig(id: string): InstrumentConfig {
  const p = getPreset(id);
  if (!p) throw new Error(`Unknown preset ${id}`);
  return { ...structuredClone(p.config), presetId: p.id };
}
