/**
 * Claude as producer, through the claude.ai artifact runtime (`sample`
 * capability). It runs on the viewer's own claude.ai account, so the hosted
 * GROOVE LAB needs no API key. Outside claude.ai the feature is unavailable and
 * the free local generators remain.
 */
import type { Project } from '../model/types';
import { PRESETS } from '../instruments/presets';
import { SCALES } from '../model/theory';
import { validateCommands, type Command } from './commands';
import { trackRole } from './generators';

interface SampleFn {
  json<T = unknown>(input: string, opts?: { modelTier?: 'quick' | 'default' | 'complex'; signal?: AbortSignal; onText?: (e: { text: string }) => void; cache?: boolean }): Promise<T>;
}
interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

let samplePromise: Promise<SampleFn | null> | null = null;

/** Resolves the sample capability, or null when not running inside claude.ai. */
export function getClaude(): Promise<SampleFn | null> {
  if (samplePromise) return samplePromise;
  const rt = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (!rt?.use) return (samplePromise = Promise.resolve(null));
  samplePromise = rt
    .use('sample')
    .then((s) => (s ? (s as SampleFn) : null))
    .catch(() => null);
  return samplePromise;
}

function projectSummary(p: Project): string {
  const tracks = p.tracks.map((t) => {
    const clip = t.clips[0];
    const notes = clip ? clip.notes.slice(0, 48).map((n) => [n.pitch, +n.start.toFixed(3), +n.duration.toFixed(3), +n.velocity.toFixed(2)]) : [];
    return {
      name: t.name,
      preset: t.instrument.presetId,
      role: trackRole(t),
      clips: t.clips.map((c) => ({ startBar: c.start / 4, bars: c.length / 4, patternBars: c.loopLength / 4, notes: c.notes.length })),
      firstPatternNotes: notes,
    };
  });
  return JSON.stringify({ bpm: p.bpm, key: `${p.key.root} ${p.key.scale}`, swing: p.swing, lengthBars: p.lengthBars, tracks });
}

const PRESET_LIST = PRESETS.map((p) => `${p.id} (${p.category}/${p.family}: ${p.name})`).join('\n');

function buildPrompt(p: Project, request: string): string {
  return `You are the AI producer inside GROOVE LAB, a DAW for UK Garage, House, Deep House, Minimal and Bass House.
You change the user's project by returning JSON commands that the app executes. Everything you create stays editable.

Musical knowledge to apply:
- UKG 2-step: 128-136 BPM, swing 58-66, kick on 1 and the "and" of 3 (steps 0 and 10 of 16), snare/clap on 2 and 4, shuffled off-beat hats, rim ghost notes, bouncy syncopated bass with octave jumps, minor 9 chords as syncopated stabs, chopped vocal-style hooks.
- Speed garage / bass house: 4x4 kick, Reese or 808 bass on off-beats, big stabs.
- House: 120-126 BPM, 4x4 kick, clap 2&4, open hat on off-beats, piano/organ stabs, off-beat bass.
- Deep house: 118-124 BPM, warm rounded kick, 7th/9th chords, sustained or pushed chords, rolling bass, vibes/Rhodes.
- Use the project key unless asked otherwise. Keep bass in MIDI 24-48, chords around 52-76, hooks around 64-84.

Command language (JSON). Times are in beats (quarter notes); a 16th note = 0.25. Bar 1 = startBar 0. 4/4 time.
- {"op":"set_tempo","bpm":132}
- {"op":"set_key","root":"F","scale":"minor"}   scales: ${Object.keys(SCALES).join(', ')}
- {"op":"set_swing","swing":62}   (50 straight … 75 heavy)
- {"op":"set_length","bars":64}
- {"op":"add_track","name":"Vox","preset":"smp-voice-oohs"}   preset ids listed below
- {"op":"set_preset","track":"Chords","preset":"smp-rhodes"}
- {"op":"remove_track","track":"Pad"}
- {"op":"write_clip","track":"Bass","startBar":0,"bars":16,"patternBars":2,"notes":[[29,0,0.5,0.9],["F2",0.75,0.25,0.7]]}
  notes = [pitch, startBeat, durationBeats, velocity0to1]; startBeat must be < patternBars*4; the pattern repeats for "bars".
  Pitch can be a MIDI number, a note name like "Eb3", or for drum tracks one of: kick, snare, clap, rim, chh, ohh, shaker, perc.
  write_clip replaces that track's clips in the covered range (add "keepOthers":true to keep them).
- {"op":"set_mixer","track":"Bass","volume":-6,"pan":0,"reverb":0.2,"delay":0.1,"sidechain":0.5,"mute":false}
  volume in dB (-60..6), reverb/delay/sidechain 0..1 (sidechain = ducking from the kick).
- {"op":"arrange","sections":[{"name":"Intro","bars":8,"tracks":["Drums"]},{"name":"Drop","bars":16,"tracks":["Drums","Bass","Chords"]}]}
  lays each track's current pattern across the sections where it plays; sets song length.

Available presets:
${PRESET_LIST}

Current project:
${projectSummary(p)}

User request: ${request}

Reply with ONLY a JSON object: {"message": "<one or two friendly sentences in the user's language explaining what you made>", "commands": [ ... ]}.
Write complete, musical patterns (drums usually 2 bars, harmony/bass 4 bars). Refer to existing tracks by their exact names.`;
}

export interface ClaudeProposal {
  message: string;
  commands: Command[];
  errors: string[];
}

export async function askClaude(p: Project, request: string, opts: { signal?: AbortSignal; onProgress?: (chars: number) => void } = {}): Promise<ClaudeProposal> {
  const sample = await getClaude();
  if (!sample) throw new Error('Claude is only available when GROOVE LAB is opened on claude.ai.');
  const reply = await sample.json<{ message?: unknown; commands?: unknown }>(buildPrompt(p, request), {
    modelTier: 'default',
    signal: opts.signal,
    cache: false,
    onText: ({ text }) => opts.onProgress?.(text.length),
  });
  const { commands, errors } = validateCommands(reply?.commands);
  return { message: typeof reply?.message === 'string' ? reply.message : 'Here is a proposal.', commands, errors };
}
