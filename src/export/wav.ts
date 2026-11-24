export interface PcmSource {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/** Encodes PCM float data as a RIFF/WAVE file (16- or 24-bit integer, TPDF dither on 16-bit). */
export function encodeWav(src: PcmSource, bitDepth: 16 | 24 = 24): ArrayBuffer {
  const channels = src.numberOfChannels;
  const bytes = bitDepth / 8;
  const dataSize = src.length * channels * bytes;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, src.sampleRate, true);
  view.setUint32(28, src.sampleRate * channels * bytes, true);
  view.setUint16(32, channels * bytes, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const data = Array.from({ length: channels }, (_, c) => src.getChannelData(c));
  let off = 44;
  const max = bitDepth === 16 ? 32767 : 8388607;
  for (let i = 0; i < src.length; i++) {
    for (let c = 0; c < channels; c++) {
      let s = data[c][i];
      if (bitDepth === 16) s += (Math.random() - Math.random()) / max; // TPDF dither
      s = Math.max(-1, Math.min(1, s));
      const v = Math.round(s * max);
      if (bitDepth === 16) {
        view.setInt16(off, v, true);
      } else {
        view.setUint8(off, v & 0xff);
        view.setUint8(off + 1, (v >> 8) & 0xff);
        view.setUint8(off + 2, (v >> 16) & 0xff);
      }
      off += bytes;
    }
  }
  return buf;
}

export function peakAndRms(src: PcmSource): { peak: number; rms: number } {
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (let c = 0; c < src.numberOfChannels; c++) {
    const d = src.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      sum += d[i] * d[i];
      n++;
    }
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, n)) };
}
