import { store } from './store';
import type { Clip, DrumLaneConfig, MixerSettings, Note, ParamValue, Project, Track } from '../model/types';
import { createClip, createDemoProject, createEmptyProject, createTrack, uid, TRACK_COLORS } from '../model/factory';
import { presetConfig, getPreset } from '../instruments/presets';
import { DrumMachine } from '../instruments/DrumMachine';
import { beatsPerBar } from '../sequencer/timing';
import { snap } from '../model/theory';
import { engine } from '../engine';
import { applyCommands, type Command } from '../ai/commands';
import { STYLES, type Style } from '../ai/generators';
import { generateSong } from '../ai/song';

type HistoryOpt = { history?: boolean };

function findTrack(p: Project, trackId: string): Track | undefined {
  return p.tracks.find((t) => t.id === trackId);
}

function findClip(p: Project, clipId: string): { track: Track; clip: Clip } | undefined {
  for (const track of p.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return undefined;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ------------------------------------------------------------------ transport

export async function togglePlay(): Promise<void> {
  if (engine.playing) {
    engine.stop();
  } else {
    store.set({ playing: true });
    try {
      await engine.play();
    } catch (err) {
      console.error(err);
      store.set({ playing: false });
      toast('Audio could not start — click again');
    }
  }
}

export function stopPlayback(): void {
  if (engine.playing) engine.stop();
  else engine.seek(0);
}

export function seekToBeat(beat: number): void {
  engine.seek(beat);
}

export function setBpm(bpm: number, opts?: HistoryOpt): void {
  store.updateProject((p) => void (p.bpm = clamp(Math.round(bpm * 10) / 10, 60, 200)), opts);
}

export function setSwing(swing: number, opts?: HistoryOpt): void {
  store.updateProject((p) => void (p.swing = clamp(Math.round(swing), 50, 75)), opts);
}

export function setKey(root: Project['key']['root'], scale: Project['key']['scale']): void {
  store.updateProject((p) => void (p.key = { root, scale }));
}

export function setTimeSignature(num: number): void {
  store.updateProject((p) => void (p.timeSignature = [clamp(num, 2, 7), 4]));
}

export function setLoop(patch: Partial<Project['loop']>, opts?: HistoryOpt): void {
  store.updateProject((p) => {
    const next = { ...p.loop, ...patch };
    next.startBar = clamp(Math.round(next.startBar), 0, p.lengthBars - 1);
    next.endBar = clamp(Math.round(next.endBar), next.startBar + 1, p.lengthBars);
    p.loop = next;
  }, opts);
}

export function setLengthBars(bars: number): void {
  store.updateProject((p) => {
    p.lengthBars = clamp(Math.round(bars), 1, 256);
    p.loop.endBar = Math.min(p.loop.endBar, p.lengthBars);
    p.loop.startBar = Math.min(p.loop.startBar, p.loop.endBar - 1);
  });
}

export function setMaster(patch: Partial<Project['master']>, opts?: HistoryOpt): void {
  store.updateProject((p) => void (p.master = { ...p.master, ...patch }), opts);
}

// --------------------------------------------------------------------- tracks

export function addTrack(presetId: string): string {
  const preset = getPreset(presetId);
  const track = createTrack(presetId, {
    color: TRACK_COLORS[store.getProject().tracks.length % TRACK_COLORS.length],
    mixer: preset?.category === 'Keys' || preset?.category === 'Synths' ? { volume: -10, sends: { reverb: 0.2, delay: 0 } } : undefined,
  });
  const bpb = beatsPerBar(store.getProject());
  track.clips.push(createClip(0, bpb * 4, bpb * (track.kind === 'drums' ? 1 : 4), [], track.name));
  store.updateProject((p) => void p.tracks.push(track));
  selectTrack(track.id, track.clips[0].id);
  return track.id;
}

export function removeTrack(trackId: string): void {
  store.updateProject((p) => void (p.tracks = p.tracks.filter((t) => t.id !== trackId)));
  const { ui, project } = store.get();
  if (ui.selectedTrackId === trackId) {
    const t = project.tracks[0];
    store.setUi({ selectedTrackId: t?.id ?? null, selectedClipId: t?.clips[0]?.id ?? null });
  }
}

export function duplicateTrack(trackId: string): void {
  store.updateProject((p) => {
    const idx = p.tracks.findIndex((t) => t.id === trackId);
    if (idx < 0) return;
    const copy: Track = structuredClone(p.tracks[idx]);
    copy.id = uid('t');
    copy.name = `${copy.name} copy`;
    copy.mixer.solo = false;
    copy.clips = copy.clips.map((c) => ({ ...c, id: uid('c'), notes: c.notes.map((n) => ({ ...n, id: uid('n') })) }));
    p.tracks.splice(idx + 1, 0, copy);
  });
}

export function moveTrack(trackId: string, dir: -1 | 1): void {
  store.updateProject((p) => {
    const i = p.tracks.findIndex((t) => t.id === trackId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.tracks.length) return;
    [p.tracks[i], p.tracks[j]] = [p.tracks[j], p.tracks[i]];
  });
}

export function renameTrack(trackId: string, name: string): void {
  store.updateProject((p) => {
    const t = findTrack(p, trackId);
    if (t && name.trim()) t.name = name.trim().slice(0, 40);
  });
}

export function setTrackColor(trackId: string, color: string): void {
  store.updateProject((p) => {
    const t = findTrack(p, trackId);
    if (t) t.color = color;
  });
}

export function setTrackSwing(trackId: string, on: boolean): void {
  store.updateProject((p) => {
    const t = findTrack(p, trackId);
    if (t) t.swing = on;
  });
}

export function setMixer(trackId: string, patch: Partial<MixerSettings>, opts?: HistoryOpt): void {
  store.updateProject((p) => {
    const t = findTrack(p, trackId);
    if (t) t.mixer = { ...t.mixer, ...patch };
  }, opts);
}

export function toggleMute(trackId: string): void {
  const t = findTrack(store.getProject(), trackId);
  if (t) setMixer(trackId, { mute: !t.mixer.mute });
}

export function toggleSolo(trackId: string): void {
  const t = findTrack(store.getProject(), trackId);
  if (t) setMixer(trackId, { solo: !t.mixer.solo });
}

/** Swaps the instrument preset of a track, keeping its clips. */
export function setTrackPreset(trackId: string, presetId: string): void {
  const preset = getPreset(presetId);
  if (!preset) return;
  store.updateProject((p) => {
    const t = findTrack(p, trackId);
    if (!t) return;
    const wasDrums = t.kind === 'drums';
    const autoNamed = t.name === getPreset(t.instrument.presetId)?.name || t.name === 'Drums';
    t.instrument = presetConfig(presetId);
    t.kind = preset.category === 'Drums' ? 'drums' : 'instrument';
    // Keep user-chosen names; follow the preset name when the track was auto-named.
    if (autoNamed || wasDrums !== (t.kind === 'drums')) t.name = t.kind === 'drums' ? 'Drums' : preset.name;
  });
}

export function setInstrumentParam(trackId: string, key: string, value: ParamValue, opts?: HistoryOpt): void {
  store.updateProject((p) => {
    const t = findTrack(p, trackId);
    if (t) t.instrument.params[key] = value;
  }, opts);
}

/** Creates a sampler track that plays a library sample chromatically. */
export function addSamplerTrack(sampleId: string, name: string): void {
  const track: Track = {
    ...createTrack('syn-soft-lead', { color: TRACK_COLORS[store.getProject().tracks.length % TRACK_COLORS.length] }),
    name: name.slice(0, 40),
    instrument: { type: 'sampler', presetId: `sample:${sampleId}`, params: { sampleId, root: 60, attack: 0.002, release: 0.3, level: 0 } },
  };
  const bpb = beatsPerBar(store.getProject());
  track.clips.push(createClip(0, bpb * 4, bpb * 4, [], name));
  store.updateProject((p) => void p.tracks.push(track));
  selectTrack(track.id, track.clips[0].id);
}

export function setDrumLane(trackId: string, note: number, patch: Partial<DrumLaneConfig>, opts?: HistoryOpt): void {
  store.updateProject((p) => {
    const t = findTrack(p, trackId);
    if (!t || t.instrument.type !== 'drum-machine') return;
    const lanes = structuredClone(DrumMachine.lanesOf(t.instrument));
    const lane = lanes.find((l) => l.note === note);
    if (!lane) return;
    Object.assign(lane, patch);
    t.instrument.lanes = lanes;
  }, opts);
}

// ---------------------------------------------------------------------- clips

export function selectTrack(trackId: string, clipId?: string | null): void {
  const t = findTrack(store.getProject(), trackId);
  if (!t) return;
  const current = store.get().ui.selectedClipId;
  const clip = clipId !== undefined ? clipId : t.clips.some((c) => c.id === current) ? current : t.clips[0]?.id ?? null;
  store.setUi({ selectedTrackId: trackId, selectedClipId: clip, selectedNoteIds: [] });
}

export function addClip(trackId: string, startBeat: number, lengthBeats?: number): string | null {
  const p = store.getProject();
  const t = findTrack(p, trackId);
  if (!t) return null;
  const bpb = beatsPerBar(p);
  const start = Math.max(0, Math.floor(startBeat / bpb) * bpb);
  const length = lengthBeats ?? bpb * 4;
  const clip = createClip(start, length, t.kind === 'drums' ? bpb : Math.min(length, bpb * 4), [], t.name);
  store.updateProject((d) => void findTrack(d, trackId)?.clips.push(clip));
  selectTrack(trackId, clip.id);
  return clip.id;
}

export function updateClip(clipId: string, patch: Partial<Pick<Clip, 'start' | 'length' | 'loopLength' | 'name'>>, opts?: HistoryOpt): void {
  store.updateProject((p) => {
    const f = findClip(p, clipId);
    if (!f) return;
    const c = f.clip;
    if (patch.start !== undefined) c.start = Math.max(0, patch.start);
    if (patch.length !== undefined) c.length = Math.max(0.25, patch.length);
    if (patch.loopLength !== undefined) c.loopLength = Math.max(0.25, patch.loopLength);
    if (patch.name !== undefined) c.name = patch.name.slice(0, 40);
  }, opts);
}

export function deleteClip(clipId: string): void {
  store.updateProject((p) => {
    for (const t of p.tracks) t.clips = t.clips.filter((c) => c.id !== clipId);
  });
  if (store.get().ui.selectedClipId === clipId) store.setUi({ selectedClipId: null, selectedNoteIds: [] });
}

export function duplicateClip(clipId: string): void {
  const f = findClip(store.getProject(), clipId);
  if (!f) return;
  const copy: Clip = {
    ...structuredClone(f.clip),
    id: uid('c'),
    start: f.clip.start + f.clip.length,
    notes: f.clip.notes.map((n) => ({ ...n, id: uid('n') })),
  };
  store.updateProject((p) => void findTrack(p, f.track.id)?.clips.push(copy));
  store.setUi({ selectedClipId: copy.id, selectedTrackId: f.track.id });
}

// ---------------------------------------------------------------------- notes

export function addNote(clipId: string, n: Omit<Note, 'id'>, opts?: HistoryOpt): string {
  const id = uid('n');
  store.updateProject((p) => {
    const f = findClip(p, clipId);
    if (f) f.clip.notes.push({ ...n, id });
  }, opts);
  return id;
}

export function addNotes(clipId: string, notes: Omit<Note, 'id'>[]): string[] {
  const ids = notes.map(() => uid('n'));
  store.updateProject((p) => {
    const f = findClip(p, clipId);
    if (f) notes.forEach((n, i) => f.clip.notes.push({ ...n, id: ids[i] }));
  });
  return ids;
}

export function updateNotes(clipId: string, ids: string[], fn: (n: Note) => void, opts?: HistoryOpt): void {
  const set = new Set(ids);
  store.updateProject((p) => {
    const f = findClip(p, clipId);
    if (!f) return;
    for (const n of f.clip.notes) {
      if (!set.has(n.id)) continue;
      fn(n);
      n.pitch = clamp(Math.round(n.pitch), 0, 127);
      n.start = clamp(n.start, 0, f.clip.loopLength - 0.0625);
      n.duration = clamp(n.duration, 0.0625, 64);
      n.velocity = clamp(n.velocity, 0.05, 1);
    }
  }, opts);
}

export function deleteNotes(clipId: string, ids: string[]): void {
  const set = new Set(ids);
  store.updateProject((p) => {
    const f = findClip(p, clipId);
    if (f) f.clip.notes = f.clip.notes.filter((n) => !set.has(n.id));
  });
  store.setUi({ selectedNoteIds: [] });
}

/** Step sequencer: toggles a 16th step for a drum lane. */
export function toggleStep(clipId: string, pitch: number, step: number, velocity = 0.85, opts?: HistoryOpt): void {
  store.updateProject((p) => {
    const f = findClip(p, clipId);
    if (!f) return;
    const start = step * 0.25;
    const existing = f.clip.notes.find((n) => n.pitch === pitch && Math.abs(n.start - start) < 0.01);
    if (existing) f.clip.notes = f.clip.notes.filter((n) => n !== existing);
    else f.clip.notes.push({ id: uid('n'), pitch, start, duration: 0.25, velocity });
  }, opts);
}

export function quantizeNotes(clipId: string, ids: string[] | null, grid: number): void {
  store.updateProject((p) => {
    const f = findClip(p, clipId);
    if (!f) return;
    const set = ids ? new Set(ids) : null;
    for (const n of f.clip.notes) {
      if (set && !set.has(n.id)) continue;
      n.start = clamp(snap(n.start, grid), 0, f.clip.loopLength - grid);
      n.duration = Math.max(grid, snap(n.duration, grid));
    }
  });
}

export function clearClip(clipId: string): void {
  store.updateProject((p) => {
    const f = findClip(p, clipId);
    if (f) f.clip.notes = [];
  });
}

// -------------------------------------------------------------------- project

export function newProject(): void {
  engine.stop();
  store.loadProject(createEmptyProject());
}

export function loadDemo(): void {
  engine.stop();
  store.loadProject(createDemoProject());
}

export function openProject(project: Project): void {
  engine.stop();
  store.loadProject(project);
}

export function renameProject(name: string): void {
  store.updateProject((p) => void (name.trim() && (p.name = name.trim().slice(0, 60))));
}

export function undo(): void {
  store.undo();
}

export function redo(): void {
  store.redo();
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string): void {
  store.setUi({ toast: message });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => store.setUi({ toast: null }), 3200);
}

// ------------------------------------------------------------- AI producer

/** Applies AI commands as one undoable step and shows them as a proposal. */
export function propose(title: string, message: string, commands: Command[], source: 'generator' | 'claude', errors: string[] = []): void {
  if (store.get().ui.proposal) acceptProposal();
  if (!commands.length) {
    toast(errors.length ? `Nothing usable in the proposal: ${errors[0]}` : 'The proposal was empty');
    return;
  }
  store.checkpoint();
  let changes: string[] = [];
  store.updateProject((d) => void (changes = applyCommands(d, commands)), { history: false });
  const p = store.getProject();
  const ui = store.get().ui;
  const sel = p.tracks.find((t) => t.id === ui.selectedTrackId) ?? p.tracks[0];
  store.setUi({
    proposal: { title, message, changes, errors, source, depth: store.historyDepth() },
    selectedTrackId: sel?.id ?? null,
    selectedClipId: sel?.clips[0]?.id ?? null,
    selectedNoteIds: [],
  });
}

export function acceptProposal(): void {
  store.setUi({ proposal: null });
}

export function discardProposal(): void {
  const pr = store.get().ui.proposal;
  if (!pr) return;
  store.setUi({ proposal: null });
  if (store.historyDepth() === pr.depth) store.undo();
  else toast('Kept the proposal because you edited it — use Undo to go back');
}

/** Starts a fresh project with a generated groove in the given style. */
export function newFromStyle(style: Style): void {
  engine.stop();
  const p = createEmptyProject(`${STYLES.find((s) => s.id === style)!.label} track`);
  p.tracks = [];
  applyCommands(p, generateSong(p, style).commands);
  store.loadProject(p);
  store.setUi({ producerStyle: style, proposal: null });
}
