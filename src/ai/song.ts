/**
 * Full-track generator with a story.
 *
 * Instead of one loop repeated for minutes, a song is written section by
 * section with an energy curve:
 *
 *   Intro → Build → Drop → Break → Build 2 → Drop 2 → Outro
 *   (low)   (rising) (peak)  (calm)   (rising)  (peak+)   (falling)
 *
 * Each part enters, leaves and changes: drums add layers and fills, snare rolls
 * build tension, the bass drops out before each drop, chords switch between
 * sustained pads and stabs, the hook is held back until the second half of the
 * first drop and answered with a variation in the second, a riser sweeps into
 * each drop and a crash marks it. Every note is ordinary editable MIDI.
 */
import type { Project } from '../model/types';
import type { Command, NoteTuple } from './commands';
import { generateBass, generateChords, generateDrums, generateHarmony, generateMelody, rng, STYLES, trackRole, type Style } from './generators';
import { getPreset } from '../instruments/presets';
import type { Proposal } from './generators';

export interface Section {
  name: string;
  bars: number;
  /** 0..1 energy at the start and end of the section. */
  energy: [number, number];
}

export const SONG_FORM: Section[] = [
  { name: 'Intro', bars: 8, energy: [0.3, 0.45] },
  { name: 'Build', bars: 8, energy: [0.5, 0.85] },
  { name: 'Drop', bars: 16, energy: [1, 1] },
  { name: 'Break', bars: 8, energy: [0.3, 0.5] },
  { name: 'Build 2', bars: 8, energy: [0.55, 0.95] },
  { name: 'Drop 2', bars: 16, energy: [1, 1] },
  { name: 'Outro', bars: 8, energy: [0.6, 0.25] },
];

const SOUNDS: Record<Style, { drums: string; bass: string; chords: string; hook: string; atmos: string }> = {
  ukg: { drums: 'kit-ukg', bass: 'bass-ukg', chords: 'smp-rhodes', hook: 'smp-voice-oohs', atmos: 'syn-dark-pad' },
  'speed-garage': { drums: 'kit-speed', bass: 'bass-reese', chords: 'keys-garage-stab', hook: 'syn-garage-pluck', atmos: 'syn-dark-pad' },
  house: { drums: 'kit-909', bass: 'bass-organ', chords: 'smp-house-piano', hook: 'syn-glass-pluck', atmos: 'smp-strings' },
  'deep-house': { drums: 'kit-deep', bass: 'bass-deep-sub', chords: 'smp-rhodes', hook: 'smp-vibes', atmos: 'smp-synth-strings' },
  minimal: { drums: 'kit-808', bass: 'bass-rolling', chords: 'keys-chord-stab', hook: 'syn-arp', atmos: 'syn-atmos' },
  'bass-house': { drums: 'kit-speed', bass: 'bass-808', chords: 'smp-orch-stab', hook: 'syn-analog-lead', atmos: 'syn-dark-pad' },
};

type Notes = NoteTuple[];
const BEATS = 4;

/** Repeats a pattern (length in beats) over `bars`, with a per-note filter and velocity scale. */
function tile(pattern: Notes, patternBeats: number, bars: number, keep: (n: NoteTuple, bar: number) => boolean = () => true, vel: (bar: number) => number = () => 1): Notes {
  const out: Notes = [];
  const total = bars * BEATS;
  for (let off = 0; off < total; off += patternBeats) {
    for (const n of pattern) {
      const start = off + n[1];
      if (start >= total) continue;
      const bar = Math.floor(start / BEATS);
      if (!keep(n, bar)) continue;
      out.push([n[0], start, Math.min(n[2], total - start), Math.min(1, (n[3] ?? 0.8) * vel(bar))]);
    }
  }
  return out;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Snare roll over `bars` ending at `endBeat`: 8ths, then 16ths, then 32nds, rising in velocity. */
function snareRoll(endBeat: number, bars: number, name = 'snare'): Notes {
  const out: Notes = [];
  const start = endBeat - bars * BEATS;
  for (let b = 0; b < bars; b++) {
    const step = b === bars - 1 ? 0.125 : b >= bars - 2 ? 0.25 : 0.5;
    for (let t = 0; t < BEATS - 1e-6; t += step) {
      const pos = start + b * BEATS + t;
      const progress = (pos - start) / (bars * BEATS);
      out.push([name, pos, step, lerp(0.35, 1, progress)]);
    }
  }
  return out;
}

/** End-of-phrase fill on the last beat of a bar. */
function fill(barStart: number, r: ReturnType<typeof rng>): Notes {
  const b = barStart + 3;
  const pick = r.pick([0, 1, 2]);
  if (pick === 0) return [['snare', b, 0.25, 0.6], ['snare', b + 0.25, 0.25, 0.7], ['snare', b + 0.5, 0.25, 0.85], ['snare', b + 0.75, 0.25, 0.95], ['ohh', b + 0.5, 0.5, 0.8]];
  if (pick === 1) return [['ohh', b - 0.5, 0.5, 0.85], ['clap', b + 0.5, 0.25, 0.7], ['clap', b + 0.75, 0.25, 0.9], ['perc', b + 0.25, 0.25, 0.6]];
  return [['rim', b, 0.25, 0.6], ['rim', b + 0.25, 0.25, 0.65], ['perc', b + 0.5, 0.25, 0.75], ['snare', b + 0.75, 0.25, 0.9]];
}

export function generateSong(p: Project, style: Style, seed?: number): Proposal {
  const r = rng(seed);
  const st = STYLES.find((s) => s.id === style)!;
  const draft: Project = { ...p, bpm: st.bpm };
  const h = generateHarmony(draft, style, r);
  const sounds = SOUNDS[style];

  // Core material and its variations.
  const drumsA = generateDrums(style, r); // 2 bars
  const drumsB = generateDrums(style, rng(r.next() * 1e9)); // alternate groove for Drop 2
  const bassA = generateBass(h, style, r); // 4 bars
  const bassB = generateBass(h, style, rng(r.next() * 1e9));
  const stabs = generateChords(h, style, r);
  const stabsB = generateChords(h, style, rng(r.next() * 1e9));
  const pads = generateChords(h, style, r, true);
  const hookFocus = getPreset(sounds.hook)?.focusNote ?? 72;
  const hookA = generateMelody(h, draft, style, r, hookFocus);
  const hookB = generateMelody(h, draft, style, rng(r.next() * 1e9), hookFocus);
  const atmos: Notes = h.chords.flatMap((_, bar) => {
    const root = h.roots[bar] + 24;
    return [root, root + 7, root + 12].map((n): NoteTuple => [n, bar * 4, 3.95, 0.5]);
  });

  const commands: Command[] = [
    { op: 'set_tempo', bpm: st.bpm },
    { op: 'set_swing', swing: st.swing },
  ];
  const tracks = {
    Drums: sounds.drums,
    Bass: sounds.bass,
    Chords: sounds.chords,
    Hook: sounds.hook,
    Atmos: sounds.atmos,
    Riser: 'fx-riser',
    Impact: 'fx-crash',
  };
  // Reuse the user's tracks by role or name; add the missing ones.
  const used = new Set<string>();
  const find = (test: (t: Project['tracks'][number]) => boolean) => p.tracks.find((t) => !used.has(t.id) && test(t));
  const resolve: Record<keyof typeof tracks, () => Project['tracks'][number] | undefined> = {
    Drums: () => find((t) => trackRole(t) === 'drums'),
    Bass: () => find((t) => trackRole(t) === 'bass'),
    Atmos: () => find((t) => /pad|atmos/i.test(t.name)),
    Chords: () => find((t) => trackRole(t) === 'chords' && !/pad|atmos/i.test(t.name)),
    Hook: () => find((t) => trackRole(t) === 'melody'),
    Riser: () => find((t) => /riser/i.test(t.name)),
    Impact: () => find((t) => /impact|crash/i.test(t.name)),
  };
  const names = {} as Record<keyof typeof tracks, string>;
  for (const key of Object.keys(tracks) as (keyof typeof tracks)[]) {
    const t = resolve[key]();
    if (t) {
      used.add(t.id);
      names[key] = t.name;
    } else {
      names[key] = key;
      commands.push({ op: 'add_track', name: key, preset: tracks[key] });
    }
  }
  const total = SONG_FORM.reduce((a, s) => a + s.bars, 0);
  commands.push({ op: 'set_length', bars: total });

  const write = (track: string, startBar: number, bars: number, notes: Notes, name: string) => {
    if (notes.length) commands.push({ op: 'write_clip', track, startBar, bars, patternBars: bars, notes, name, keepOthers: true });
  };
  // Start from a clean timeline: clear every track (unused ones stay silent).
  for (const t of p.tracks) commands.push({ op: 'clear_track', track: t.name });

  const isKick = (n: NoteTuple) => n[0] === 'kick';
  const is = (...names: string[]) => (n: NoteTuple) => names.includes(String(n[0]));
  let bar = 0;
  for (const s of SONG_FORM) {
    const B = s.bars;
    const end = B * BEATS;
    const energy = (b: number) => lerp(s.energy[0], s.energy[1], B > 1 ? b / (B - 1) : 0);
    const velE = (b: number) => 0.7 + 0.3 * energy(b);
    let drums: Notes = [];
    let bass: Notes = [];
    let chords: Notes = [];
    let hook: Notes = [];
    let pad: Notes = [];
    const fx: Notes = [];
    const impact: Notes = [];

    switch (s.name) {
      case 'Intro':
        drums = tile(drumsA, 8, B, (n, b) => isKick(n) || is('chh', 'hat')(n) || (b >= 4 && is('shaker', 'rim')(n)), velE);
        drums.push(...fill((B - 1) * 4, r));
        pad = tile(atmos, 16, B, () => true, (b) => 0.6 + 0.3 * (b / B));
        chords = tile(pads, 16, B, (_, b) => b >= 4, () => 0.6);
        break;
      case 'Build':
      case 'Build 2': {
        const rollBars = s.name === 'Build' ? 2 : 4;
        drums = tile(drumsA, 8, B, (n, b) => (isKick(n) ? b < B - 1 : !is('snare')(n) || b < B - rollBars) && (b >= 2 || !is('ohh')(n)), velE);
        drums = drums.filter((n) => !(n[0] === 'snare' && n[1] >= end - rollBars * BEATS));
        drums.push(...snareRoll(end, rollBars));
        chords = tile(stabs, 16, B, () => true, velE);
        if (s.name === 'Build') bass = tile(bassA, 16, B, (_, b) => b >= B - 4 && b < B - 1, () => 0.75);
        fx.push(['C4', end - 4 * BEATS, 4 * BEATS - 0.1, 0.9]);
        pad = s.name === 'Build 2' ? tile(atmos, 16, B, () => true, () => 0.5) : [];
        break;
      }
      case 'Drop':
        drums = tile(drumsA, 8, B, () => true);
        for (const fb of [7, 15]) drums.push(...fill(fb * 4, r));
        // Second half: busier hats for lift.
        drums.push(...tile([['chh', 0.25, 0.25, 0.35], ['chh', 0.75, 0.25, 0.4]], 1, B, (_, b) => b >= 8));
        bass = tile(bassA, 16, B);
        chords = tile(stabs, 16, B);
        hook = tile(hookA, 16, B, (_, b) => b >= 8);
        impact.push(['C4', 0, 4, 1]);
        break;
      case 'Break':
        drums = tile(drumsA, 8, B, (n, b) => is('shaker', 'perc', 'rim')(n) && b >= 2, () => 0.6);
        drums.push(...snareRoll(end, 1, 'clap'));
        chords = tile(pads, 16, B, () => true, (b) => 0.55 + 0.25 * (b / B));
        hook = tile(hookA, 16, B, (_, b) => b >= 4, () => 0.7);
        pad = tile(atmos, 16, B, () => true, () => 0.8);
        impact.push(['C4', 0, 4, 0.6]);
        break;
      case 'Drop 2':
        drums = [...tile(drumsB, 8, 8), ...tile(drumsA, 8, 8).map((n): NoteTuple => [n[0], n[1] + 32, n[2], n[3]])];
        for (const fb of [7, 15]) drums.push(...fill(fb * 4, r));
        drums.push(...tile([['perc', 1.75, 0.25, 0.55], ['perc', 3.25, 0.25, 0.5]], 4, B));
        bass = [...tile(bassB, 16, 8), ...tile(bassA, 16, 8).map((n): NoteTuple => [n[0], n[1] + 32, n[2], n[3]])];
        chords = [...tile(stabsB, 16, 8), ...tile(stabs, 16, 8).map((n): NoteTuple => [n[0], n[1] + 32, n[2], n[3]])];
        hook = [...tile(hookA, 16, 8), ...tile(hookB, 16, 8).map((n): NoteTuple => [n[0], n[1] + 32, n[2], n[3]])];
        pad = tile(atmos, 16, B, (_, b) => b >= 8, () => 0.45);
        impact.push(['C4', 0, 4, 1]);
        break;
      case 'Outro':
        drums = tile(drumsA, 8, B, (n, b) => (isKick(n) ? true : b < 4 ? !is('perc')(n) : b < 6 && is('chh', 'shaker')(n)), velE);
        bass = tile(bassA, 16, B, (_, b) => b < 4, velE);
        chords = tile(pads, 16, B, (_, b) => b < 6, (b) => 0.7 - b * 0.06);
        pad = tile(atmos, 16, B, () => true, (b) => 0.7 - b * 0.07);
        break;
    }
    write(names.Drums, bar, B, drums, s.name);
    write(names.Bass, bar, B, bass, s.name);
    write(names.Chords, bar, B, chords, s.name);
    write(names.Hook, bar, B, hook, s.name);
    write(names.Atmos, bar, B, pad, s.name);
    write(names.Riser, bar, B, fx, s.name);
    write(names.Impact, bar, B, impact, s.name);
    bar += B;
  }

  commands.push(
    { op: 'set_mixer', track: names.Bass, sidechain: style === 'ukg' ? 0.3 : 0.55 },
    { op: 'set_mixer', track: names.Chords, sidechain: 0.4, reverb: 0.25 },
    { op: 'set_mixer', track: names.Atmos, sidechain: 0.5, reverb: 0.5, volume: -14 },
    { op: 'set_mixer', track: names.Hook, reverb: 0.3, delay: 0.2, volume: -10 },
    { op: 'set_mixer', track: names.Riser, volume: -14, reverb: 0.4 },
    { op: 'set_mixer', track: names.Impact, volume: -12, reverb: 0.5 },
  );

  const form = SONG_FORM.map((s) => `${s.name} ${s.bars}`).join(' · ');
  return {
    title: `${st.label} track`,
    message: `A ${total}-bar song at ${st.bpm} BPM with an energy arc: ${form}. Parts enter and drop out, fills and snare rolls build tension, risers and crashes mark each drop, and Drop 2 brings new variations.`,
    commands,
  };
}
