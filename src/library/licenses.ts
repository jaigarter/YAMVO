/**
 * Licence and attribution registry for every audio resource and audio
 * dependency shipped with GROOVE LAB. Every library item references one of
 * these ids. New packs must be added here (and to CREDITS.md) before use.
 */

export interface ResourceLicense {
  id: string;
  name: string;
  author: string;
  license: string;
  url?: string;
  attribution?: string;
  notes?: string;
}

export const LICENSES: ResourceLicense[] = [
  {
    id: 'groove-lab-factory',
    name: 'GROOVE LAB factory sounds',
    author: 'GROOVE LAB',
    license: 'CC0-1.0',
    notes:
      'All drum voices and instrument presets are generated in real time by synthesis code in this repository (src/instruments). No third-party recordings are used.',
  },
  {
    id: 'user-import',
    name: 'User imported audio',
    author: 'You',
    license: 'Your own',
    notes: 'Files you import stay in this browser (IndexedDB) and are never uploaded. You are responsible for their rights.',
  },
  {
    id: 'salamander',
    name: 'Salamander Grand Piano V2',
    author: 'Alexander Holm',
    license: 'CC-BY-3.0',
    url: 'https://github.com/Tonejs/audio/tree/master/salamander',
    attribution: 'Salamander Grand Piano by Alexander Holm, licensed CC BY 3.0',
    notes: 'Grand Piano. Converted to mono MP3, one zone every minor third.',
  },
  {
    id: 'jrhodes',
    name: 'jRhodes3',
    author: 'Jeff Learman',
    license: 'CC-BY-4.0',
    url: 'https://github.com/sfzinstruments/jlearman.jRhodes3d',
    attribution: 'Samples from jRhodes3d — github.com/sfzinstruments/jlearman.jRhodes3d (CC BY 4.0)',
    notes: 'Rhodes Mark I. Three of the five velocity layers, converted to MP3.',
  },
  {
    id: 'fluidr3',
    name: 'FluidR3Mono GM',
    author: 'Frank Wen; Michael Cowgill; S. Christian Collins',
    license: 'MIT',
    url: 'https://github.com/musescore/MuseScore/tree/3.6.2/share/sound',
    attribution: 'FluidR3 © 2000-2002 Frank Wen; FluidR3Mono © 2014-17 Michael Cowgill; MS_General © 2018 S. Christian Collins (MIT)',
    notes: 'House piano, electric grand, DX piano, mallets, guitars, basses, strings, brass, sax, flute, choirs, pad and world percussion, rendered with FluidSynth.',
  },
  {
    id: 'tone-js',
    name: 'Tone.js',
    author: 'Yotam Mann and contributors',
    license: 'MIT',
    url: 'https://github.com/Tonejs/Tone.js',
    notes: 'Audio framework (software, not sounds).',
  },
];

export function licenseFor(id: string): ResourceLicense | undefined {
  return LICENSES.find((l) => l.id === id);
}
