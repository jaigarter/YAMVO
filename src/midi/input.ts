import { useSyncExternalStore } from 'react';
import { store } from '../state/store';
import { engine } from '../engine';
import { LANE_ORDER } from '../instruments/drumKits';

/**
 * Live note input from Web MIDI controllers and the computer keyboard.
 * Notes go to the armed track, or the selected track when none is armed.
 */

export interface MidiStatus {
  supported: boolean;
  enabled: boolean;
  /** Set when the browser or the embedding page refused MIDI access. */
  error: string | null;
  devices: string[];
  octave: number;
  lastNote: number | null;
}

let status: MidiStatus = { supported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator, enabled: false, error: null, devices: [], octave: 4, lastNote: null };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<MidiStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};

export function useMidiStatus(): MidiStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

function targetTrack(): string | null {
  const { ui } = store.get();
  return ui.armedTrackId ?? ui.selectedTrackId;
}

/** pitch → track it was sent to, so note-off reaches the same instrument. */
const sounding = new Map<string, string>();

export function liveNoteOn(pitch: number, velocity: number, source: string): void {
  const trackId = targetTrack();
  if (!trackId) return;
  sounding.set(`${source}:${pitch}`, trackId);
  engine.noteOn(trackId, pitch, velocity);
  setStatus({ lastNote: pitch });
}

export function liveNoteOff(pitch: number, source: string): void {
  const key = `${source}:${pitch}`;
  const trackId = sounding.get(key);
  if (!trackId) return;
  sounding.delete(key);
  engine.noteOff(trackId, pitch);
}

// ---------------------------------------------------------------- Web MIDI

export async function enableMidi(): Promise<void> {
  if (!status.supported) return;
  try {
    const access = await navigator.requestMIDIAccess();
    const bind = () => {
      const names: string[] = [];
      access.inputs.forEach((input) => {
        names.push(input.name ?? 'MIDI input');
        input.onmidimessage = (e) => {
          const data = e.data;
          if (!data || data.length < 3) return;
          const cmd = data[0] & 0xf0;
          if (cmd === 0x90 && data[2] > 0) liveNoteOn(data[1], data[2] / 127, 'midi');
          else if (cmd === 0x80 || (cmd === 0x90 && data[2] === 0)) liveNoteOff(data[1], 'midi');
        };
      });
      setStatus({ enabled: true, devices: names });
    };
    bind();
    access.onstatechange = bind;
  } catch (err) {
    console.warn('[midi] access denied', err);
    setStatus({ enabled: false, error: 'MIDI access was blocked by the browser or this page. Use the computer keyboard, or open GROOVE LAB directly in Chrome/Edge.' });
  }
}

// ------------------------------------------------------- computer keyboard

const KEYMAP = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';'];

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function keyToPitch(key: string): number | null {
  const idx = KEYMAP.indexOf(key);
  if (idx < 0) return null;
  const trackId = targetTrack();
  const track = store.getProject().tracks.find((t) => t.id === trackId);
  if (track?.kind === 'drums') return idx < LANE_ORDER.length ? LANE_ORDER[idx] : null;
  return (status.octave + 1) * 12 + idx;
}

export function initComputerKeyboard(): () => void {
  const down = new Map<string, number>();
  const onDown = (e: KeyboardEvent) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === 'z') return setStatus({ octave: Math.max(0, status.octave - 1) });
    if (key === 'x') return setStatus({ octave: Math.min(8, status.octave + 1) });
    const pitch = keyToPitch(key);
    if (pitch === null) return;
    down.set(key, pitch);
    liveNoteOn(pitch, 0.8, 'kbd');
  };
  const onUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const pitch = down.get(key);
    if (pitch === undefined) return;
    down.delete(key);
    liveNoteOff(pitch, 'kbd');
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
  };
}
