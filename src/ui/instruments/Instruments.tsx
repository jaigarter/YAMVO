import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import * as A from '../../state/actions';
import { PRESETS, getPreset, type PresetCategory } from '../../instruments/presets';
import { paramSpecsFor, type ParamSpec } from '../../instruments/params';
import { Knob, Toggle } from '../components/controls';
import type { Track } from '../../model/types';
import { DrumLanes } from './DrumLanes';
import { Keyboard } from './Keyboard';
import { useMidiStatus, enableMidi } from '../../midi/input';
import { searchLibrary, factoryItems } from '../../library/catalog';

const CATS: PresetCategory[] = ['Drums', 'Bass', 'Keys', 'Synths'];

function ParamControl({ track, spec }: { track: Track; spec: ParamSpec }) {
  const raw = track.instrument.params[spec.key];
  const value = raw ?? spec.default;
  if (spec.kind === 'select') {
    return (
      <label className="param-select">
        <select className="select" value={String(value)} onChange={(e) => A.setInstrumentParam(track.id, spec.key, e.target.value)}>
          {spec.options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {spec.label}
      </label>
    );
  }
  if (spec.kind === 'toggle') {
    return (
      <div className="param-select">
        <Toggle label={spec.label} on={value === true} onChange={(v) => A.setInstrumentParam(track.id, spec.key, v)} />
      </div>
    );
  }
  return (
    <Knob
      label={spec.label}
      value={Number(value)}
      min={spec.min!}
      max={spec.max!}
      step={spec.step}
      log={spec.log}
      unit={spec.unit}
      defaultValue={Number(spec.default)}
      bipolar={spec.unit === 'st'}
      onChange={(v) => A.setInstrumentParam(track.id, spec.key, v, { history: false })}
    />
  );
}

function ParamPanel({ track }: { track: Track }) {
  const specs = paramSpecsFor(track.instrument);
  const groups = useMemo(() => {
    const m = new Map<string, ParamSpec[]>();
    for (const s of specs) m.set(s.group, [...(m.get(s.group) ?? []), s]);
    return [...m.entries()];
  }, [specs]);
  return (
    <div className="param-groups">
      {groups.map(([g, list]) => (
        <div className="param-group" key={g}>
          <div className="panel-title">{g}</div>
          <div className="param-row">
            {list.map((s) => (
              <ParamControl key={s.key} track={track} spec={s} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Instruments() {
  const tracks = useStore((s) => s.project.tracks);
  const selId = useStore((s) => s.ui.selectedTrackId);
  const track = tracks.find((t) => t.id === selId) ?? tracks[0];
  const [query, setQuery] = useState('');
  const midi = useMidiStatus();
  const preset = track ? getPreset(track.instrument.presetId) : undefined;
  const [cat, setCat] = useState<PresetCategory | 'All'>('All');

  const visible = useMemo(() => {
    const ids = new Set(searchLibrary(factoryItems().filter((i) => i.kind === 'preset'), query).map((i) => i.id));
    return PRESETS.filter((p) => ids.has(p.id) && (cat === 'All' || p.category === cat));
  }, [query, cat]);

  if (!track) return <div className="empty">Add a track in the Studio first.</div>;

  const families = [...new Set(visible.map((p) => `${p.category} · ${p.family}`))];

  return (
    <div className="instruments">
      <aside className="preset-browser">
        <div className="head">
          <label className="field">
            Track
            <select className="select" style={{ flex: 1 }} value={track.id} onChange={(e) => A.selectTrack(e.target.value)}>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <input className="text" placeholder="Search presets — e.g. “reese”, “deep house pad”" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {(['All', ...CATS] as const).map((c) => (
              <button key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="preset-list">
          {families.map((f) => (
            <div key={f}>
              <div className="preset-family">{f}</div>
              {visible
                .filter((p) => `${p.category} · ${p.family}` === f)
                .map((p) => (
                  <div
                    key={p.id}
                    className={`preset-item ${p.id === track.instrument.presetId ? 'active' : ''}`}
                    onClick={() => A.setTrackPreset(track.id, p.id)}
                    role="button"
                    aria-pressed={p.id === track.instrument.presetId}
                  >
                    <span className="name">{p.name}</span>
                    <span className="desc">{p.description}</span>
                  </div>
                ))}
            </div>
          ))}
          {!visible.length && <div className="empty">No presets match.</div>}
        </div>
      </aside>
      <section className="inst-panel">
        <div className="inst-header">
          <div>
            <div className="panel-title">{preset ? `${preset.category} · ${preset.family}` : track.instrument.type === 'sampler' ? 'Sampler' : 'Instrument'}</div>
            <h2>{preset?.name ?? track.name}</h2>
            <p>{preset?.description ?? 'Plays a library sample chromatically across the keyboard.'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {preset && (
              <button className="btn" onClick={() => A.setTrackPreset(track.id, preset.id)} title="Restore the preset's original parameters">
                Reset preset
              </button>
            )}
          </div>
        </div>
        {track.instrument.type === 'drum-machine' && <DrumLanes track={track} />}
        <ParamPanel track={track} />
        <Keyboard track={track} />
        <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 10 }}>
          Play with the computer keyboard (A–; row, W/E/T/Y/U/O/P for sharps, Z/X octave {midi.octave}) or a MIDI controller.{' '}
          {midi.supported ? (
            midi.enabled ? (
              <span>MIDI: {midi.devices.length ? midi.devices.join(', ') : 'no devices connected'}.</span>
            ) : (
              <button className="btn small" onClick={() => void enableMidi()}>
                Enable MIDI input
              </button>
            )
          ) : (
            <span>Web MIDI is not supported in this browser.</span>
          )}
        </p>
      </section>
    </div>
  );
}
