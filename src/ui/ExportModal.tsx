import { useState } from 'react';
import { store, useStore } from '../state/store';
import * as A from '../state/actions';
import { engine } from '../engine';
import { downloadBlob, exportWav } from '../export/render';

/** Hosted preview (claude.ai artifact): the viewer blocks downloads started by the page. */
const PREVIEW_BUILD = import.meta.env.MODE === 'artifact';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const [range, setRange] = useState<'loop' | 'song'>(project.loop.enabled ? 'loop' : 'song');
  const [bits, setBits] = useState<16 | 24>(24);
  const [tail, setTail] = useState(true);

  const run = async () => {
    onClose();
    if (engine.playing) engine.stop();
    const p = store.getProject();
    const r = range === 'loop' ? { startBar: p.loop.startBar, endBar: p.loop.endBar } : { startBar: 0, endBar: p.lengthBars };
    store.setUi({ busy: 'Rendering audio…' });
    try {
      const blob = await exportWav(p, { ...r, tail: tail ? 2.5 : 0 }, bits);
      const safe = p.name.replace(/[^\w\- ]+/g, '').trim() || 'groove';
      downloadBlob(blob, `${safe} ${p.bpm}bpm.wav`);
      A.toast(`Exported ${(blob.size / 1024 / 1024).toFixed(1)} MB WAV`);
    } catch (err) {
      console.error(err);
      A.toast('Export failed — see console');
    } finally {
      store.setUi({ busy: null });
    }
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-label="Export WAV">
        <h3>Export WAV</h3>
        <div className="row">
          <span className="field" style={{ width: 90 }}>Range</span>
          <div className="seg">
            <button className={range === 'loop' ? 'active' : ''} onClick={() => setRange('loop')}>
              Loop · bars {project.loop.startBar + 1}–{project.loop.endBar}
            </button>
            <button className={range === 'song' ? 'active' : ''} onClick={() => setRange('song')}>
              Whole song · {project.lengthBars} bars
            </button>
          </div>
        </div>
        <div className="row">
          <span className="field" style={{ width: 90 }}>Format</span>
          <div className="seg">
            <button className={bits === 24 ? 'active' : ''} onClick={() => setBits(24)}>
              24-bit
            </button>
            <button className={bits === 16 ? 'active' : ''} onClick={() => setBits(16)}>
              16-bit (dithered)
            </button>
          </div>
          <span className="field">44.1 kHz stereo</span>
        </div>
        <div className="row">
          <span className="field" style={{ width: 90 }}>Tail</span>
          <div className="seg">
            <button className={tail ? 'active' : ''} onClick={() => setTail(true)}>
              Include reverb tail
            </button>
            <button className={!tail ? 'active' : ''} onClick={() => setTail(false)}>
              Cut at end (loopable)
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 }}>
          The export is rendered offline with exactly the same instruments, mixer and effects you hear while playing.
        </p>
        {PREVIEW_BUILD && (
          <p style={{ color: 'var(--solo)', fontSize: 12, lineHeight: 1.5 }}>
            This hosted preview cannot save files to your device. To export WAV, run GROOVE LAB locally (npm run dev) and open it in your browser.
          </p>
        )}
        <div className="actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void run()} disabled={PREVIEW_BUILD}>
            Render &amp; download
          </button>
        </div>
      </div>
    </>
  );
}
