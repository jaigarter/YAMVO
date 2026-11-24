import { store } from '../state/store';
import { AudioEngine } from './AudioEngine';

/** The single live engine instance, bound to the app store. */
export const engine = new AudioEngine(store.getProject);

store.onProject((project) => engine.sync(project));
engine.onStop(() => store.set({ playing: false }));
