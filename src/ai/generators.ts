/**
 * Local, free "producer" generators. They encode common UK Garage / House
 * conventions (kick placement, shuffled hats, offbeat bass, stab rhythms,
 * minor-9th voicings, call-and-response hooks) with controlled randomness,
 * and return the same commands Claude would, so results are fully editable.
 */
import type { Project, Track } from '../model/types';
import type { Command, NoteTuple } from './commands';
import { diatonicChord, pitchClassIndex, SCALES, type ChordQuality } from '../model/theory';
import { getPreset } from '../instruments/presets';

export type Style = 'ukg' | 'speed-garage' | 'house' | 'deep-house' | 'minimal' | 'bass-house';
export type Role = 'drums' | 'bass' | 'chords' | 'melody';

export const STYLES: { id: Style; label: string; bpm: number; swing: number }[] = [
  { id: 'ukg', label: 'UK Garage 2-step', bpm: 132, swing: 62 },
  { id: 'speed-garage', label: 'Speed Garage 4×4', bpm: 134, swing: 56 },
  { id: 'house', label: 'House', bpm: 124, swing: 54 },
  { id: 'deep-house', label: 'Deep House', bpm: 121, swing: 56 },
  { id: 'minimal', label: 'Minimal House', bpm: 125, swing: 55 },
  { id: 'bass-house', label: 'Bass House', bpm: 126, swing: 52 },
];

const STYLE_SOUNDS: Record<Style, Record<Role, string>> = {
  ukg: { drums: 'kit-ukg', bass: 'bass-ukg', chords: 'smp-rhodes', melody: 'smp-voice-oohs' },
  'speed-garage': { drums: 'kit-speed', bass: 'bass-reese', chords: 'keys-garage-stab', melody: 'syn-garage-pluck' },
  house: { drums: 'kit-909', bass: 'bass-organ', chords: 'smp-house-piano', melody: 'syn-glass-pluck' },
  'deep-house': { drums: 'kit-deep', bass: 'bass-deep-sub', chords: 'keys-chord-stab', melody: 'smp-vibes' },
  minimal: { drums: 'kit-808', bass: 'bass-rolling', chords: 'keys-chord-stab', melody: 'syn-arp' },
  'bass-house': { drums: 'kit-speed', bass: 'bass-808', chords: 'smp-orch-stab', melody: 'syn-analog-lead' },
};

export const ROLE_NAMES: Record<Role, string> = { drums: 'Drums', bass: 'Bass', chords: 'Chords', melody: 'Hook' };

// -------------------------------------------------------------- randomness

export function rng(seed = Date.now()) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p: number) => next() < p,
    pick: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    vel: (base: number, spread = 0.06) => Math.min(1, Math.max(0.1, base + (next() * 2 - 1) * spread)),
  };
}
type Rng = ReturnType<typeof rng>;

/** Musical role of a track, from its instrument. */
export function trackRole(t: Track): Role {
  if (t.kind === 'drums') return 'drums';
  if (/hook|lead|melod|vox|vocal|chop|top ?line/i.test(t.name)) return 'melody';
  const preset = getPreset(t.instrument.presetId);
  if (preset?.category === 'Bass') return 'bass';
  const fam = preset?.family ?? '';
  if (/Lead|Pluck|Arp|Solo|Mallets|Guitar|World/.test(fam) || preset?.category === 'Guitar & World') return 'melody';
  return 'chords';
}

// ------------------------------------------------------------------ drums

const steps = (pattern: string) =>
  pattern
    .replace(/\s/g, '')
    .split('')
    .map((c, i) => [c, i] as const)
    .filter(([c]) => c !== '.');

function drumHits(name: string, pattern: string, r: Rng, vel: Record<string, number> = { x: 0.95, o: 0.65, '-': 0.38 }, offsetBeats = 0): NoteTuple[] {
  return steps(pattern).map(([c, i]) => [name, offsetBeats + i * 0.25, 0.25, r.vel(vel[c] ?? 0.8)]);
}

export function generateDrums(style: Style, r: Rng): NoteTuple[] {
  const n: NoteTuple[] = [];
  const bar = (b: number) => b * 4;
  switch (style) {
    case 'ukg': {
      const kick2 = r.pick(['x... .... ..x. ..o.', 'x... .... ..x. ....', 'x... ...o ..x. ....']);
      n.push(...drumHits('kick', 'x... .... ..x. ....', r), ...drumHits('kick', kick2, r, undefined, bar(1)));
      for (const b of [0, 1]) {
        n.push(...drumHits('snare', '.... x... .... x...', r, undefined, bar(b)));
        n.push(...drumHits('clap', r.chance(0.5) ? '.... o... .... o...' : '.... .... .... o...', r, undefined, bar(b)));
        n.push(...drumHits('chh', r.pick(['..x- ..x- ..x- ..x-', '..x. ..x- ..x. ..xo', '..x- .-x- ..x- ..x-']), r, undefined, bar(b)));
        n.push(...drumHits('shaker', '-o-- -o-- -o-- -o--', r, undefined, bar(b)));
        n.push(...drumHits('rim', r.pick(['.... ...- .... .o..', '...- .... ..-. .o..', '.... ...- ...- ....']), r, undefined, bar(b)));
      }
      if (r.chance(0.7)) n.push(...drumHits('ohh', '.... .... .... ..x.', r, undefined, bar(1)));
      if (r.chance(0.6)) n.push(...drumHits('perc', '.... .... ..-. ...-', r, undefined, bar(1)));
      break;
    }
    case 'speed-garage':
    case 'bass-house':
    case 'house':
    case 'deep-house':
    case 'minimal': {
      const soft = style === 'deep-house' || style === 'minimal';
      for (const b of [0, 1]) {
        n.push(...drumHits('kick', 'x... x... x... x...', r, { x: soft ? 0.88 : 0.97 }, bar(b)));
        if (style === 'minimal') {
          n.push(...drumHits('clap', b === 1 ? '.... .... .... o...' : '.... .... .... ....', r, undefined, bar(b)));
          n.push(...drumHits('rim', r.pick(['..-. ...- .-.. ..-.', '.-.. ..-. ...- .-..']), r, undefined, bar(b)));
          n.push(...drumHits('chh', r.pick(['..x. ..x. ..x. ..x.', '.-x- .-x- .-x- .-x-']), r, undefined, bar(b)));
        } else {
          n.push(...drumHits(style === 'deep-house' ? 'snare' : 'clap', '.... x... .... x...', r, { x: soft ? 0.8 : 0.95 }, bar(b)));
          n.push(...drumHits('ohh', '..x. ..x. ..x. ..x.', r, { x: soft ? 0.6 : 0.85 }, bar(b)));
          n.push(...drumHits('chh', style === 'speed-garage' ? 'o-o- o-o- o-o- o-o-' : r.pick(['-.-- -.-- -.-- -.--', '.... .... .... ....', '--o- --o- --o- --o-']), r, undefined, bar(b)));
        }
        n.push(...drumHits('shaker', soft ? '-o-- -o-- -o-- -o--' : '-o-o -o-o -o-o -o-o', r, { o: 0.5, '-': 0.3 }, bar(b)));
      }
      if (style !== 'minimal' && r.chance(0.6)) n.push(...drumHits('perc', r.pick(['.... ..-. .... -...', '...- .... ..-. ....']), r, undefined, bar(1)));
      if (style === 'bass-house') n.push(...drumHits('snare', '.... .... .... ..o.', r, undefined, bar(1)));
      break;
    }
  }
  return n;
}

// ------------------------------------------------------------------ harmony

type Prog = [number, ChordQuality][];
const MINOR_PROGS: Record<Style, Prog[]> = {
  ukg: [[[0, 'minor9-house'], [5, 'minor9-house']], [[0, 'minor9-house'], [3, 'minor9-house'], [5, 'minor9-house'], [4, 'seventh']]],
  'speed-garage': [[[0, 'seventh'], [0, 'seventh'], [5, 'seventh'], [6, 'seventh']], [[0, 'triad'], [6, 'triad'], [5, 'triad'], [6, 'triad']]],
  house: [[[0, 'seventh'], [5, 'seventh'], [2, 'seventh'], [6, 'seventh']], [[0, 'ninth'], [3, 'seventh'], [6, 'seventh'], [2, 'seventh']]],
  'deep-house': [[[0, 'minor9-house'], [3, 'minor9-house']], [[0, 'minor9-house'], [6, 'minor9-house'], [5, 'minor9-house'], [3, 'minor9-house']]],
  minimal: [[[0, 'minor9-house']], [[0, 'minor9-house'], [3, 'minor9-house']]],
  'bass-house': [[[0, 'triad'], [0, 'triad'], [5, 'triad'], [6, 'triad']]],
};
const MAJOR_PROGS: Prog[] = [
  [[0, 'seventh'], [5, 'seventh'], [3, 'seventh'], [4, 'seventh']],
  [[3, 'seventh'], [2, 'seventh'], [1, 'seventh'], [0, 'seventh']],
  [[1, 'ninth'], [4, 'seventh'], [0, 'ninth'], [0, 'ninth']],
];

export interface Harmony {
  /** One chord per bar (4 bars). */
  chords: number[][];
  roots: number[];
}

function isMinorish(scale: string) {
  return SCALES[scale as keyof typeof SCALES].intervals[2] === 3 || scale === 'minorPentatonic';
}

/** Picks a progression and voice-leads it around middle C. */
export function generateHarmony(p: Project, style: Style, r: Rng): Harmony {
  const scale = p.key.scale === 'minorPentatonic' ? 'minor' : p.key.scale;
  const prog = r.pick(isMinorish(p.key.scale) ? MINOR_PROGS[style] : MAJOR_PROGS);
  const bars: Prog = Array.from({ length: 4 }, (_, i) => prog[i % prog.length]);
  let centre = 62;
  const chords = bars.map(([deg, q]) => {
    const raw = diatonicChord(p.key.root, scale, deg, q, 3);
    const voiced = raw.map((n) => {
      let best = n;
      for (const k of [-24, -12, 0, 12, 24]) if (Math.abs(n + k - centre) < Math.abs(best - centre)) best = n + k;
      return best;
    });
    voiced.sort((a, b) => a - b);
    centre = voiced.reduce((a, b) => a + b, 0) / voiced.length;
    return [...new Set(voiced)];
  });
  const rootPc = pitchClassIndex(p.key.root);
  const roots = bars.map(([deg]) => {
    const iv = SCALES[scale].intervals;
    let root = 24 + rootPc + iv[deg % iv.length] + 12 * Math.floor(deg / iv.length);
    while (root > 38) root -= 12;
    while (root < 26) root += 12;
    return root;
  });
  return { chords, roots };
}

const CHORD_RHYTHMS: Record<Style, [number, number][][]> = {
  ukg: [[[0, 0.75], [1.5, 0.25], [2.25, 0.75], [3.5, 0.25]], [[0, 0.5], [0.75, 0.25], [2, 0.5], [2.75, 1]]],
  'speed-garage': [[[0.5, 0.25], [1.5, 0.25], [2.5, 0.25], [3.5, 0.25]]],
  house: [[[0, 0.5], [0.75, 0.25], [1.5, 0.5], [2.5, 0.25], [3, 0.5]], [[0.5, 0.25], [1.5, 0.25], [2.5, 0.25], [3.5, 0.25]]],
  'deep-house': [[[0, 1.5], [1.75, 0.25], [2.5, 1.25]], [[0, 0.5], [1.5, 0.25], [2.25, 1.5]]],
  minimal: [[[0.75, 0.25], [2.5, 0.25]], [[0.5, 0.25], [1.75, 0.25], [3, 0.25]]],
  'bass-house': [[[0, 0.25], [0.75, 0.25], [1.5, 0.25], [2.5, 0.25]]],
};

export function generateChords(h: Harmony, style: Style, r: Rng, sustained = false): NoteTuple[] {
  const rhythm: [number, number][] = sustained ? [[0, 3.9]] : r.pick(CHORD_RHYTHMS[style]);
  const out: NoteTuple[] = [];
  h.chords.forEach((chord, bar) => {
    for (const [s, d] of rhythm) {
      const accent = s % 1 === 0 ? 0.85 : 0.7;
      for (const pitch of chord) out.push([pitch, bar * 4 + s, d, r.vel(sustained ? 0.6 : accent, 0.04)]);
    }
  });
  return out;
}

// ------------------------------------------------------------------- bass

export function generateBass(h: Harmony, style: Style, r: Rng): NoteTuple[] {
  const out: NoteTuple[] = [];
  h.roots.forEach((root, bar) => {
    const next = h.roots[(bar + 1) % h.roots.length];
    const fifth = root + 7;
    const oct = root + 12;
    const b = bar * 4;
    const v = (x: number) => r.vel(x, 0.05);
    switch (style) {
      case 'ukg':
        out.push([root, b, 0.5, v(0.95)], [root, b + 0.75, 0.25, v(0.7)], [oct, b + 1.5, 0.25, v(0.8)]);
        out.push(r.chance(0.5) ? [fifth, b + 2.5, 0.5, v(0.85)] : [root, b + 2.5, 0.5, v(0.85)]);
        out.push([r.chance(0.5) ? next : next + 12, b + 3.25, 0.5, v(0.75)]); // approach the next chord
        break;
      case 'speed-garage':
        out.push([root, b + 0.5, 1, v(0.95)], [root, b + 2.5, 0.75, v(0.9)], [oct, b + 3.5, 0.25, v(0.8)]);
        break;
      case 'house':
        for (const s of [0.5, 1.5, 2.5, 3.5]) out.push([s === 3.5 && r.chance(0.5) ? oct : root, b + s, 0.25, v(0.9)]);
        if (r.chance(0.4)) out.push([root, b + 1.75, 0.25, v(0.6)]);
        break;
      case 'deep-house':
        out.push([root, b, 0.75, v(0.9)], [root, b + 1, 0.25, v(0.65)], [r.chance(0.5) ? fifth : root + 10, b + 1.75, 0.5, v(0.8)], [root, b + 2.5, 0.5, v(0.85)]);
        if (r.chance(0.6)) out.push([oct, b + 3.5, 0.25, v(0.7)]);
        break;
      case 'minimal':
        for (const s of [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75]) out.push([root + (s === 3.75 && r.chance(0.5) ? 12 : 0), b + s, 0.2, v(s % 1 === 0.75 ? 0.9 : 0.6)]);
        break;
      case 'bass-house':
        out.push([root, b, 0.25, v(1)], [root, b + 0.75, 0.5, v(0.9)], [oct, b + 1.5, 0.25, v(0.85)], [root, b + 2, 0.5, v(0.95)], [root + 10, b + 3, 0.25, v(0.8)], [oct, b + 3.5, 0.5, v(0.85)]);
        break;
    }
  });
  return out;
}

// ----------------------------------------------------------------- melody

export function generateMelody(h: Harmony, p: Project, style: Style, r: Rng, focus = 72): NoteTuple[] {
  const scale = SCALES[p.key.scale === 'minorPentatonic' ? 'minorPentatonic' : p.key.scale].intervals;
  const root = pitchClassIndex(p.key.root);
  const inScale = (n: number) => scale.includes((((n - root) % 12) + 12) % 12);
  const grid = style === 'ukg' ? [0, 0.75, 1.5, 2, 2.75, 3.25] : [0, 0.5, 1, 1.5, 2.5, 3, 3.5];
  const count = r.pick([3, 4, 5]);
  const motif = [...grid].sort(() => r.next() - 0.5).slice(0, count).sort((a, b) => a - b);
  const out: NoteTuple[] = [];
  let last = focus;
  h.chords.forEach((chord, bar) => {
    const tones = chord.flatMap((c) => [c - 12, c, c + 12]).filter((n) => Math.abs(n - focus) <= 9);
    const answer = bar % 2 === 1;
    motif.forEach((s, i) => {
      if (answer && i === motif.length - 1 && r.chance(0.5)) return;
      let pitch = tones.length ? tones.reduce((a, b) => (Math.abs(b - last) < Math.abs(a - last) ? b : a)) : last;
      if (r.chance(0.35)) {
        // scale passing tone
        const step = r.chance(0.5) ? 1 : -1;
        let n = pitch + step;
        while (!inScale(n)) n += step;
        pitch = n;
      }
      if (i === 0 && answer) pitch = tones[Math.floor(r.next() * tones.length)] ?? pitch;
      const nextS = motif[i + 1] ?? 4;
      const dur = Math.min(nextS - s, style === 'ukg' ? 0.25 : 0.5);
      out.push([pitch, bar * 4 + s, Math.max(0.2, dur), r.vel(0.8)]);
      last = pitch;
    });
  });
  return out;
}

// ---------------------------------------------------------------- recipes

function trackFor(p: Project, role: Role): Track | undefined {
  return p.tracks.find((t) => trackRole(t) === role);
}

export interface Proposal {
  title: string;
  message: string;
  commands: Command[];
}

/** Writes a new pattern for one track, based on its role. */
export function generateForTrack(p: Project, track: Track, style: Style, seed?: number): Proposal {
  const r = rng(seed);
  const role = trackRole(track);
  const h = generateHarmony(p, style, r);
  const label = STYLES.find((s) => s.id === style)!.label;
  const preset = getPreset(track.instrument.presetId);
  const sustained = role === 'chords' && /Pad|Strings|Choir/.test(preset?.family ?? '');
  const notes =
    role === 'drums' ? generateDrums(style, r) : role === 'bass' ? generateBass(h, style, r) : role === 'chords' ? generateChords(h, style, r, sustained) : generateMelody(h, p, style, r, preset?.focusNote ?? 72);
  return {
    title: `New ${role} for ${track.name}`,
    message: `A ${label} ${role === 'drums' ? 'groove' : role} pattern in ${p.key.root} ${SCALES[p.key.scale].label.toLowerCase()}.`,
    commands: [{ op: 'write_clip', track: track.name, startBar: 0, bars: p.lengthBars, patternBars: role === 'drums' ? 2 : 4, notes, name: `${label} ${role}` }],
  };
}

/** A complete groove: tempo, swing, drums, bass, chords and a hook, using existing tracks where possible. */
export function generateGroove(p: Project, style: Style, opts: { hook?: boolean; seed?: number } = {}): Proposal {
  const r = rng(opts.seed);
  const st = STYLES.find((s) => s.id === style)!;
  const commands: Command[] = [{ op: 'set_tempo', bpm: st.bpm }, { op: 'set_swing', swing: st.swing }];
  const draft: Project = { ...p, bpm: st.bpm };
  const h = generateHarmony(draft, style, r);
  const roles: Role[] = opts.hook === false ? ['drums', 'bass', 'chords'] : ['drums', 'bass', 'chords', 'melody'];
  for (const role of roles) {
    let name = trackFor(p, role)?.name;
    if (!name) {
      name = ROLE_NAMES[role];
      commands.push({ op: 'add_track', name, preset: STYLE_SOUNDS[style][role] });
    }
    const preset = getPreset(trackFor(p, role)?.instrument.presetId ?? STYLE_SOUNDS[style][role]);
    const notes =
      role === 'drums' ? generateDrums(style, r) : role === 'bass' ? generateBass(h, style, r) : role === 'chords' ? generateChords(h, style, r) : generateMelody(h, draft, style, r, preset?.focusNote ?? 72);
    commands.push({ op: 'write_clip', track: name, startBar: 0, bars: p.lengthBars, patternBars: role === 'drums' ? 2 : 4, notes, name: `${st.label} ${role}` });
  }
  commands.push({ op: 'set_mixer', track: trackFor(p, 'bass')?.name ?? ROLE_NAMES.bass, sidechain: style === 'ukg' ? 0.25 : 0.5 });
  if (trackFor(p, 'chords') || roles.includes('chords')) commands.push({ op: 'set_mixer', track: trackFor(p, 'chords')?.name ?? ROLE_NAMES.chords, sidechain: 0.35, reverb: 0.25 });
  return { title: `${st.label} groove`, message: `${st.bpm} BPM, ${st.swing}% swing, in ${p.key.root} ${SCALES[p.key.scale].label.toLowerCase()}. Drums, bass, chords${roles.includes('melody') ? ' and a hook' : ''}.`, commands };
}

/** Builds a club arrangement from the tracks' current patterns. */
export function generateStructure(p: Project): Proposal {
  const by = (role: Role) => p.tracks.filter((t) => trackRole(t) === role).map((t) => t.name);
  const drums = by('drums');
  const bass = by('bass');
  const chords = by('chords');
  const melody = by('melody');
  const sections = [
    { name: 'Intro', bars: 8, tracks: [...drums] },
    { name: 'Build', bars: 8, tracks: [...drums, ...chords] },
    { name: 'Drop', bars: 16, tracks: [...drums, ...bass, ...chords, ...melody] },
    { name: 'Break', bars: 8, tracks: [...chords, ...melody] },
    { name: 'Drop 2', bars: 16, tracks: [...drums, ...bass, ...chords, ...melody] },
    { name: 'Outro', bars: 8, tracks: [...drums, ...bass] },
  ];
  return {
    title: 'Song structure',
    message: 'Intro 8 · Build 8 · Drop 16 · Break 8 · Drop 16 · Outro 8 (64 bars), using each track’s current pattern.',
    commands: [{ op: 'arrange', sections }],
  };
}

/** New part for a role: rewrites the matching track, or adds one with a style-appropriate sound. */
export function generateForRole(p: Project, role: Role, style: Style, seed?: number): Proposal {
  const existing = trackFor(p, role);
  if (existing) return generateForTrack(p, existing, style, seed);
  const name = ROLE_NAMES[role];
  const preset = STYLE_SOUNDS[style][role];
  const draft: Project = structuredClone(p);
  const add: Command = { op: 'add_track', name, preset };
  // Generate against a draft that already has the track, so the role logic applies.
  const r = rng(seed);
  const h = generateHarmony(draft, style, r);
  const focus = getPreset(preset)?.focusNote ?? 72;
  const notes = role === 'drums' ? generateDrums(style, r) : role === 'bass' ? generateBass(h, style, r) : role === 'chords' ? generateChords(h, style, r) : generateMelody(h, draft, style, r, focus);
  const label = STYLES.find((s) => s.id === style)!.label;
  return {
    title: `New ${name} track`,
    message: `Added “${name}” (${getPreset(preset)?.name}) with a ${label} ${role} pattern.`,
    commands: [add, { op: 'write_clip', track: name, startBar: 0, bars: p.lengthBars, patternBars: role === 'drums' ? 2 : 4, notes, name: `${label} ${role}` }],
  };
}
