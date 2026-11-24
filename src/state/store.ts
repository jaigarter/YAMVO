import { useSyncExternalStore } from 'react';
import type { Project } from '../model/types';
import { createDemoProject } from '../model/factory';

export type View = 'studio' | 'instruments' | 'mixer' | 'library';

export interface UiState {
  view: View;
  selectedTrackId: string | null;
  selectedClipId: string | null;
  selectedNoteIds: string[];
  /** Piano roll grid in beats. */
  grid: number;
  /** Timeline zoom: pixels per beat. */
  zoom: number;
  /** Track receiving MIDI/QWERTY input (defaults to selected track). */
  armedTrackId: string | null;
  /** Rendering / export modal. */
  busy: string | null;
  toast: string | null;
}

export interface AppState {
  project: Project;
  ui: UiState;
  playing: boolean;
  saveState: 'saved' | 'saving' | 'dirty' | 'error';
  canUndo: boolean;
  canRedo: boolean;
}

type Listener = () => void;

const HISTORY_LIMIT = 150;

class Store {
  private state: AppState;
  private listeners = new Set<Listener>();
  private undoStack: Project[] = [];
  private redoStack: Project[] = [];
  private projectListeners = new Set<(p: Project, prev: Project) => void>();

  constructor(initial: Project) {
    const firstTrack = initial.tracks[0];
    this.state = {
      project: initial,
      ui: {
        view: 'studio',
        selectedTrackId: firstTrack?.id ?? null,
        selectedClipId: firstTrack?.clips[0]?.id ?? null,
        selectedNoteIds: [],
        grid: 0.25,
        zoom: 22,
        armedTrackId: null,
        busy: null,
        toast: null,
      },
      playing: false,
      saveState: 'saved',
      canUndo: false,
      canRedo: false,
    };
  }

  get = (): AppState => this.state;
  getProject = (): Project => this.state.project;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /** Fires on every project change (engine sync, autosave). */
  onProject(l: (p: Project, prev: Project) => void): () => void {
    this.projectListeners.add(l);
    return () => this.projectListeners.delete(l);
  }

  private emit(prevProject?: Project): void {
    for (const l of this.listeners) l();
    if (prevProject && prevProject !== this.state.project) {
      for (const l of this.projectListeners) l(this.state.project, prevProject);
    }
  }

  private historyFlags() {
    return { canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 };
  }

  /**
   * Mutates a deep copy of the project. `history: false` is used while dragging
   * (call checkpoint() once on pointer-down instead).
   */
  updateProject(mutator: (draft: Project) => void, opts: { history?: boolean } = {}): void {
    const prev = this.state.project;
    const draft = structuredClone(prev);
    mutator(draft);
    draft.updatedAt = Date.now();
    if (opts.history !== false) this.pushUndo(prev);
    this.state = { ...this.state, project: draft, saveState: 'dirty', ...this.historyFlags() };
    this.emit(prev);
  }

  /** Records the current project as an undo point. */
  checkpoint(): void {
    this.pushUndo(this.state.project);
    this.state = { ...this.state, ...this.historyFlags() };
    this.emit();
  }

  private pushUndo(p: Project): void {
    this.undoStack.push(p);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    const target = this.undoStack.pop();
    if (!target) return;
    const prev = this.state.project;
    this.redoStack.push(prev);
    this.state = { ...this.state, project: target, saveState: 'dirty', ...this.historyFlags() };
    this.fixSelection();
    this.emit(prev);
  }

  redo(): void {
    const target = this.redoStack.pop();
    if (!target) return;
    const prev = this.state.project;
    this.undoStack.push(prev);
    this.state = { ...this.state, project: target, saveState: 'dirty', ...this.historyFlags() };
    this.fixSelection();
    this.emit(prev);
  }

  /** Replaces the whole project (open / new). Clears history. */
  loadProject(project: Project): void {
    const prev = this.state.project;
    this.undoStack = [];
    this.redoStack = [];
    const t = project.tracks[0];
    this.state = {
      ...this.state,
      project,
      saveState: 'saved',
      ui: { ...this.state.ui, selectedTrackId: t?.id ?? null, selectedClipId: t?.clips[0]?.id ?? null, selectedNoteIds: [] },
      ...this.historyFlags(),
    };
    this.emit(prev);
  }

  setUi(patch: Partial<UiState>): void {
    this.state = { ...this.state, ui: { ...this.state.ui, ...patch } };
    this.emit();
  }

  set(patch: Partial<Omit<AppState, 'project' | 'ui'>>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private fixSelection(): void {
    const { project, ui } = this.state;
    const track = project.tracks.find((t) => t.id === ui.selectedTrackId) ?? project.tracks[0];
    const clip = track?.clips.find((c) => c.id === ui.selectedClipId) ?? track?.clips[0];
    this.state = {
      ...this.state,
      ui: { ...ui, selectedTrackId: track?.id ?? null, selectedClipId: clip?.id ?? null, selectedNoteIds: [] },
    };
  }
}

export const store = new Store(createDemoProject());

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
