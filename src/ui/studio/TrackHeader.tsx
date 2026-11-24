import { useCallback, useRef, useState } from 'react';
import type { Track } from '../../model/types';
import { store, useStore } from '../../state/store';
import * as A from '../../state/actions';
import { getPreset } from '../../instruments/presets';
import { engine } from '../../engine';
import { meterHeight, useFrame } from '../components/animation';
import { TRACK_COLORS } from '../../model/factory';

function instrumentLabel(t: Track): string {
  if (t.instrument.type === 'sampler') return 'Sampler';
  return getPreset(t.instrument.presetId)?.name ?? t.instrument.type;
}

export function TrackHeader({ track, selected }: { track: Track; selected: boolean }) {
  const armed = useStore((s) => s.ui.armedTrackId === track.id);
  const [renaming, setRenaming] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const meter = useRef<HTMLDivElement>(null);
  useFrame(
    useCallback(() => {
      if (meter.current) meter.current.style.height = `${meterHeight(engine.trackLevel(track.id)) * 100}%`;
    }, [track.id]),
  );

  return (
    <div
      className={`track-header ${selected ? 'selected' : ''}`}
      onClick={() => A.selectTrack(track.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="track-color" style={{ background: track.color }} />
      <div className="track-meta">
        <div className="track-name" onDoubleClick={() => setRenaming(true)}>
          {renaming ? (
            <input
              autoFocus
              defaultValue={track.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                A.renameTrack(track.id, e.target.value);
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRenaming(false);
              }}
            />
          ) : (
            track.name
          )}
        </div>
        <div className="track-sub">{instrumentLabel(track)}</div>
      </div>
      <div className="track-buttons" onClick={(e) => e.stopPropagation()}>
        <button className={`ms m ${track.mixer.mute ? 'on' : ''}`} onClick={() => A.toggleMute(track.id)} title="Mute" aria-pressed={track.mixer.mute}>
          M
        </button>
        <button className={`ms s ${track.mixer.solo ? 'on' : ''}`} onClick={() => A.toggleSolo(track.id)} title="Solo" aria-pressed={track.mixer.solo}>
          S
        </button>
        <button
          className={`ms r ${armed ? 'on' : ''}`}
          onClick={() => store.setUi({ armedTrackId: armed ? null : track.id })}
          title="Arm for MIDI / computer keyboard (otherwise the selected track plays)"
          aria-pressed={armed}
        >
          ●
        </button>
        <button className="ms" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })} title="Track options" aria-label="Track options">
          ⋯
        </button>
        <div className="mini-meter">
          <div ref={meter} />
        </div>
      </div>
      {menu && (
        <>
          <div className="backdrop" onClick={(e) => (e.stopPropagation(), setMenu(null))} />
          <div className="popover" style={{ position: 'fixed', left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            <button className="menu-item" onClick={() => (setRenaming(true), setMenu(null))}>
              Rename
            </button>
            <button className="menu-item" onClick={() => (A.duplicateTrack(track.id), setMenu(null))}>
              Duplicate
            </button>
            <button className="menu-item" onClick={() => (A.moveTrack(track.id, -1), setMenu(null))}>
              Move up
            </button>
            <button className="menu-item" onClick={() => (A.moveTrack(track.id, 1), setMenu(null))}>
              Move down
            </button>
            <button className="menu-item" onClick={() => (A.setTrackSwing(track.id, !track.swing), setMenu(null))}>
              Swing <small>{track.swing ? 'on' : 'off'}</small>
            </button>
            <div style={{ display: 'flex', gap: 4, padding: '6px 10px' }}>
              {TRACK_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Colour ${c}`}
                  onClick={() => (A.setTrackColor(track.id, c), setMenu(null))}
                  style={{ width: 18, height: 18, borderRadius: 5, border: c === track.color ? '2px solid #fff' : '0', background: c, padding: 0 }}
                />
              ))}
            </div>
            <div className="menu-sep" />
            <button className="menu-item danger" style={{ color: 'var(--danger)' }} onClick={() => (A.removeTrack(track.id), setMenu(null))}>
              Delete track
            </button>
          </div>
        </>
      )}
    </div>
  );
}
