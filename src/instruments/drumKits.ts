import type { DrumLaneConfig } from '../model/types';
import type { DrumVoiceId } from './drumSynthesis';

/** A lane sound: a synthesized voice id, or a sampled one-shot `pack:<pack>/<zone>`. */
export type KitSound = DrumVoiceId | `pack:${string}`;

/** General-MIDI drum notes used for the eight lanes. */
export const LANE_NOTES = {
  kick: 36,
  rim: 37,
  snare: 38,
  clap: 39,
  closedHat: 42,
  openHat: 46,
  perc: 64,
  shaker: 70,
} as const;

/** Display order (top → bottom) in the step sequencer. */
export const LANE_ORDER = [36, 38, 39, 37, 42, 46, 70, 64];

export interface DrumKit {
  id: string;
  name: string;
  description: string;
  tags: string[];
  voices: Record<keyof typeof LANE_NOTES, KitSound>;
}

/**
 * Hybrid kits: synthesized kicks (punchy, tunable) with sampled drum-machine
 * hats, rims, shakers and percussion (FluidR3 808 / Electronic / Standard kits).
 */
export const DRUM_KITS: DrumKit[] = [
  {
    id: 'kit-ukg',
    name: 'UK Garage 2-Step',
    description: 'Tight punchy kick, crisp 808 snare and hats, woody rim, maracas and bongos.',
    tags: ['ukg', '2-step', 'speed garage'],
    voices: { kick: 'kick-ukg', snare: 'pack:drum-kits/808-snare', clap: 'clap-ukg', rim: 'pack:drum-kits/808-rim', closedHat: 'pack:drum-kits/808-closed-hat', openHat: 'pack:drum-kits/808-open-hat', shaker: 'pack:drum-kits/808-maracas', perc: 'pack:gm-percussion/bongo-hi' },
  },
  {
    id: 'kit-909',
    name: '909 House',
    description: 'Driving kick, bright snare and clap, crisp hats and a tambourine.',
    tags: ['house', '909', 'bass house'],
    voices: { kick: 'kick-909', snare: 'snare-909', clap: 'clap-909', rim: 'pack:drum-kits/acoustic-side-stick', closedHat: 'pack:drum-kits/acoustic-closed-hat', openHat: 'pack:drum-kits/acoustic-open-hat', shaker: 'pack:drum-kits/acoustic-tambourine', perc: 'tom-909' },
  },
  {
    id: 'kit-808',
    name: '808 Classic',
    description: 'Long boomy kick with the classic 808 snare, clap, hats, congas and cowbell.',
    tags: ['808', 'garage', 'minimal'],
    voices: { kick: 'kick-808', snare: 'pack:drum-kits/808-snare-2', clap: 'pack:drum-kits/808-clap', rim: 'pack:drum-kits/808-rim', closedHat: 'pack:drum-kits/808-closed-hat', openHat: 'pack:drum-kits/808-open-hat', shaker: 'pack:drum-kits/808-maracas', perc: 'pack:drum-kits/808-conga-hi' },
  },
  {
    id: 'kit-deep',
    name: 'Deep House',
    description: 'Round warm kick, soft snare, roomy clap, crisp hats, shaker and congas.',
    tags: ['deep house', 'soulful', 'minimal'],
    voices: { kick: 'kick-deep', snare: 'snare-deep', clap: 'clap-deep', rim: 'pack:drum-kits/acoustic-side-stick', closedHat: 'pack:drum-kits/acoustic-closed-hat', openHat: 'pack:drum-kits/acoustic-open-hat', shaker: 'pack:gm-percussion/maracas', perc: 'pack:gm-percussion/conga-mute' },
  },
  {
    id: 'kit-speed',
    name: 'Speed Garage 4x4',
    description: 'Hard distorted kick, electronic snare, 808 hats and cowbell — 4x4 and bass house.',
    tags: ['speed garage', 'bass house', '4x4'],
    voices: { kick: 'kick-speed', snare: 'pack:drum-kits/elec-snare', clap: 'clap-ukg', rim: 'pack:drum-kits/808-rim', closedHat: 'pack:drum-kits/808-closed-hat', openHat: 'pack:drum-kits/elec-open-hat', shaker: 'pack:drum-kits/808-maracas', perc: 'pack:drum-kits/808-cowbell' },
  },
];

const LANE_LABELS: Record<keyof typeof LANE_NOTES, string> = {
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  rim: 'Rim',
  closedHat: 'Closed HH',
  openHat: 'Open HH',
  shaker: 'Shaker',
  perc: 'Perc',
};

export function kitLanes(kitId: string): DrumLaneConfig[] {
  const kit = DRUM_KITS.find((k) => k.id === kitId) ?? DRUM_KITS[0];
  return (Object.keys(LANE_NOTES) as (keyof typeof LANE_NOTES)[])
    .map((k) => ({
      note: LANE_NOTES[k],
      name: LANE_LABELS[k],
      source: kit.voices[k].startsWith('pack:')
        ? ({ kind: 'sample', sampleId: kit.voices[k] } as const)
        : ({ kind: 'synth', voice: kit.voices[k] } as const),
      tune: 0,
      decay: 1,
      level: k === 'kick' ? 0 : k === 'closedHat' || k === 'shaker' ? -6 : -3,
      pan: k === 'shaker' ? 0.25 : k === 'perc' ? -0.25 : k === 'openHat' ? 0.1 : 0,
      choke: k === 'closedHat' || k === 'openHat' ? 1 : undefined,
    }))
    .sort((a, b) => LANE_ORDER.indexOf(a.note) - LANE_ORDER.indexOf(b.note));
}
