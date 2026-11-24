import { useEffect } from 'react';
import { useStore } from '../state/store';
import * as A from '../state/actions';
import { TopBar } from './TopBar';
import { Studio } from './studio/Studio';
import { Instruments } from './instruments/Instruments';
import { Mixer } from './mixer/Mixer';
import { Library } from './library/Library';
import { initComputerKeyboard } from '../midi/input';

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
}

export function App() {
  const view = useStore((s) => s.ui.view);
  const toast = useStore((s) => s.ui.toast);
  const busy = useStore((s) => s.ui.busy);

  useEffect(() => {
    const stopKeyboard = initComputerKeyboard();
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space') {
        e.preventDefault();
        void A.togglePlay();
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) A.redo();
        else A.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        A.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      stopKeyboard();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="app">
      <TopBar />
      <main className="main">
        {view === 'studio' && <Studio />}
        {view === 'instruments' && <Instruments />}
        {view === 'mixer' && <Mixer />}
        {view === 'library' && <Library />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
      {busy && (
        <div className="busy" role="alertdialog" aria-label={busy}>
          <div className="busy-card">
            <div className="spinner" />
            {busy}
          </div>
        </div>
      )}
    </div>
  );
}
