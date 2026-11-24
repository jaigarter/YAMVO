import { describe, expect, it } from 'vitest';
import { swingWarp, nextCursor } from './timing';
import { collectEvents } from './events';
import { createDemoProject, createEmptyProject, createClip, note } from '../model/factory';

describe('swingWarp', () => {
  it('is identity at 50%', () => {
    for (const b of [0, 0.25, 0.5, 0.75, 1.3]) expect(swingWarp(b, 50)).toBeCloseTo(b);
  });
  it('keeps 8th notes on the grid', () => {
    for (const b of [0, 0.5, 1, 1.5, 7.5]) expect(swingWarp(b, 66)).toBeCloseTo(b);
  });
  it('delays off-beat 16ths MPC-style', () => {
    expect(swingWarp(0.25, 66)).toBeCloseTo(0.33);
    expect(swingWarp(1.75, 75)).toBeCloseTo(1.875);
  });
  it('is monotonic', () => {
    let prev = -1;
    for (let b = 0; b < 4; b += 0.01) {
      const w = swingWarp(b, 70);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });
});

describe('collectEvents', () => {
  it('repeats clip patterns every loopLength', () => {
    const p = createEmptyProject();
    p.swing = 50;
    const t = p.tracks[0];
    t.clips = [createClip(0, 16, 4, [note(36, 0, 0.25)])];
    const starts: number[] = [];
    for (let b = 0; b < 20; b += 0.25) for (const e of collectEvents(p, b, b + 0.25)) starts.push(b + e.offset);
    expect(starts).toEqual([0, 4, 8, 12]);
  });
  it('applies swing to off-beat notes only on swing-enabled tracks', () => {
    const p = createEmptyProject();
    p.swing = 66;
    p.tracks[0].clips = [createClip(0, 4, 4, [note(42, 0.25, 0.25)])];
    p.tracks[1].clips = [createClip(0, 4, 4, [note(40, 0.25, 0.25)])];
    p.tracks[1].swing = false;
    const ev = collectEvents(p, 0.25, 0.5);
    expect(ev.find((e) => e.pitch === 42)!.offset).toBeCloseTo(0.08);
    expect(ev.find((e) => e.pitch === 40)!.offset).toBeCloseTo(0);
  });
  it('respects mute and solo', () => {
    const p = createDemoProject();
    p.tracks[0].mixer.solo = true;
    const ids = new Set(collectEvents(p, 0, 8).map((e) => e.trackId));
    expect([...ids]).toEqual([p.tracks[0].id]);
    p.tracks[0].mixer.solo = false;
    p.tracks[0].mixer.mute = true;
    expect(collectEvents(p, 0, 8).some((e) => e.trackId === p.tracks[0].id)).toBe(false);
  });
  it('cuts notes at the clip end', () => {
    const p = createEmptyProject();
    p.swing = 50;
    p.tracks[1].clips = [createClip(0, 2, 4, [note(40, 1, 3)])];
    const ev = collectEvents(p, 1, 1.25);
    expect(ev[0].duration).toBeCloseTo(1);
  });
  it('demo project produces notes on every track within 16 bars', () => {
    const p = createDemoProject();
    const ids = new Set<string>();
    for (let b = 0; b < 64; b += 0.25) for (const e of collectEvents(p, b, b + 0.25)) ids.add(e.trackId);
    expect(ids.size).toBe(p.tracks.length);
  });
});

describe('nextCursor', () => {
  it('wraps inside the loop region', () => {
    const p = createEmptyProject();
    p.loop = { enabled: true, startBar: 1, endBar: 2 };
    expect(nextCursor(p, 7.75)).toBe(4);
    expect(nextCursor(p, 5)).toBe(5.25);
  });
  it('stops at song end without loop', () => {
    const p = createEmptyProject();
    p.loop.enabled = false;
    expect(nextCursor(p, p.lengthBars * 4 - 0.25)).toBeNull();
  });
});
