import { useCallback, useMemo, useRef, useState } from 'react';
import { store, useStore } from '../../state/store';
import * as A from '../../state/actions';
import type { Clip, Track } from '../../model/types';
import { beatsPerBar } from '../../sequencer/timing';
import { TrackHeader } from './TrackHeader';
import { AddTrackMenu } from './AddTrackMenu';
import { PlusIcon } from '../components/Icons';
import { useFrame } from '../components/animation';
import { startDrag } from '../components/pointer';

const LANE_H = 56;

function ClipPreview({ clip, track, zoom }: { clip: Clip; track: Track; zoom: number }) {
  const notes = clip.notes;
  if (!notes.length) return null;
  const isDrums = track.kind === 'drums';
  const pitches = notes.map((n) => n.pitch);
  const lo = Math.min(...pitches);
  const hi = Math.max(...pitches);
  const span = Math.max(1, hi - lo);
  const reps = Math.ceil(clip.length / clip.loopLength);
  const h = 30;
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < reps && rects.length < 1500; r++) {
    for (const n of notes) {
      const x = (r * clip.loopLength + n.start) * zoom;
      if (x >= clip.length * zoom) continue;
      const y = isDrums ? ((hi - n.pitch) / span) * (h - 3) : ((hi - n.pitch) / span) * (h - 3);
      const w = Math.max(1.5, Math.min(n.duration, clip.length - (r * clip.loopLength + n.start)) * zoom - 1);
      rects.push(<rect key={`${r}-${n.id}`} x={x} y={y} width={isDrums ? 2 : w} height={2.5} rx={1} fill="rgba(0,0,0,0.5)" />);
    }
  }
  return (
    <svg className="clip-body" width="100%" height="100%" preserveAspectRatio="none" style={{ padding: '3px 0' }}>
      {rects}
    </svg>
  );
}

function ClipView({ clip, track, zoom, selected, bpb }: { clip: Clip; track: Track; zoom: number; selected: boolean; bpb: number }) {
  const onPointerDown = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    A.selectTrack(track.id, clip.id);
    const start0 = clip.start;
    const len0 = clip.length;
    let checkpointed = false;
    startDrag(e, (dx, _dy, ev) => {
      if (!checkpointed) {
        store.checkpoint();
        checkpointed = true;
      }
      const grid = ev.altKey ? 0.25 : bpb;
      const d = Math.round(dx / zoom / grid) * grid;
      if (mode === 'move') A.updateClip(clip.id, { start: Math.max(0, start0 + d) }, { history: false });
      else A.updateClip(clip.id, { length: Math.max(grid, len0 + d) }, { history: false });
    });
  };
  const reps = [];
  for (let b = clip.loopLength; b < clip.length - 1e-6; b += clip.loopLength) reps.push(b);
  return (
    <div
      className={`clip ${selected ? 'selected' : ''}`}
      style={{ left: clip.start * zoom, width: clip.length * zoom - 1, background: track.color }}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onDoubleClick={(e) => e.stopPropagation()}
      title={`${clip.name} — drag to move (Alt: fine), drag edge to resize, ⌘D duplicate, Delete remove`}
    >
      <div className="clip-head" style={{ background: 'rgba(255,255,255,0.35)' }}>{clip.name}</div>
      <ClipPreview clip={clip} track={track} zoom={zoom} />
      {reps.map((b) => (
        <div key={b} className="clip-repeat" style={{ left: b * zoom }} />
      ))}
      <div className="clip-resize" onPointerDown={(e) => onPointerDown(e, 'resize')} />
    </div>
  );
}

function Ruler({ zoom, bpb, lengthBars, scrollRef }: { zoom: number; bpb: number; lengthBars: number; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const loop = useStore((s) => s.project.loop);
  const barW = bpb * zoom;
  const step = barW < 28 ? 4 : barW < 50 ? 2 : 1;
  const barAt = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return (clientX - rect.left) / barW;
  };
  const dragLoop = (e: React.PointerEvent, mode: 'move' | 'start' | 'end') => {
    e.stopPropagation();
    const s0 = loop.startBar;
    const e0 = loop.endBar;
    store.checkpoint();
    startDrag(e, (dx) => {
      const d = Math.round(dx / barW);
      if (mode === 'move') {
        const len = e0 - s0;
        const s = Math.max(0, Math.min(lengthBars - len, s0 + d));
        A.setLoop({ startBar: s, endBar: s + len }, { history: false });
      } else if (mode === 'start') A.setLoop({ startBar: Math.min(e0 - 1, s0 + d) }, { history: false });
      else A.setLoop({ endBar: Math.max(s0 + 1, e0 + d) }, { history: false });
    });
  };
  return (
    <div
      className="ruler"
      ref={scrollRef}
      onPointerDown={(e) => {
        const bar = Math.floor(barAt(e.clientX, e.currentTarget.firstElementChild as HTMLElement));
        A.seekToBeat(Math.max(0, bar) * bpb);
      }}
      title="Click to set the play position"
    >
      <div style={{ position: 'relative', width: lengthBars * barW + 200, height: '100%' }}>
        {Array.from({ length: Math.ceil(lengthBars / step) }, (_, i) => i * step).map((b) => (
          <div key={b} className="ruler-bar" style={{ left: b * barW }}>
            {b + 1}
          </div>
        ))}
        <div
          className={`loop-region ${loop.enabled ? '' : 'off'}`}
          style={{ left: loop.startBar * barW, width: (loop.endBar - loop.startBar) * barW }}
          onPointerDown={(e) => dragLoop(e, 'move')}
          onDoubleClick={() => A.setLoop({ enabled: !loop.enabled })}
          title="Loop region — drag to move, edges to resize, double-click to toggle"
        >
          <div className="loop-handle" style={{ left: -3 }} onPointerDown={(e) => dragLoop(e, 'start')} />
          <div className="loop-handle" style={{ right: -3 }} onPointerDown={(e) => dragLoop(e, 'end')} />
        </div>
      </div>
    </div>
  );
}

function Playhead({ zoom }: { zoom: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useFrame(
    useCallback(
      (beat: number) => {
        if (ref.current) ref.current.style.transform = `translateX(${beat * zoom}px)`;
      },
      [zoom],
    ),
  );
  return <div className="playhead" ref={ref} style={{ left: 0 }} />;
}

export function Arrange() {
  const tracks = useStore((s) => s.project.tracks);
  const lengthBars = useStore((s) => s.project.lengthBars);
  const bpb = useStore((s) => beatsPerBar(s.project));
  const zoom = useStore((s) => s.ui.zoom);
  const selTrack = useStore((s) => s.ui.selectedTrackId);
  const selClip = useStore((s) => s.ui.selectedClipId);
  const [addMenu, setAddMenu] = useState(false);
  const rulerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const barW = bpb * zoom;
  const width = lengthBars * barW + 200;

  const gridBg = useMemo(
    () => ({
      backgroundImage: `linear-gradient(to right, var(--grid-bar) 1px, transparent 1px), linear-gradient(to right, var(--grid-beat) 1px, transparent 1px)`,
      backgroundSize: `${barW}px 100%, ${zoom}px 100%`,
    }),
    [barW, zoom],
  );

  return (
    <div className="arrange">
      <div className="arrange-corner">
        <span className="panel-title">Tracks</span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div className="seg" title="Zoom">
            <button onClick={() => store.setUi({ zoom: Math.max(6, zoom / 1.4) })} aria-label="Zoom out">
              −
            </button>
            <button onClick={() => store.setUi({ zoom: Math.min(90, zoom * 1.4) })} aria-label="Zoom in">
              +
            </button>
          </div>
          <button className="btn small" onClick={() => setAddMenu(true)}>
            <PlusIcon size={12} /> Track
          </button>
        </span>
        {addMenu && <AddTrackMenu onClose={() => setAddMenu(false)} style={{ top: 36, left: 120 }} />}
      </div>
      <Ruler zoom={zoom} bpb={bpb} lengthBars={lengthBars} scrollRef={rulerRef} />
      <div className="track-list" ref={listRef}>
        {tracks.map((t) => (
          <TrackHeader key={t.id} track={t} selected={t.id === selTrack} />
        ))}
        <div style={{ height: 200 }} />
      </div>
      <div
        className="timeline"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (rulerRef.current) rulerRef.current.scrollLeft = el.scrollLeft;
          if (listRef.current) listRef.current.scrollTop = el.scrollTop;
        }}
      >
        <div className="timeline-inner" style={{ width, height: tracks.length * LANE_H + 200 }}>
          {tracks.map((t, i) => (
            <div
              key={t.id}
              className={`lane ${t.id === selTrack ? 'selected' : ''}`}
              style={{ top: i * LANE_H, width }}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) A.selectTrack(t.id, null);
              }}
              onDoubleClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const rect = e.currentTarget.getBoundingClientRect();
                A.addClip(t.id, (e.clientX - rect.left) / zoom);
              }}
              title="Double-click to create a clip"
            >
              <div className="grid-bg" style={gridBg} />
              {t.clips.map((c) => (
                <ClipView key={c.id} clip={c} track={t} zoom={zoom} bpb={bpb} selected={c.id === selClip} />
              ))}
            </div>
          ))}
          <div style={{ position: 'absolute', left: lengthBars * barW, top: 0, bottom: 0, width: 200, background: 'var(--dim)', pointerEvents: 'none' }} />
          <Playhead zoom={zoom} />
          {tracks.length === 0 && (
            <div className="empty" style={{ position: 'absolute', inset: 0, height: 200 }}>
              No tracks yet. Add one with “+ Track”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
