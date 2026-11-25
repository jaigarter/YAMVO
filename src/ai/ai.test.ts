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
