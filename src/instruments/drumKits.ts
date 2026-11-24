import type { DrumLaneConfig } from '../model/types';
import type { DrumVoiceId } from './drumSynthesis';

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
  voices: Record<keyof typeof LANE_NOTES, DrumVoiceId>;
}

export const DRUM_KITS: DrumKit[] = [
  {
    id: 'kit-ukg',
    name: 'UK Garage 2-Step',
    description: 'Tight punchy kick, crisp band-passed snare, woody rim and sizzling hats.',
    tags: ['ukg', '2-step', 'speed garage'],
    voices: { kick: 'kick-ukg', snare: 'snare-ukg', clap: 'clap-ukg', rim: 'rim-ukg', closedHat: 'chh-ukg', openHat: 'ohh-ukg', shaker: 'shaker', perc: 'bongo' },
  },
  {
    id: 'kit-909',
    name: '909 House',
    description: 'Classic drum-machine house: driving kick, bright snare, noisy hats.',
    tags: ['house', '909', 'bass house'],
    voices: { kick: 'kick-909', snare: 'snare-909', clap: 'clap-909', rim: 'rim-909', closedHat: 'chh-909', openHat: 'ohh-909', shaker: 'shaker', perc: 'tom-909' },
  },
  {
    id: 'kit-808',
    name: '808 Classic',
    description: 'Long boomy kick, snappy snare, metallic hats and congas.',
    tags: ['808', 'garage', 'minimal'],
    voices: { kick: 'kick-808', snare: 'snare-808', clap: 'clap-808', rim: 'rim-808', closedHat: 'chh-808', openHat: 'ohh-808', shaker: 'shaker', perc: 'conga-808' },
  },
  {
    id: 'kit-deep',
    name: 'Deep House',
    description: 'Round warm kick, soft snare, roomy clap and gentle shakers.',
    tags: ['deep house', 'soulful', 'minimal'],
    voices: { kick: 'kick-deep', snare: 'snare-deep', clap: 'clap-deep', rim: 'rim-808', closedHat: 'chh-909', openHat: 'ohh-808', shaker: 'shaker-soft', perc: 'woodblock' },
  },
  {
    id: 'kit-speed',
    name: 'Speed Garage 4x4',
    description: 'Hard distorted kick, 909 snare, garage hats — for 4x4 and bass house.',
    tags: ['speed garage', 'bass house', '4x4'],
    voices: { kick: 'kick-speed', snare: 'snare-909', clap: 'clap-ukg', rim: 'rim-ukg', closedHat: 'chh-ukg', openHat: 'ohh-909', shaker: 'shaker', perc: 'cowbell-808' },
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
      source: { kind: 'synth' as const, voice: kit.voices[k] },
      tune: 0,
      decay: 1,
      level: k === 'kick' ? 0 : k === 'closedHat' || k === 'shaker' ? -6 : -3,
      pan: k === 'shaker' ? 0.25 : k === 'perc' ? -0.25 : k === 'openHat' ? 0.1 : 0,
      choke: k === 'closedHat' || k === 'openHat' ? 1 : undefined,
    }))
    .sort((a, b) => LANE_ORDER.indexOf(a.note) - LANE_ORDER.indexOf(b.note));
}
