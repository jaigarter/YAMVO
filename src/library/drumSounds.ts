import { DRUM_VOICES, type DrumVoiceId } from '../instruments/drumSynthesis';
import type { DrumLaneConfig } from '../model/types';
import drumKitsPack from '../../public/packs/drum-kits.json';
import percussionPack from '../../public/packs/gm-percussion.json';

/** Every sound a drum pad can load: synthesized voices and sampled one-shots. */
export interface DrumSound {
  /** `voice:<id>` for synthesized voices, `pack:<pack>/<zone>` for samples. */
  id: string;
  label: string;
  category: string;
  sampled: boolean;
}

type Zone = { id?: string; label?: string; category?: string };
const packSounds = (pack: string, zones: Zone[]): DrumSound[] =>
  zones.filter((z) => z.id).map((z) => ({ id: `pack:${pack}/${z.id}`, label: z.label!, category: z.category ?? 'Perc', sampled: true }));

export const DRUM_SOUNDS: DrumSound[] = [
  ...(Object.keys(DRUM_VOICES) as DrumVoiceId[]).map((v) => ({ id: `voice:${v}`, label: `${DRUM_VOICES[v].label} (synth)`, category: DRUM_VOICES[v].category, sampled: false })),
  ...packSounds('drum-kits', drumKitsPack.zones as Zone[]),
  ...packSounds('gm-percussion', percussionPack.zones as Zone[]),
];

export const DRUM_CATEGORIES = ['Kick', 'Snare', 'Clap', 'Rim', 'Closed Hat', 'Open Hat', 'Shaker', 'Perc', 'Cymbal'];

export function laneSoundId(lane: DrumLaneConfig): string {
  return lane.source.kind === 'synth' ? `voice:${lane.source.voice}` : lane.source.sampleId;
}

export function laneSoundLabel(lane: DrumLaneConfig): string {
  const id = laneSoundId(lane);
  return DRUM_SOUNDS.find((s) => s.id === id)?.label.replace(' (synth)', '') ?? (lane.source.kind === 'sample' ? 'Sample' : '');
}

/** Lane source for a sound id from DRUM_SOUNDS (or any library sample id). */
export function sourceFor(id: string): DrumLaneConfig['source'] {
  return id.startsWith('voice:') ? { kind: 'synth', voice: id.slice(6) } : { kind: 'sample', sampleId: id };
}
