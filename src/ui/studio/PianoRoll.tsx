import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Clip, Note, Project, Track } from '../../model/types';
import * as A from '../../state/actions';
import { store, useStore } from '../../state/store';
import { engine } from '../../engine';
import { useFrame } from '../components/animation';
import { startDrag } from '../components/pointer';
import { diatonicChord, isInScale, noteName, pitchClassIndex, snapFloor, SCALES, type ChordQuality } from '../../model/theory';
import { DrumMachine } from '../../instruments/DrumMachine';
import { setFocusArea } from './focus';

const ROW_H = 14;
const LO = 21; // A0
const HI = 108; // C8
const ROWS = HI - LO + 1;
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(p % 12);
const rowY = (pitch: number) => (HI - pitch) * ROW_H;

export type ChordTool = 'off' | ChordQuality;

interface Props {
  track: Track;
  clip: Clip;
  grid: number;
  chordTool: ChordTool;
  pxPerBeat: number;
}

/** Finds the scale degree of `pitch` in the key (or null if not in scale). */
function degreeOf(pitch: number, key: Project['key']): { degree: number; octave: number } | null {
  const rel = (((pitch - pitchClassIndex(key.root)) % 12) + 12) % 12;
  const degree = SCALES[key.scale].intervals.indexOf(rel);
  if (degree < 0) return null;
  const rootMidi = pitch - rel;
  return { degree, octave: Math.floor(rootMidi / 12) - 1 };
}

export function PianoRoll({ track, clip, grid, chordTool, pxPerBeat }: Props) {
  const key = useStore((s) => s.project.key);
  const selected = useStore((s) => s.ui.selectedNoteIds);
  const selSet = useMemo(() => new Set(selected), [selected]);
  const gridRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  const velRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const lastDuration = useRef(Math.max(0.25, grid));
  const width = clip.loopLength * pxPerBeat;
  const drumNames = useMemo(() => {
    if (track.kind !== 'drums') return null;
    return new Map(DrumMachine.lanesOf(track.instrument).map((l) => [l.note, l.name]));
  }, [track]);

  // Centre the view on the clip's notes (or the instrument's natural register).
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const pitches = clip.notes.map((n) => n.pitch);
    const centre = pitches.length ? (Math.min(...pitches) + Math.max(...pitches)) / 2 : track.kind === 'drums' ? 44 : 60;
    el.scrollTop = Math.max(0, rowY(Math.round(centre)) - el.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  useFrame(
    useCallback(
      (beat: number, playing: boolean) => {
        const el = playRef.current;
        if (!el) return;
        const inClip = playing && beat >= clip.start && beat < clip.start + clip.length;
        el.style.display = inClip ? 'block' : 'none';
        if (inClip) el.style.transform = `translateX(${((beat - clip.start) % clip.loopLength) * pxPerBeat}px)`;
      },
      [clip.start, clip.length, clip.loopLength, pxPerBeat],
    ),
  );

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pitchAtY = (y: number) => Math.max(LO, Math.min(HI, HI - Math.floor(y / ROW_H)));

  const audition = (pitch: number, velocity = 0.8) => engine.audition(track.id, pitch, velocity, Math.min(0.5, lastDuration.current * 0.4));

  const createAt = (x: number, y: number) => {
    const start = Math.max(0, Math.min(clip.loopLength - grid, snapFloor(x / pxPerBeat, grid)));
    const pitch = pitchAtY(y);
    const duration = track.kind === 'drums' ? grid : lastDuration.current;
    let pitches = [pitch];
    if (chordTool !== 'off' && track.kind !== 'drums') {
      const d = degreeOf(pitch, key);
      if (d) pitches = diatonicChord(key.root, key.scale, d.degree, chordTool, d.octave);
    }
    const ids = A.addNotes(
      clip.id,
      pitches.map((p) => ({ pitch: p, start, duration, velocity: 0.8 })),
    );
    store.setUi({ selectedNoteIds: ids });
    pitches.forEach((p) => audition(p));
  };

  const onGridDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.target !== canvasRef.current) return;
    setFocusArea('editor');
    const p0 = toLocal(e);
    startDrag(
      e,
      (dx, dy) => {
        const x = Math.min(p0.x, p0.x + dx);
        const y = Math.min(p0.y, p0.y + dy);
        const m = { x, y, w: Math.abs(dx), h: Math.abs(dy) };
        setMarquee(m);
        const b0 = m.x / pxPerBeat;
        const b1 = (m.x + m.w) / pxPerBeat;
        const hiP = pitchAtY(m.y);
        const loP = pitchAtY(m.y + m.h);
        const ids = clip.notes.filter((n) => n.start < b1 && n.start + n.duration > b0 && n.pitch >= loP && n.pitch <= hiP).map((n) => n.id);
        store.setUi({ selectedNoteIds: e.shiftKey ? [...new Set([...selected, ...ids])] : ids });
      },
      (moved) => {
        setMarquee(null);
        if (!moved) {
          if (selected.length && !e.shiftKey) store.setUi({ selectedNoteIds: [] });
          else createAt(p0.x, p0.y);
        }
      },
    );
  };

  const onNoteDown = (e: React.PointerEvent, n: Note, mode: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setFocusArea('editor');
    let ids = selected;
    if (e.shiftKey) {
      ids = selSet.has(n.id) ? selected.filter((i) => i !== n.id) : [...selected, n.id];
      store.setUi({ selectedNoteIds: ids });
      return;
    }
    if (!selSet.has(n.id)) {
      ids = [n.id];
      store.setUi({ selectedNoteIds: ids });
    }
    audition(n.pitch, n.velocity);
    const originals = new Map(clip.notes.filter((x) => ids.includes(x.id)).map((x) => [x.id, { ...x }]));
    let checkpointed = false;
    let lastPitchShift = 0;
    startDrag(
      e,
      (dx, dy, ev) => {
        if (!checkpointed) {
          store.checkpoint();
          checkpointed = true;
        }
        const g = ev.altKey ? grid / 4 : grid;
        const dBeats = Math.round(dx / pxPerBeat / g) * g;
        if (mode === 'move') {
          const dPitch = -Math.round(dy / ROW_H);
          A.updateNotes(
            clip.id,
            ids,
            (x) => {
              const o = originals.get(x.id)!;
              x.start = o.start + dBeats;
              x.pitch = o.pitch + dPitch;
            },
            { history: false },
          );
          if (dPitch !== lastPitchShift) {
            lastPitchShift = dPitch;
            audition(n.pitch + dPitch, n.velocity);
          }
        } else {
          A.updateNotes(
            clip.id,
            ids,
            (x) => {
              const o = originals.get(x.id)!;
              x.duration = Math.max(g, o.duration + dBeats);
            },
            { history: false },
          );
          lastDuration.current = Math.max(grid, n.duration + dBeats);
        }
      },
      (moved) => {
        if (!moved && mode === 'move') lastDuration.current = n.duration;
      },
    );
  };

  const onVelDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = velRef.current!;
    const rect = el.getBoundingClientRect();
    store.checkpoint();
    const apply = (clientX: number, clientY: number) => {
      const beat = (clientX - rect.left + (gridRef.current?.scrollLeft ?? 0)) / pxPerBeat;
      const v = Math.max(0.05, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      const near = clip.notes.filter((n) => Math.abs(n.start - beat) < Math.max(grid / 2, 6 / pxPerBeat));
      const targets = near.some((n) => selSet.has(n.id)) ? near.filter((n) => selSet.has(n.id)) : near;
      if (targets.length) A.updateNotes(clip.id, targets.map((n) => n.id), (n) => void (n.velocity = v), { history: false });
    };
    apply(e.clientX, e.clientY);
    startDrag(e, (_dx, _dy, ev) => apply(ev.clientX, ev.clientY));
  };

  // Keyboard: delete, select all, transpose, duplicate, quantize.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
      const mod = e.metaKey || e.ctrlKey;
      const ids = store.get().ui.selectedNoteIds;
      if ((e.key === 'Delete' || e.key === 'Backspace') && ids.length) {
        e.preventDefault();
        A.deleteNotes(clip.id, ids);
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        store.setUi({ selectedNoteIds: clip.notes.map((n) => n.id) });
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && ids.length) {
        e.preventDefault();
        const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1);
        A.updateNotes(clip.id, ids, (n) => void (n.pitch += d));
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ids.length) {
        e.preventDefault();
        const d = (e.key === 'ArrowRight' ? 1 : -1) * grid;
        A.updateNotes(clip.id, ids, (n) => void (n.start += d));
      } else if (mod && e.key.toLowerCase() === 'd' && ids.length) {
        e.preventDefault();
        const sel = clip.notes.filter((n) => ids.includes(n.id));
        const span = Math.max(...sel.map((n) => n.start + n.duration)) - Math.min(...sel.map((n) => n.start));
        const off = Math.ceil(span / grid) * grid;
        const created = A.addNotes(
          clip.id,
          sel.filter((n) => n.start + off < clip.loopLength).map((n) => ({ pitch: n.pitch, start: n.start + off, duration: n.duration, velocity: n.velocity })),
        );
        store.setUi({ selectedNoteIds: created });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clip, grid]);

  const rows = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let p = HI; p >= LO; p--) {
      const inKey = isInScale(p, key.root, key.scale);
      const root = (p - pitchClassIndex(key.root)) % 12 === 0;
      const cls = drumNames ? (drumNames.has(p) ? '' : 'out') : `${isBlack(p) ? 'black' : ''} ${inKey ? '' : 'out'} ${root ? 'root' : ''}`;
      out.push(<div key={p} className={`pr-row ${cls}`} style={{ top: rowY(p), height: ROW_H }} />);
    }
    return out;
  }, [key, drumNames]);

  const gridLines = useMemo(
    () => ({
      backgroundImage: `linear-gradient(to right, var(--grid-bar) 1px, transparent 1px), linear-gradient(to right, var(--grid-beat) 1px, transparent 1px), linear-gradient(to right, var(--grid-sub) 1px, transparent 1px)`,
      backgroundSize: `${pxPerBeat * 4}px 100%, ${pxPerBeat}px 100%, ${pxPerBeat * grid}px 100%`,
    }),
    [pxPerBeat, grid],
  );

  return (
    <div className="pianoroll">
      <div className="pr-keys-wrap" ref={keysRef}>
        <div style={{ position: 'relative', height: ROWS * ROW_H }}>
          {Array.from({ length: ROWS }, (_, i) => HI - i).map((p) => {
            const label = drumNames ? drumNames.get(p) ?? '' : p % 12 === 0 ? noteName(p) : '';
            return (
              <div
                key={p}
                className={`pr-key ${drumNames ? (drumNames.has(p) ? 'white' : 'black') : isBlack(p) ? 'black' : 'white'} ${p % 12 === 0 ? 'c' : ''} ${activeKey === p ? 'active' : ''}`}
                style={{ top: rowY(p), height: ROW_H, fontSize: drumNames ? 9 : undefined }}
                onPointerDown={() => {
                  setActiveKey(p);
                  engine.noteOn(track.id, p, 0.8);
                  const up = () => {
                    setActiveKey(null);
                    engine.noteOff(track.id, p);
                    window.removeEventListener('pointerup', up);
                  };
                  window.addEventListener('pointerup', up);
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="pr-grid"
        ref={gridRef}
        onScroll={(e) => {
          if (keysRef.current) keysRef.current.scrollTop = e.currentTarget.scrollTop;
          if (velRef.current) velRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
      >
        <div className="pr-canvas" ref={canvasRef} style={{ width: width + 40, height: ROWS * ROW_H, ...gridLines }} onPointerDown={onGridDown} onDoubleClick={(e) => e.preventDefault()}>
          {rows}
          <div className="pr-loop-end" style={{ left: width, width: 40 }} />
          {clip.notes.map((n) => (
            <div
              key={n.id}
              className={`pr-note ${selSet.has(n.id) ? 'selected' : ''}`}
              style={{
                left: n.start * pxPerBeat,
                top: rowY(n.pitch) + 1,
                width: Math.max(4, n.duration * pxPerBeat - 1),
                height: ROW_H - 2,
                background: track.color,
                opacity: 0.45 + n.velocity * 0.55,
              }}
              onPointerDown={(e) => onNoteDown(e, n, 'move')}
              onDoubleClick={(e) => {
                e.stopPropagation();
                A.deleteNotes(clip.id, [n.id]);
              }}
              title={`${drumNames?.get(n.pitch) ?? noteName(n.pitch)} · vel ${Math.round(n.velocity * 127)} — double-click to delete`}
            >
              <div className="pr-note-resize" onPointerDown={(e) => onNoteDown(e, n, 'resize')} />
            </div>
          ))}
          {marquee && <div className="pr-selection" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
          <div ref={playRef} className="playhead" style={{ display: 'none' }} />
        </div>
      </div>
      <div className="pr-vel-label">VEL</div>
      <div className="pr-vel" ref={velRef} onPointerDown={onVelDown} title="Drag to set velocity (selected notes, or notes under the cursor)">
        <div style={{ position: 'relative', width: width + 40, height: '100%' }}>
          {clip.notes.map((n) => (
            <div
              key={n.id}
              className="pr-vel-bar"
              style={{ left: n.start * pxPerBeat, height: `${n.velocity * 92}%`, background: selSet.has(n.id) ? 'var(--text)' : track.color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
