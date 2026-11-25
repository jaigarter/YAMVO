import { describe, expect, it } from 'vitest';
import { applyCommands, parsePitch, validateCommands } from './commands';
import { generateGroove, generateStructure, generateForRole, STYLES, trackRole } from './generators';
import { createEmptyProject, createDemoProject } from '../model/factory';

describe('command validation', () => {
  it('accepts valid commands and rejects bad ones with reasons', () => {
    const { commands, errors } = validateCommands([
      { op: 'set_tempo', bpm: 500 },
      { op: 'add_track', name: 'Vox', preset: 'smp-voice-oohs' },
      { op: 'add_track', name: 'X', preset: 'does-not-exist' },
      { op: 'write_clip', track: 'Vox', patternBars: 1, notes: [['C4', 0, 1, 0.8], ['nonsense', 0, 1]] },
      { op: 'explode' },
    ]);
    expect(commands.map((c) => c.op)).toEqual(['set_tempo', 'add_track', 'write_clip']);
    expect(commands[0]).toEqual({ op: 'set_tempo', bpm: 200 });
    expect(errors.length).toBe(2);
    expect((commands[2] as { notes: unknown[] }).notes.length).toBe(1);
  });
  it('parses note names and drum names', () => {
    expect(parsePitch('C4')).toBe(60);
    expect(parsePitch('Eb3')).toBe(51);
    expect(parsePitch('F#1')).toBe(30);
    expect(parsePitch('kick')).toBe(36);
    expect(parsePitch('banana')).toBeNull();
  });
  it('applies a clip that repeats across the song', () => {
    const p = createEmptyProject();
    applyCommands(p, [{ op: 'write_clip', track: 'Bass', patternBars: 2, notes: [[29, 0, 1, 0.9], [29, 9, 1, 0.9]] }]);
    const clip = p.tracks.find((t) => t.name === 'Bass')!.clips[0];
    expect(clip.loopLength).toBe(8);
    expect(clip.length).toBe(p.lengthBars * 4);
    expect(clip.notes.length).toBe(1); // the note at beat 9 is outside the 2-bar pattern
  });
});

describe('generators', () => {
  for (const st of STYLES) {
    it(`builds a complete ${st.label} groove from an empty project`, () => {
      const p = createEmptyProject();
      p.tracks = [];
      const g = generateGroove(p, st.id, { seed: 42 });
      const { commands, errors } = validateCommands(JSON.parse(JSON.stringify(g.commands)));
      expect(errors).toEqual([]);
      applyCommands(p, commands);
      expect(p.bpm).toBe(st.bpm);
      expect(p.tracks.map(trackRole).sort()).toEqual(['bass', 'chords', 'drums', 'melody']);
      for (const t of p.tracks) {
        const notes = t.clips[0].notes;
        expect(notes.length).toBeGreaterThan(3);
        for (const n of notes) expect(n.start).toBeLessThan(t.clips[0].loopLength);
        if (trackRole(t) === 'bass') for (const n of notes) expect(n.pitch).toBeLessThanOrEqual(50);
      }
    });
  }
  it('reuses existing tracks by role', () => {
    const p = createDemoProject();
    const before = p.tracks.length;
    applyCommands(p, generateForRole(p, 'bass', 'house', 1).commands);
    expect(p.tracks.length).toBe(before);
  });
  it('arranges a 64-bar song structure', () => {
    const p = createDemoProject();
    applyCommands(p, generateStructure(p).commands);
    expect(p.lengthBars).toBe(64);
    const drums = p.tracks.find((t) => t.kind === 'drums')!;
    expect(drums.clips.length).toBeGreaterThanOrEqual(4);
  });
});

import { generateSong, SONG_FORM } from './song';
describe('song generator', () => {
  it('writes a 72-bar arrangement with an energy arc on the demo project', () => {
    const p = createDemoProject();
    const g = generateSong(p, 'house', 7);
    const { commands, errors } = validateCommands(JSON.parse(JSON.stringify(g.commands)));
    expect(errors).toEqual([]);
    applyCommands(p, commands);
    expect(p.lengthBars).toBe(72);
    const drums = p.tracks.find((t) => t.kind === 'drums')!;
    const kicksIn = (fromBar: number, toBar: number) =>
      drums.clips.flatMap((c) => c.notes.filter((n) => n.pitch === 36).map((n) => c.start + n.start)).filter((b) => b >= fromBar * 4 && b < toBar * 4).length;
    // Break (bars 32-40) has no kick; the drops have plenty.
    expect(kicksIn(32, 40)).toBe(0);
    expect(kicksIn(16, 32)).toBeGreaterThan(40);
    // The bass is silent in the intro and present in the drop.
    const bass = p.tracks.find((t) => trackRole(t) === 'bass')!;
    expect(bass.clips.some((c) => c.start < 8 * 4)).toBe(false);
    expect(bass.clips.some((c) => c.start === 16 * 4)).toBe(true);
    // No stray loops from the old tracks.
    for (const t of p.tracks) for (const c of t.clips) expect(c.start + c.length).toBeLessThanOrEqual(72 * 4);
    expect(SONG_FORM.reduce((a, s) => a + s.bars, 0)).toBe(72);
  });
  it('can be requested through the generate command', () => {
    const p = createEmptyProject();
    const { commands } = validateCommands([{ op: 'generate', what: 'song', style: 'ukg', seed: 3 }]);
    applyCommands(p, commands);
    expect(p.tracks.map((t) => t.name)).toEqual(expect.arrayContaining(['Riser', 'Impact', 'Atmos']));
  });
});
