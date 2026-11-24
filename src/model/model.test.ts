import { describe, expect, it } from 'vitest';
import { diatonicChord, isInScale, noteName } from './theory';
import { encodeWav, peakAndRms } from '../export/wav';

describe('theory', () => {
  it('names notes', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(29)).toBe('F1');
  });
  it('builds diatonic chords', () => {
    expect(diatonicChord('A', 'minor', 0, 'triad', 3)).toEqual([57, 60, 64]);
    expect(diatonicChord('F', 'minor', 0, 'seventh', 3)).toEqual([53, 56, 60, 63]);
  });
  it('checks scale membership', () => {
    expect(isInScale(63, 'F', 'minor')).toBe(true); // Eb
    expect(isInScale(64, 'F', 'minor')).toBe(false); // E
  });
});

describe('wav encoder', () => {
  const src = (len: number) => {
    const ch = [new Float32Array(len), new Float32Array(len)];
    for (let i = 0; i < len; i++) ch[0][i] = ch[1][i] = Math.sin(i / 10) * 0.5;
    return { numberOfChannels: 2, sampleRate: 44100, length: len, getChannelData: (c: number) => ch[c] };
  };
  it('writes a valid RIFF header and data size', () => {
    const buf = encodeWav(src(100), 24);
    const v = new DataView(buf);
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe('RIFF');
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(24);
    expect(v.getUint32(40, true)).toBe(100 * 2 * 3);
    expect(buf.byteLength).toBe(44 + 600);
  });
  it('measures signal', () => {
    const { peak, rms } = peakAndRms(src(1000));
    expect(peak).toBeCloseTo(0.5, 2);
    expect(rms).toBeGreaterThan(0.3);
  });
});
