import { PROJECT_VERSION, type Clip, type MixerSettings, type Note, type Project, type Track } from './types';
import { presetConfig, getPreset } from '../instruments/presets';
import { diatonicChord } from './theory';

let counter = 0;
export function uid(prefix = ''): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
}

export const TRACK_COLORS = ['#ff7a45', '#ffc53d', '#73d13d', '#36cfc9', '#4096ff', '#9254de', '#f759ab', '#ff4d4f'];

export function defaultMixer(overrides: Partial<MixerSettings> = {}): MixerSettings {
  return {
    volume: -6,
    pan: 0,
    mute: false,
    solo: false,
    eq: { low: 0, mid: 0, high: 0 },
    filter: { enabled: false, type: 'lowpass', cutoff: 8000, q: 0.7 },
    comp: { enabled: false, threshold: -18, ratio: 3 },
    sends: { reverb: 0, delay: 0 },
    ...overrides,
  };
}

export function createTrack(presetId: string, opts: { name?: string; color?: string; mixer?: Partial<MixerSettings> } = {}): Track {
  const preset = getPreset(presetId);
  if (!preset) throw new Error(`Unknown preset ${presetId}`);
  const isDrums = preset.category === 'Drums';
  return {
    id: uid('t'),
    name: opts.name ?? (isDrums ? 'Drums' : preset.name),
    color: opts.color ?? TRACK_COLORS[Math.floor(Math.random() * TRACK_COLORS.length)],
    kind: isDrums ? 'drums' : 'instrument',
    instrument: presetConfig(presetId),
    mixer: defaultMixer(opts.mixer),
    swing: true,
    clips: [],
  };
}

export function createClip(start: number, length: number, loopLength = length, notes: Note[] = [], name = 'Clip'): Clip {
  return { id: uid('c'), name, start, length, loopLength, notes };
}

export function note(pitch: number, start: number, duration: number, velocity = 0.8): Note {
  return { id: uid('n'), pitch, start, duration, velocity };
}

function baseProject(name: string): Project {
  const now = Date.now();
  return {
    id: uid('p'),
    name,
    version: PROJECT_VERSION,
    createdAt: now,
    updatedAt: now,
    bpm: 132,
    timeSignature: [4, 4],
    key: { root: 'F', scale: 'minor' },
    swing: 62,
    lengthBars: 16,
    loop: { enabled: true, startBar: 0, endBar: 16 },
    master: { volume: 0, reverb: { decay: 2.8, wet: 1 }, delay: { time: '8n.', feedback: 0.35 }, limiter: true },
    tracks: [],
  };
}

/** Empty session with a sensible UKG track layout and no notes. */
export function createEmptyProject(name = 'Untitled Groove'): Project {
  const p = baseProject(name);
  p.tracks = [
    createTrack('kit-ukg', { color: TRACK_COLORS[0], mixer: { volume: -4 } }),
    createTrack('bass-deep-sub', { name: 'Bass', color: TRACK_COLORS[4], mixer: { volume: -5 } }),
    createTrack('keys-tine-ep', { name: 'Chords', color: TRACK_COLORS[1], mixer: { volume: -8, sends: { reverb: 0.25, delay: 0.1 } } }),
  ];
  for (const t of p.tracks) t.clips.push(createClip(0, 16, 4, [], t.name));
  return p;
}

const steps = (pitch: number, pattern: string, velocities: Record<string, number> = { x: 0.95, o: 0.6, '-': 0.35 }): Note[] =>
  pattern
    .replace(/\s/g, '')
    .split('')
    .flatMap((c, i) => (c in velocities ? [note(pitch, i * 0.25, 0.25, velocities[c])] : []));

/** A 16-bar 2-step UK Garage loop at 132 BPM in F minor. */
export function createDemoProject(): Project {
  const p = baseProject('Late Night 2-Step');

  // ---------------------------------------------------------------- drums
  const drums = createTrack('kit-ukg', { color: TRACK_COLORS[0], mixer: { volume: -3 } });
  const drumNotes = [
    ...steps(36, 'x... .... ..x. .... x... .... ..x. ...o'),
    ...steps(38, '.... x... .... x... .... x... .... x...'),
    ...steps(39, '.... o... .... o... .... o... .... o.o.'),
    ...steps(37, '.... ...- .... .o.. .... ...- ..-. .o..'),
    ...steps(42, '..x- ..x- ..x- ..x- ..x- ..x- ..x- ..o.'),
    ...steps(46, '.... .... .... .... .... .... .... ..x.'),
    ...steps(70, '-o-- -o-- -o-- -o-- -o-- -o-- -o-- -o--'),
    ...steps(64, '.... .... .... ...- .... .... ..-. ....'),
  ];
  drums.clips.push(createClip(0, 64, 8, drumNotes, '2-Step Groove'));

  // ----------------------------------------------------------------- bass
  const bass = createTrack('bass-ukg', { name: 'Garage Bass', color: TRACK_COLORS[4], mixer: { volume: -4 } });
  const bassNotes = [
    note(29, 0, 0.5, 0.95), note(29, 0.75, 0.25, 0.7), note(41, 1.5, 0.25, 0.8), note(32, 2.5, 0.5, 0.85), note(36, 3.25, 0.5, 0.8),
    note(37, 4, 0.75, 0.95), note(37, 5, 0.25, 0.7), note(39, 5.75, 0.5, 0.85), note(36, 6.5, 0.5, 0.8), note(32, 7.25, 0.5, 0.75),
  ];
  bass.clips.push(createClip(0, 64, 8, bassNotes, 'Bounce'));

  // --------------------------------------------------------------- chords
  const keys = createTrack('keys-tine-ep', { name: 'Chords', color: TRACK_COLORS[1], mixer: { volume: -9, sends: { reverb: 0.3, delay: 0.12 } } });
  const fm9 = diatonicChord('F', 'minor', 0, 'minor9-house', 3);
  const dbmaj9 = diatonicChord('F', 'minor', 5, 'minor9-house', 3);
  const stab = (chord: number[], bar: number, hits: [number, number, number][]) =>
    hits.flatMap(([b, d, v]) => chord.map((pitch) => note(pitch, bar * 4 + b, d, v)));
  const chordHits: [number, number, number][] = [[0, 0.75, 0.85], [1.5, 0.25, 0.6], [2.25, 0.75, 0.75], [3.5, 0.25, 0.55]];
  keys.clips.push(createClip(0, 64, 8, [...stab(fm9, 0, chordHits), ...stab(dbmaj9, 1, chordHits)], 'Fm9 · Dbmaj9'));

  // ------------------------------------------------------------------ pad
  const pad = createTrack('syn-dark-pad', { name: 'Pad', color: TRACK_COLORS[5], mixer: { volume: -18, sends: { reverb: 0.45, delay: 0 } } });
  const padNotes = [
    ...diatonicChord('F', 'minor', 0, 'seventh', 3).map((n) => note(n, 0, 4, 0.6)),
    ...diatonicChord('F', 'minor', 5, 'seventh', 3).map((n) => note(n, 4, 4, 0.6)),
  ];
  pad.clips.push(createClip(32, 32, 8, padNotes, 'Pad'));

  p.tracks = [drums, bass, keys, pad];
  return p;
}
