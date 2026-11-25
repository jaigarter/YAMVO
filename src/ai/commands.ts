/**
 * AI Producer command language.
 *
 * Both the local generators and Claude speak this small JSON language. Every
 * command maps onto ordinary project edits, so whatever the AI proposes ends
 * up as normal tracks, clips and notes the user can edit, undo or delete.
 */
import type { PitchClass, Project, ScaleName, Track } from '../model/types';
import { PITCH_CLASSES, SCALES } from '../model/theory';
import { createClip, createTrack, TRACK_COLORS, uid } from '../model/factory';
import { getPreset, presetConfig } from '../instruments/presets';
import { beatsPerBar } from '../sequencer/timing';
import { LANE_NOTES } from '../instruments/drumKits';

/** [pitch, startBeat, durationBeats, velocity 0..1]. Pitch: MIDI number, note name ("F2") or drum name ("kick"). */
export type NoteTuple = [number | string, number, number, number?];

export type Command =
  | { op: 'set_tempo'; bpm: number }
  | { op: 'set_key'; root: PitchClass; scale: ScaleName }
  | { op: 'set_swing'; swing: number }
  | { op: 'set_length'; bars: number }
  | { op: 'add_track'; name: string; preset: string }
  | { op: 'set_preset'; track: string; preset: string }
  | { op: 'remove_track'; track: string }
  | { op: 'write_clip'; track: string; startBar?: number; bars?: number; patternBars: number; notes: NoteTuple[]; name?: string; keepOthers?: boolean }
  | { op: 'set_mixer'; track: string; volume?: number; pan?: number; reverb?: number; delay?: number; sidechain?: number; mute?: boolean }
  | { op: 'arrange'; sections: { name: string; bars: number; tracks: string[] }[] };

export const DRUM_NAMES: Record<string, number> = {
  kick: LANE_NOTES.kick,
  snare: LANE_NOTES.snare,
  clap: LANE_NOTES.clap,
  rim: LANE_NOTES.rim,
  chh: LANE_NOTES.closedHat,
  hat: LANE_NOTES.closedHat,
  ohh: LANE_NOTES.openHat,
  shaker: LANE_NOTES.shaker,
  perc: LANE_NOTES.perc,
};

const NOTE_RE = /^([A-Ga-g])(#|b)?(-?\d)$/;

export function parsePitch(p: number | string): number | null {
  if (typeof p === 'number') return Number.isFinite(p) ? Math.round(p) : null;
  const key = p.trim().toLowerCase();
  if (key in DRUM_NAMES) return DRUM_NAMES[key];
  const m = NOTE_RE.exec(p.trim());
  if (!m) return null;
  let pc = PITCH_CLASSES.indexOf(m[1].toUpperCase() as PitchClass);
  if (m[2] === '#') pc += 1;
  if (m[2] === 'b') pc -= 1;
  return (Number(m[3]) + 1) * 12 + pc;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 200;

/** Validates untrusted JSON (from Claude) into commands. Invalid entries are dropped with a reason. */
export function validateCommands(input: unknown): { commands: Command[]; errors: string[] } {
  const errors: string[] = [];
  const commands: Command[] = [];
  const list = Array.isArray(input) ? input : [];
  if (!Array.isArray(input)) errors.push('commands must be an array');
  for (const [i, raw] of list.slice(0, 60).entries()) {
    const c = raw as Record<string, unknown>;
    const bad = (why: string) => errors.push(`#${i + 1} ${String(c?.op)}: ${why}`);
    if (!c || typeof c !== 'object') {
      bad('not an object');
      continue;
    }
    switch (c.op) {
      case 'set_tempo':
        if (isNum(c.bpm)) commands.push({ op: 'set_tempo', bpm: clamp(c.bpm, 60, 200) });
        else bad('bpm missing');
        break;
      case 'set_key':
        if (PITCH_CLASSES.includes(c.root as PitchClass) && (c.scale as string) in SCALES) commands.push({ op: 'set_key', root: c.root as PitchClass, scale: c.scale as ScaleName });
        else bad('invalid root/scale');
        break;
      case 'set_swing':
        if (isNum(c.swing)) commands.push({ op: 'set_swing', swing: clamp(c.swing, 50, 75) });
        else bad('swing missing');
        break;
      case 'set_length':
        if (isNum(c.bars)) commands.push({ op: 'set_length', bars: clamp(Math.round(c.bars), 1, 256) });
        else bad('bars missing');
        break;
      case 'add_track':
        if (isStr(c.name) && isStr(c.preset) && getPreset(c.preset)) commands.push({ op: 'add_track', name: c.name.slice(0, 40), preset: c.preset });
        else bad(`unknown preset ${String(c.preset)}`);
        break;
      case 'set_preset':
        if (isStr(c.track) && isStr(c.preset) && getPreset(c.preset)) commands.push({ op: 'set_preset', track: c.track, preset: c.preset });
        else bad('invalid track/preset');
        break;
      case 'remove_track':
        if (isStr(c.track)) commands.push({ op: 'remove_track', track: c.track });
        else bad('track missing');
        break;
      case 'write_clip': {
        if (!isStr(c.track) || !isNum(c.patternBars) || !Array.isArray(c.notes)) {
          bad('needs track, patternBars and notes');
          break;
        }
        const notes = (c.notes as unknown[])
          .filter((n): n is NoteTuple => Array.isArray(n) && n.length >= 3 && parsePitch(n[0] as number | string) !== null && isNum(n[1]) && isNum(n[2]))
          .slice(0, 800);
        commands.push({
          op: 'write_clip',
          track: c.track,
          startBar: isNum(c.startBar) ? Math.max(0, Math.round(c.startBar)) : 0,
          bars: isNum(c.bars) ? clamp(Math.round(c.bars), 1, 256) : undefined,
          patternBars: clamp(c.patternBars, 0.25, 16),
          notes,
          name: isStr(c.name) ? c.name.slice(0, 40) : undefined,
          keepOthers: c.keepOthers === true,
        });
        break;
      }
      case 'set_mixer':
        if (isStr(c.track))
          commands.push({
            op: 'set_mixer',
            track: c.track,
            volume: isNum(c.volume) ? clamp(c.volume, -60, 6) : undefined,
            pan: isNum(c.pan) ? clamp(c.pan, -1, 1) : undefined,
            reverb: isNum(c.reverb) ? clamp(c.reverb, 0, 1) : undefined,
            delay: isNum(c.delay) ? clamp(c.delay, 0, 1) : undefined,
            sidechain: isNum(c.sidechain) ? clamp(c.sidechain, 0, 1) : undefined,
            mute: typeof c.mute === 'boolean' ? c.mute : undefined,
          });
        else bad('track missing');
        break;
      case 'arrange': {
        const sections = Array.isArray(c.sections)
          ? (c.sections as Record<string, unknown>[])
              .filter((s) => s && isNum(s.bars) && Array.isArray(s.tracks))
              .map((s) => ({ name: isStr(s.name) ? s.name : 'Section', bars: clamp(Math.round(s.bars as number), 1, 64), tracks: (s.tracks as unknown[]).filter(isStr) }))
          : [];
        if (sections.length) commands.push({ op: 'arrange', sections });
        else bad('sections missing');
        break;
      }
      default:
        bad('unknown op');
    }
  }
  return { commands, errors };
}

export function findTrackByName(p: Project, name: string): Track | undefined {
  const n = name.trim().toLowerCase();
  return p.tracks.find((t) => t.name.toLowerCase() === n) ?? p.tracks.find((t) => t.id === name) ?? p.tracks.find((t) => t.name.toLowerCase().startsWith(n));
}

/** Applies commands to a draft project (mutates it). Returns human-readable change notes. */
export function applyCommands(p: Project, commands: Command[]): string[] {
  const notes: string[] = [];
  const bpb = () => beatsPerBar(p);
  for (const c of commands) {
    switch (c.op) {
      case 'set_tempo':
        p.bpm = c.bpm;
        notes.push(`Tempo ${c.bpm} BPM`);
        break;
      case 'set_key':
        p.key = { root: c.root, scale: c.scale };
        notes.push(`Key ${c.root} ${SCALES[c.scale].label}`);
        break;
      case 'set_swing':
        p.swing = c.swing;
        notes.push(`Swing ${c.swing}%`);
        break;
      case 'set_length':
        p.lengthBars = c.bars;
        p.loop = { ...p.loop, startBar: Math.min(p.loop.startBar, c.bars - 1), endBar: Math.min(Math.max(p.loop.endBar, 1), c.bars) };
        notes.push(`Song length ${c.bars} bars`);
        break;
      case 'add_track': {
        if (findTrackByName(p, c.name)) {
          notes.push(`Track “${c.name}” already exists`);
          break;
        }
        const preset = getPreset(c.preset)!;
        const t = createTrack(c.preset, { name: c.name, color: TRACK_COLORS[p.tracks.length % TRACK_COLORS.length] });
        if (preset.category !== 'Drums' && preset.category !== 'Bass') t.mixer = { ...t.mixer, volume: -9, sends: { reverb: 0.2, delay: 0 } };
        p.tracks.push(t);
        notes.push(`New track “${c.name}” (${preset.name})`);
        break;
      }
      case 'set_preset': {
        const t = findTrackByName(p, c.track);
        if (!t) break;
        const preset = getPreset(c.preset)!;
        t.instrument = presetConfig(c.preset);
        t.kind = preset.category === 'Drums' ? 'drums' : 'instrument';
        notes.push(`${t.name} → ${preset.name}`);
        break;
      }
      case 'remove_track': {
        const t = findTrackByName(p, c.track);
        if (!t) break;
        p.tracks = p.tracks.filter((x) => x !== t);
        notes.push(`Removed ${t.name}`);
        break;
      }
      case 'write_clip': {
        const t = findTrackByName(p, c.track);
        if (!t) {
          notes.push(`No track “${c.track}”`);
          break;
        }
        const loopLength = c.patternBars * bpb();
        const length = (c.bars ?? Math.max(c.patternBars, p.lengthBars - (c.startBar ?? 0))) * bpb();
        const start = (c.startBar ?? 0) * bpb();
        const clipNotes = c.notes
          .map(([pitch, s, d, v]) => ({ id: uid('n'), pitch: parsePitch(pitch)!, start: s, duration: Math.max(0.0625, d), velocity: clamp(v ?? 0.8, 0.05, 1) }))
          .filter((n) => n.start >= 0 && n.start < loopLength && n.pitch >= 0 && n.pitch <= 127);
        if (!c.keepOthers) t.clips = t.clips.filter((x) => x.start + x.length <= start || x.start >= start + length);
        t.clips.push(createClip(start, length, loopLength, clipNotes, c.name ?? t.name));
        notes.push(`${t.name}: ${clipNotes.length} notes, ${c.patternBars}-bar pattern`);
        break;
      }
      case 'set_mixer': {
        const t = findTrackByName(p, c.track);
        if (!t) break;
        const m = t.mixer;
        if (c.volume !== undefined) m.volume = c.volume;
        if (c.pan !== undefined) m.pan = c.pan;
        if (c.reverb !== undefined) m.sends.reverb = c.reverb;
        if (c.delay !== undefined) m.sends.delay = c.delay;
        if (c.sidechain !== undefined) m.sidechain = c.sidechain;
        if (c.mute !== undefined) m.mute = c.mute;
        notes.push(`Mixer: ${t.name}`);
        break;
      }
      case 'arrange': {
        // Re-lays each track's main pattern across the sections it plays in.
        const total = c.sections.reduce((a, s) => a + s.bars, 0);
        const patterns = new Map(p.tracks.map((t) => [t.id, t.clips[0]]));
        for (const t of p.tracks) {
          const base = patterns.get(t.id);
          if (!base) continue;
          const clips = [];
          let bar = 0;
          for (const s of c.sections) {
            const on = s.tracks.some((name) => findTrackByName(p, name) === t);
            if (on) clips.push(createClip(bar * bpb(), s.bars * bpb(), base.loopLength, base.notes.map((n) => ({ ...n, id: uid('n') })), `${t.name} · ${s.name}`));
            bar += s.bars;
          }
          t.clips = clips;
        }
        p.lengthBars = total;
        p.loop = { enabled: false, startBar: 0, endBar: total };
        notes.push(`Arrangement: ${c.sections.map((s) => `${s.name} ${s.bars}`).join(' · ')} (${total} bars)`);
        break;
      }
    }
  }
  return notes;
}
