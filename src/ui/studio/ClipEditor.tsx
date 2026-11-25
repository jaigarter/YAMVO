import { useState } from 'react';
import { store, useStore } from '../../state/store';
import * as A from '../../state/actions';
import { StepSequencer } from './StepSequencer';
import { PianoRoll, type ChordTool } from './PianoRoll';
import { beatsPerBar, songLengthBeats } from '../../sequencer/timing';
import { Toggle } from '../components/controls';
import { setFocusArea } from './focus';

const GRIDS: { v: number; label: string }[] = [
  { v: 1, label: '1/4' },
  { v: 0.5, label: '1/8' },
  { v: 1 / 3, label: '1/8T' },
  { v: 0.25, label: '1/16' },
  { v: 1 / 6, label: '1/16T' },
  { v: 0.125, label: '1/32' },
];

const CHORDS: { v: ChordTool; label: string }[] = [
  { v: 'off', label: 'Single notes' },
  { v: 'triad', label: 'Triads' },
  { v: 'seventh', label: '7th chords' },
  { v: 'ninth', label: '9th chords' },
  { v: 'minor9-house', label: 'House voicing' },
  { v: 'stab', label: 'Stabs (root+oct)' },
];

export function ClipEditor() {
  const project = useStore((s) => s.project);
  const trackId = useStore((s) => s.ui.selectedTrackId);
  const clipId = useStore((s) => s.ui.selectedClipId);
  const grid = useStore((s) => s.ui.grid);
  const selectedNotes = useStore((s) => s.ui.selectedNoteIds);
  const [drumView, setDrumView] = useState<'steps' | 'roll'>('steps');
  const [chordTool, setChordTool] = useState<ChordTool>('off');
  const [pxPerBeat, setPx] = useState(72);
  const track = project.tracks.find((t) => t.id === trackId);
  const clip = track?.clips.find((c) => c.id === clipId);
  const bpb = beatsPerBar(project);

  if (!track) return <div className="editor"><div /><div className="empty">Select a track to edit its clips.</div></div>;

  if (!clip) {
    return (
      <div className="editor">
        <div className="editor-bar">
          <span className="editor-title">
            <span className="swatch" style={{ background: track.color }} />
            {track.name}
          </span>
        </div>
        <div className="empty">
          <div>
            No clip selected on this track.
            <br />
            Double-click a lane in the timeline, or
            <div style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => A.addClip(track.id, 0)}>
                Create a 4-bar clip
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isDrums = track.kind === 'drums';
  const showSteps = isDrums && drumView === 'steps';
  const patternBars = clip.loopLength / bpb;

  return (
    <div className="editor" onPointerDown={() => setFocusArea('editor')}>
      <div className="editor-bar">
        <span className="editor-title">
          <span className="swatch" style={{ background: track.color }} />
          {track.name}
          <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>/ {clip.name}</span>
        </span>
        {isDrums && (
          <div className="seg">
            <button className={drumView === 'steps' ? 'active' : ''} onClick={() => setDrumView('steps')}>
              Steps
            </button>
            <button className={drumView === 'roll' ? 'active' : ''} onClick={() => setDrumView('roll')}>
              Piano roll
            </button>
          </div>
        )}
        <label className="field">
          Pattern
          <select
            className="select"
            value={patternBars}
            onChange={(e) => {
              const bars = Number(e.target.value);
              A.updateClip(clip.id, { loopLength: bars * bpb, length: Math.max(clip.length, bars * bpb) });
            }}
          >
            {[0.5, 1, 2, 4, 8, 16].map((b) => (
              <option key={b} value={b}>
                {b === 0.5 ? '½ bar' : `${b} bar${b > 1 ? 's' : ''}`}
              </option>
            ))}
            {![0.5, 1, 2, 4, 8, 16].includes(patternBars) && <option value={patternBars}>{patternBars.toFixed(2)} bars</option>}
          </select>
        </label>
        {!showSteps && (
          <label className="field">
            Grid
            <select className="select" value={grid} onChange={(e) => store.setUi({ grid: Number(e.target.value) })}>
              {GRIDS.map((g) => (
                <option key={g.label} value={g.v}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {!isDrums && (
          <label className="field" title="Click in the piano roll to place a diatonic chord in the project key">
            Draw
            <select className="select" value={chordTool} onChange={(e) => setChordTool(e.target.value as ChordTool)}>
              {CHORDS.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <Toggle label="Swing" on={track.swing} onChange={(v) => A.setTrackSwing(track.id, v)} />
        <span className="grow" />
        {!showSteps && (
          <div className="seg" title="Horizontal zoom">
            <button onClick={() => setPx((p) => Math.max(24, p / 1.3))} aria-label="Zoom out">
              −
            </button>
            <button onClick={() => setPx((p) => Math.min(260, p * 1.3))} aria-label="Zoom in">
              +
            </button>
          </div>
        )}
        <button
          className="btn small"
          onClick={() => A.quantizeNotes(clip.id, store.get().ui.selectedNoteIds.length ? store.get().ui.selectedNoteIds : null, showSteps ? 0.25 : grid)}
          title="Snap selected notes (or all) to the grid"
        >
          Quantize
        </button>
        <button
          className="btn small"
          onClick={() => A.updateClip(clip.id, { length: Math.max(clip.loopLength, songLengthBeats(project) - clip.start) })}
          title="Extend this clip so its pattern repeats until the end of the song"
        >
          Repeat to end
        </button>
        {!showSteps && selectedNotes.length > 0 && (
          <button className="btn small" onClick={() => A.deleteNotes(clip.id, selectedNotes)} title="Delete selected notes (Delete key)">
            Delete {selectedNotes.length} note{selectedNotes.length > 1 ? 's' : ''}
          </button>
        )}
        <button className="btn small ghost danger" onClick={() => A.clearClip(clip.id)} disabled={!clip.notes.length}>
          Clear
        </button>
      </div>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {showSteps ? <StepSequencer track={track} clip={clip} /> : <PianoRoll track={track} clip={clip} grid={grid} chordTool={chordTool} pxPerBeat={pxPerBeat} />}
      </div>
    </div>
  );
}
