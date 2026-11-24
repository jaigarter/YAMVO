import { DRUM_VOICES, type DrumVoiceId } from '../instruments/drumSynthesis';
import { PRESETS } from '../instruments/presets';
import type { UserSampleMeta } from './sampleStore';

export type LibraryKind = 'sample' | 'preset';

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  name: string;
  /** Top-level group: Drums, Bass, Keys, Synths, Imported… */
  category: string;
  /** Sub-type: Kick, Snare, Pads… */
  type: string;
  tags: string[];
  description?: string;
  /** Resource id in licenses.ts */
  license: string;
}

export const GENRES = ['ukg', '2-step', 'speed garage', 'house', 'deep house', 'minimal', 'bass house', 'soulful'];

export function factoryItems(): LibraryItem[] {
  const voices: LibraryItem[] = (Object.keys(DRUM_VOICES) as DrumVoiceId[]).map((id) => {
    const v = DRUM_VOICES[id];
    return {
      id: `voice:${id}`,
      kind: 'sample',
      name: v.label,
      category: 'Drums',
      type: v.category,
      tags: v.tags,
      license: 'groove-lab-factory',
    };
  });
  const presets: LibraryItem[] = PRESETS.map((p) => ({
    id: p.id,
    kind: 'preset',
    name: p.name,
    category: p.category,
    type: p.family,
    tags: p.tags,
    description: p.description,
    license: 'groove-lab-factory',
  }));
  return [...presets, ...voices];
}

export function userItems(samples: UserSampleMeta[]): LibraryItem[] {
  return samples.map((s) => ({
    id: s.id,
    kind: 'sample',
    name: s.name,
    category: 'Imported',
    type: s.category,
    tags: s.tags,
    license: 'user-import',
  }));
}

/** All-terms match over name, category, type and tags. */
export function searchLibrary(items: LibraryItem[], query: string, filters: { category?: string; genre?: string } = {}): LibraryItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((it) => {
    if (filters.category && it.category !== filters.category) return false;
    if (filters.genre && !it.tags.some((t) => t === filters.genre)) return false;
    if (!terms.length) return true;
    const hay = [it.name, it.category, it.type, ...it.tags, it.description ?? ''].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
