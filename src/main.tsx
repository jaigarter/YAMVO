import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App';
import { applyTheme, loadTheme } from './ui/theme';
import { setDockIcon } from './platform/desktop';

applyTheme(loadTheme());
void setDockIcon();
import { initPersistence } from './state/persistence';
import { engine } from './engine';
import { store } from './state/store';
import { renderProject } from './export/render';
import { peakAndRms } from './export/wav';
import { PRESETS } from './instruments/presets';
import * as factory from './model/factory';
import { DRUM_VOICES, renderDrumVoice } from './instruments/drumSynthesis';
import { generateSong } from './ai/song';
import { applyCommands } from './ai/commands';

// Debug/verification hook (used by scripts/e2e-audio-check.mjs).
(window as unknown as Record<string, unknown>).__grooveLab = { engine, store, render: { renderProject, peakAndRms },
  lib: { presets: PRESETS, factory, voices: DRUM_VOICES, renderDrumVoice, generateSong, applyCommands },
};

void initPersistence().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
