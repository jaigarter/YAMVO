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
