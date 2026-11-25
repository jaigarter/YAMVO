/**
 * GROOVE LAB musical data model.
 *
 * Units:
 *  - time is expressed in beats (quarter notes). A 16th note = 0.25.
 *  - pitch is a MIDI note number (60 = C4).
 *  - velocity is 0..1.
 *
 * Everything here is plain, serialisable JSON. The audio engine reads it; it
 * never stores musical state of its own.
 */

export const PROJECT_VERSION = 1;

export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type ScaleName =
  | 'minor'
  | 'major'
  | 'dorian'
  | 'phrygian'
  | 'mixolydian'
  | 'harmonicMinor'
  | 'minorPentatonic';

export interface Note {
  id: string;
  pitch: number;
  /** Beats relative to the start of the clip pattern. */
  start: number;
  /** Beats. */
  duration: number;
  velocity: number;
}

export interface Clip {
  id: string;
  name: string;
  /** Position on the timeline, in beats. */
  start: number;
  /** Length occupied on the timeline, in beats. */
  length: number;
  /** Length of the repeating pattern inside the clip, in beats. */
  loopLength: number;
  notes: Note[];
}

export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface MixerSettings {
  /** dB, -60..+6 */
  volume: number;
  /** -1..1 */
  pan: number;
  mute: boolean;
  solo: boolean;
  /** dB gains, -24..+12 */
  eq: { low: number; mid: number; high: number };
  filter: { enabled: boolean; type: FilterType; cutoff: number; q: number };
  comp: { enabled: boolean; threshold: number; ratio: number };
  /** 0..1 send levels to the shared reverb/delay buses. */
  sends: { reverb: number; delay: number };
  /** 0..1 kick-triggered ducking ("pumping"). Optional for older projects. */
  sidechain?: number;
}

export type InstrumentType = 'drum-machine' | 'synth' | 'organ' | 'sampler';

export type ParamValue = number | string | boolean;

export interface InstrumentConfig {
  type: InstrumentType;
  presetId: string;
  /** Editable parameters. Keys are defined by each instrument's param schema. */
  params: Record<string, ParamValue>;
  /** Drum machine only: per-lane overrides. */
  lanes?: DrumLaneConfig[];
}

export interface DrumLaneConfig {
  /** MIDI note that triggers this lane. */
  note: number;
  name: string;
  /** Either a synthesized voice recipe or a sample from the library. */
  source: { kind: 'synth'; voice: string } | { kind: 'sample'; sampleId: string };
  /** Semitones. */
  tune: number;
  /** 0.1..2 multiplier of the voice's natural decay. */
  decay: number;
  /** dB */
  level: number;
  pan: number;
  /** Lanes sharing a choke group cut each other (closed/open hats). */
  choke?: number;
}

export type TrackKind = 'drums' | 'instrument';

export interface Track {
  id: string;
  name: string;
  color: string;
  kind: TrackKind;
  instrument: InstrumentConfig;
  mixer: MixerSettings;
  /** Whether the project swing applies to this track. */
  swing: boolean;
  clips: Clip[];
}

export interface MasterSettings {
  volume: number;
  reverb: { decay: number; wet: number };
  delay: { time: '8n' | '8n.' | '4n' | '16n' | '8t'; feedback: number };
  limiter: boolean;
}

export interface Project {
  id: string;
  name: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  bpm: number;
  timeSignature: [number, number];
  key: { root: PitchClass; scale: ScaleName };
  /** MPC-style swing percentage 50..75 (50 = straight). */
  swing: number;
  lengthBars: number;
  loop: { enabled: boolean; startBar: number; endBar: number };
  master: MasterSettings;
  tracks: Track[];
}
