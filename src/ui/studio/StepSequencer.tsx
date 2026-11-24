import { useCallback, useRef, useState } from 'react';
import type { Clip, Track } from '../../model/types';
import * as A from '../../state/actions';
import { store } from '../../state/store';
import { DrumMachine } from '../../instruments/DrumMachine';
import { engine } from '../../engine';
import { useFrame } from '../components/animation';
import { DRUM_VOICES, isDrumVoice } from '../../instruments/drumSynthesis';

export const SAMPLE_DRAG_TYPE = 'application/x-groovelab-sample';

const VELS = [0.95, 0.65, 0.38];

export function StepSequencer({ track, clip }: { track: Track; clip: Clip }) {
  const lanes = DrumMachine.lanesOf(track.instrument);
  const totalSteps = Math.round(clip.loopLength / 0.25);
  const bars = Math.ceil(totalSteps / 16);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(bars / 2));
  const p = Math.min(page, pageCount - 1);
  const firstStep = p * 32;
  const visible = Math.min(32, totalSteps - firstStep);
  const [dropLane, setDropLane] = useState<number | null>(null);
  const cellRefs = useRef<Map<number, HTMLElement[]>>(new Map());
  const lastNow = useRef(-1);
  const paint = useRef<{ on: boolean } | null>(null);

  useFrame(
    useCallback(
      (beat: number, playing: boolean) => {
        let idx = -1;
        if (playing && beat >= clip.start && beat < clip.start + clip.length) {
          idx = Math.floor((((beat - clip.start) % clip.loopLength) + 1e-6) / 0.25);
        }
        if (idx === lastNow.current) return;
        cellRefs.current.get(lastNow.current)?.forEach((el) => el.classList.remove('now'));
        cellRefs.current.get(idx)?.forEach((el) => el.classList.add('now'));
        lastNow.current = idx;
      },
      [clip.start, clip.length, clip.loopLength],
    ),
  );

  const noteAt = (pitch: number, step: number) => clip.notes.find((n) => n.pitch === pitch && Math.abs(n.start - step * 0.25) < 0.01);

  cellRefs.current = new Map();
  const register = (step: number) => (el: HTMLElement | null) => {
    if (!el) return;
    const list = cellRefs.current.get(step) ?? [];
    list.push(el);
    cellRefs.current.set(step, list);
    if (step === lastNow.current) el.classList.add('now');
  };

  return (
    <div className="steps">
      {pageCount > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, marginLeft: 162 }}>
          <div className="seg">
            {Array.from({ length: pageCount }, (_, i) => (
              <button key={i} className={i === p ? 'active' : ''} onClick={() => setPage(i)}>
                Bars {i * 2 + 1}–{Math.min(bars, i * 2 + 2)}
              </button>
            ))}
          </div>
        </div>
      )}
      {lanes.map((lane) => {
        const voiceLabel =
          lane.source.kind === 'synth' && isDrumVoice(lane.source.voice) ? DRUM_VOICES[lane.source.voice].label : lane.source.kind === 'sample' ? 'Sample' : '';
        return (
          <div className="step-row" key={lane.note}>
            <div
              className={`step-lane-name ${dropLane === lane.note ? 'drop' : ''}`}
              onClick={() => engine.audition(track.id, lane.note, 0.9)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(SAMPLE_DRAG_TYPE)) {
                  e.preventDefault();
                  setDropLane(lane.note);
                }
              }}
              onDragLeave={() => setDropLane(null)}
              onDrop={(e) => {
                setDropLane(null);
                const id = e.dataTransfer.getData(SAMPLE_DRAG_TYPE);
                if (!id) return;
                e.preventDefault();
                const source = id.startsWith('voice:') ? { kind: 'synth' as const, voice: id.slice(6) } : { kind: 'sample' as const, sampleId: id };
                A.setDrumLane(track.id, lane.note, { source, tune: 0, decay: 1 });
                setTimeout(() => engine.audition(track.id, lane.note, 0.9), 150);
              }}
              title={`${voiceLabel} — click to audition, drop a sample from the Library to replace`}
            >
              {lane.name}
              <small>{voiceLabel}</small>
            </div>
            <div className="step-cells" style={{ gridTemplateColumns: `repeat(${visible}, 1fr)` }}>
              {Array.from({ length: visible }, (_, i) => {
                const step = firstStep + i;
                const n = noteAt(lane.note, step);
                return (
                  <button
                    key={step}
                    ref={register(step)}
                    className={`step ${n ? 'on' : ''} ${step % 4 === 0 ? 'beat' : ''} ${i > 0 && i % 16 === 0 ? 'bar-gap' : ''}`}
                    aria-label={`${lane.name} step ${step + 1}${n ? ' on' : ''}`}
                    aria-pressed={!!n}
                    onPointerDown={(e) => {
                      if (e.button === 2 || e.altKey) {
                        if (!n) return;
                        const next = VELS[(VELS.findIndex((v) => Math.abs(v - n.velocity) < 0.08) + 1) % VELS.length] ?? VELS[0];
                        A.updateNotes(clip.id, [n.id], (x) => void (x.velocity = next));
                        return;
                      }
                      store.checkpoint();
                      paint.current = { on: !n };
                      A.toggleStep(clip.id, lane.note, step, 0.85, { history: false });
                      if (!n) engine.audition(track.id, lane.note, 0.85);
                      const up = () => {
                        paint.current = null;
                        window.removeEventListener('pointerup', up);
                      };
                      window.addEventListener('pointerup', up);
                    }}
                    onPointerEnter={() => {
                      if (!paint.current) return;
                      const has = !!noteAt(lane.note, step);
                      if (has !== paint.current.on) A.toggleStep(clip.id, lane.note, step, 0.85, { history: false });
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    title="Click to toggle · drag to paint · right-click/Alt-click for accent level"
                  >
                    {n && <span className="vel" style={{ height: `${(1 - n.velocity) * 100}%` }} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
