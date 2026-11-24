import { store } from './store';
import { loadLastProject, saveProject } from '../storage/projects';

let timer: ReturnType<typeof setTimeout> | undefined;

/** Restores the last project and autosaves every change (debounced). */
export async function initPersistence(): Promise<void> {
  try {
    const last = await loadLastProject();
    if (last) store.loadProject(last);
    else await saveProject(store.getProject());
  } catch (err) {
    console.warn('[persistence] IndexedDB unavailable', err);
    store.set({ saveState: 'error' });
    return;
  }
  store.onProject(() => {
    clearTimeout(timer);
    timer = setTimeout(saveNow, 700);
  });
  window.addEventListener('beforeunload', () => {
    if (store.get().saveState === 'dirty') void saveNow();
  });
}

export async function saveNow(): Promise<void> {
  clearTimeout(timer);
  const project = store.getProject();
  store.set({ saveState: 'saving' });
  try {
    await saveProject(project);
    // Only mark saved if nothing changed while writing.
    store.set({ saveState: store.getProject() === project ? 'saved' : 'dirty' });
  } catch (err) {
    console.error('[persistence] save failed', err);
    store.set({ saveState: 'error' });
  }
}
