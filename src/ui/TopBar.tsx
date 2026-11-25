import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { store, useStore, type View } from '../state/store';
import * as A from '../state/actions';
import { DragNumber } from './components/controls';
import { LoopIcon, PlayIcon, RedoIcon, StopIcon, UndoIcon, FolderIcon, DownloadIcon, MoonIcon, SunIcon } from './components/Icons';
import { useFrame } from './components/animation';
import { PITCH_CLASSES, SCALES } from '../model/theory';
import { beatsPerBar } from '../sequencer/timing';
import type { PitchClass, ScaleName } from '../model/types';
import { ProjectsModal } from './ProjectsModal';
import { ExportModal } from './ExportModal';
import { applyTheme, loadTheme, type Theme } from './theme';

const VIEWS: { id: View; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'producer', label: '✦ Producer' },
  { id: 'instruments', label: 'Instruments' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'library', label: 'Library' },
];

function Position() {
  const ref = useRef<HTMLSpanElement>(null);
  const bpb = useStore((s) => beatsPerBar(s.project));
  useFrame(
    useCallback(
      (beat: number) => {
        if (!ref.current) return;
        const bar = Math.floor(beat / bpb) + 1;
        const b = Math.floor(beat % bpb) + 1;
        const six = Math.floor((beat % 1) * 4) + 1;
        const txt = `${String(bar).padStart(3, ' ')}.${b}.${six}`;
        if (ref.current.textContent !== txt) ref.current.textContent = txt;
      },
      [bpb],
    ),
  );
  return <span className="lcd-value" ref={ref} style={{ minWidth: 64, whiteSpace: 'pre' }} />;
}

export function TopBar() {
  const view = useStore((s) => s.ui.view);
  const playing = useStore((s) => s.playing);
  const bpm = useStore((s) => s.project.bpm);
  const swing = useStore((s) => s.project.swing);
  const key = useStore((s) => s.project.key);
  const sig = useStore((s) => s.project.timeSignature);
  const loop = useStore((s) => s.project.loop.enabled);
  const canUndo = useStore((s) => s.canUndo);
  const canRedo = useStore((s) => s.canRedo);
  const saveState = useStore((s) => s.saveState);
  const name = useStore((s) => s.project.name);
  const [modal, setModal] = useState<'projects' | 'export' | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-dot" />
        GROOVE LAB
      </div>
      <nav className="nav" aria-label="Areas">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => store.setUi({ view: v.id })}>
            {v.label}
          </button>
        ))}
      </nav>

      <div className="transport">
        <div className="transport-group">
          <button className={`tbtn play ${playing ? 'on' : ''}`} onClick={() => void A.togglePlay()} title="Play / Stop (Space)" aria-label={playing ? 'Stop' : 'Play'}>
            {playing ? <StopIcon /> : <PlayIcon />}
          </button>
          <button className="tbtn" onClick={() => A.stopPlayback()} title="Stop · press again to return to start" aria-label="Return to start">
            <StopIcon size={13} />
          </button>
          <button className={`tbtn ${loop ? 'on' : ''}`} onClick={() => A.setLoop({ enabled: !loop })} title="Loop (L)" aria-label="Loop">
            <LoopIcon />
          </button>
        </div>
        <div className="lcd">
          <div className="lcd-cell">
            <label>Position</label>
            <Position />
          </div>
          <div className="lcd-cell">
            <label>BPM</label>
            <DragNumber ariaLabel="Tempo" value={bpm} min={60} max={200} step={1} sensitivity={0.3} format={(v) => v.toFixed(v % 1 ? 1 : 0)} onChange={(v, o) => A.setBpm(v, o)} />
          </div>
          <div className="lcd-cell">
            <label>Swing</label>
            <DragNumber ariaLabel="Swing" value={swing} min={50} max={75} sensitivity={0.15} format={(v) => `${v}%`} onChange={(v, o) => A.setSwing(v, o)} />
          </div>
          <div className="lcd-cell">
            <label>Time</label>
            <select aria-label="Time signature" value={sig[0]} onChange={(e) => A.setTimeSignature(Number(e.target.value))}>
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}/4
                </option>
              ))}
            </select>
          </div>
          <div className="lcd-cell">
            <label>Key</label>
            <span style={{ display: 'flex', gap: 2 }}>
              <select aria-label="Key root" value={key.root} onChange={(e) => A.setKey(e.target.value as PitchClass, key.scale)}>
                {PITCH_CLASSES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select aria-label="Scale" value={key.scale} onChange={(e) => A.setKey(key.root, e.target.value as ScaleName)}>
                {(Object.keys(SCALES) as ScaleName[]).map((s) => (
                  <option key={s} value={s}>
                    {SCALES[s].label}
                  </option>
                ))}
              </select>
            </span>
          </div>
        </div>
      </div>

      <div className="top-right">
        <button className="tbtn" disabled={!canUndo} onClick={A.undo} title="Undo (⌘Z)" aria-label="Undo" style={{ opacity: canUndo ? 1 : 0.35 }}>
          <UndoIcon />
        </button>
        <button className="tbtn" disabled={!canRedo} onClick={A.redo} title="Redo (⇧⌘Z)" aria-label="Redo" style={{ opacity: canRedo ? 1 : 0.35 }}>
          <RedoIcon />
        </button>
        {renaming ? (
          <input
            className="text"
            autoFocus
            defaultValue={name}
            style={{ width: 170, height: 30 }}
            onBlur={(e) => {
              A.renameProject(e.target.value);
              setRenaming(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <button className="btn ghost" onDoubleClick={() => setRenaming(true)} onClick={() => setModal('projects')} title="Projects · double-click to rename">
            <FolderIcon /> {name}
          </button>
        )}
        <button
          className="tbtn"
          onClick={() => {
            const t = theme === 'light' ? 'dark' : 'light';
            applyTheme(t);
            setTheme(t);
          }}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
        <span className="save-state">{{ saved: 'Saved', saving: 'Saving…', dirty: 'Edited', error: 'Not saved' }[saveState]}</span>
        <button className="btn primary" onClick={() => setModal('export')}>
          <DownloadIcon /> Export
        </button>
      </div>
      {/* Portal: the blurred top bar is its own stacking context and would trap fixed dialogs. */}
      {modal === 'projects' && createPortal(<ProjectsModal onClose={() => setModal(null)} />, document.body)}
      {modal === 'export' && createPortal(<ExportModal onClose={() => setModal(null)} />, document.body)}
    </header>
  );
}
