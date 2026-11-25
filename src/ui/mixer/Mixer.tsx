import { useCallback, useRef } from 'react';
import { useStore } from '../../state/store';
import * as A from '../../state/actions';
import type { FilterType, MasterSettings, Track } from '../../model/types';
import { Fader, Knob, Toggle } from '../components/controls';
import { engine } from '../../engine';
import { meterHeight, useFrame } from '../components/animation';

function Meter({ read }: { read: () => number }) {
  const ref = useRef<HTMLDivElement>(null);
  useFrame(
    useCallback(() => {
      if (ref.current) ref.current.style.height = `${meterHeight(read()) * 100}%`;
    }, [read]),
  );
  return (
    <div className="meter">
      <div ref={ref} />
    </div>
  );
}

const panFmt = (v: number) => (Math.abs(v) < 0.03 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`);
const FADER_H = 170;

function Strip({ track }: { track: Track }) {
  const m = track.mixer;
  const set = (patch: Partial<Track['mixer']>) => A.setMixer(track.id, patch, { history: false });
  const read = useCallback(() => engine.trackLevel(track.id), [track.id]);
  return (
    <div className="strip" onClick={() => A.selectTrack(track.id)}>
      <div className="strip-name" style={{ borderBottomColor: track.color }}>
        {track.name}
      </div>

      <div className="strip-section">
        <div className="head">
          <span>EQ</span>
        </div>
        <div className="knobs" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <Knob label="Low" size={30} value={m.eq.low} min={-24} max={12} step={0.5} unit="dB" bipolar defaultValue={0} onChange={(v) => set({ eq: { ...m.eq, low: v } })} />
          <Knob label="Mid" size={30} value={m.eq.mid} min={-24} max={12} step={0.5} unit="dB" bipolar defaultValue={0} onChange={(v) => set({ eq: { ...m.eq, mid: v } })} />
          <Knob label="High" size={30} value={m.eq.high} min={-24} max={12} step={0.5} unit="dB" bipolar defaultValue={0} onChange={(v) => set({ eq: { ...m.eq, high: v } })} />
        </div>
      </div>

      <div className="strip-section">
        <div className="head">
          <span>Filter</span>
          <Toggle label="" on={m.filter.enabled} onChange={(v) => A.setMixer(track.id, { filter: { ...m.filter, enabled: v } })} />
        </div>
        <div className="seg" style={{ opacity: m.filter.enabled ? 1 : 0.45 }}>
          {(['highpass', 'lowpass', 'bandpass'] as FilterType[]).map((t) => (
            <button key={t} className={m.filter.type === t ? 'active' : ''} onClick={() => A.setMixer(track.id, { filter: { ...m.filter, type: t, enabled: true } })}>
              {t === 'highpass' ? 'HP' : t === 'lowpass' ? 'LP' : 'BP'}
            </button>
          ))}
        </div>
        <div className="knobs" style={{ opacity: m.filter.enabled ? 1 : 0.45 }}>
          <Knob label="Freq" size={30} value={m.filter.cutoff} min={20} max={20000} log unit="Hz" defaultValue={8000} onChange={(v) => set({ filter: { ...m.filter, cutoff: v } })} />
          <Knob label="Res" size={30} value={m.filter.q} min={0.3} max={15} step={0.1} defaultValue={0.7} onChange={(v) => set({ filter: { ...m.filter, q: v } })} />
        </div>
      </div>

      <div className="strip-section">
        <div className="head">
          <span>Comp</span>
          <Toggle label="" on={m.comp.enabled} onChange={(v) => A.setMixer(track.id, { comp: { ...m.comp, enabled: v } })} />
        </div>
        <div className="knobs" style={{ opacity: m.comp.enabled ? 1 : 0.45 }}>
          <Knob label="Thresh" size={30} value={m.comp.threshold} min={-48} max={0} step={0.5} unit="dB" defaultValue={-18} onChange={(v) => set({ comp: { ...m.comp, threshold: v } })} />
          <Knob label="Ratio" size={30} value={m.comp.ratio} min={1} max={20} step={0.1} defaultValue={3} format={(v) => `${v.toFixed(1)}:1`} onChange={(v) => set({ comp: { ...m.comp, ratio: v } })} />
        </div>
      </div>

      <div className="strip-section">
        <div className="head">
          <span>Sends</span>
        </div>
        <div className="knobs">
          <Knob label="Reverb" size={30} value={m.sends.reverb} min={0} max={1} step={0.01} color="#3cc0c9" defaultValue={0} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ sends: { ...m.sends, reverb: v } })} />
          <Knob label="Delay" size={30} value={m.sends.delay} min={0} max={1} step={0.01} color="#a37cf0" defaultValue={0} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ sends: { ...m.sends, delay: v } })} />
        </div>
      </div>

      <Knob label="Pump" size={30} value={m.sidechain ?? 0} min={0} max={1} step={0.01} color="var(--accent)" defaultValue={0} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ sidechain: v })} />
      <Knob label="Pan" size={34} value={m.pan} min={-1} max={1} step={0.01} bipolar defaultValue={0} format={panFmt} onChange={(v) => set({ pan: v })} />

      <div className="fader-wrap">
        <Fader value={m.volume} height={FADER_H} onChange={(v) => set({ volume: v })} />
        <Meter read={read} />
      </div>
      <div className="db-label">{m.volume <= -60 ? '−∞' : `${m.volume > 0 ? '+' : ''}${m.volume.toFixed(1)} dB`}</div>
      <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
        <button className={`ms m ${m.mute ? 'on' : ''}`} onClick={() => A.toggleMute(track.id)} aria-pressed={m.mute}>
          M
        </button>
        <button className={`ms s ${m.solo ? 'on' : ''}`} onClick={() => A.toggleSolo(track.id)} aria-pressed={m.solo}>
          S
        </button>
      </div>
    </div>
  );
}

function MasterStrip() {
  const master = useStore((s) => s.project.master);
  const set = (patch: Partial<MasterSettings>, history = false) => A.setMaster(patch, { history });
  const read = useCallback(() => engine.masterLevel(), []);
  return (
    <div className="strip master">
      <div className="strip-name" style={{ borderBottomColor: 'var(--accent)' }}>
        Master
      </div>
      <div className="strip-section">
        <div className="head">
          <span>Reverb bus</span>
        </div>
        <div className="knobs">
          <Knob label="Decay" size={30} value={master.reverb.decay} min={0.4} max={8} step={0.1} unit="s" defaultValue={2.8} onChange={(v) => set({ reverb: { ...master.reverb, decay: v } })} />
          <Knob label="Return" size={30} value={master.reverb.wet} min={0} max={1} step={0.01} defaultValue={1} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ reverb: { ...master.reverb, wet: v } })} />
        </div>
      </div>
      <div className="strip-section">
        <div className="head">
          <span>Delay bus</span>
        </div>
        <select className="select" value={master.delay.time} onChange={(e) => set({ delay: { ...master.delay, time: e.target.value as MasterSettings['delay']['time'] } }, true)}>
          <option value="16n">1/16</option>
          <option value="8t">1/8 triplet</option>
          <option value="8n">1/8</option>
          <option value="8n.">1/8 dotted</option>
          <option value="4n">1/4</option>
        </select>
        <Knob label="Feedback" size={30} value={master.delay.feedback} min={0} max={0.9} step={0.01} defaultValue={0.35} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ delay: { ...master.delay, feedback: v } })} />
      </div>
      <div className="strip-section">
        <Toggle label="Limiter" on={master.limiter} onChange={(v) => set({ limiter: v }, true)} />
      </div>
      <div className="fader-wrap">
        <Fader value={master.volume} height={FADER_H} onChange={(v) => set({ volume: v })} />
        <Meter read={read} />
      </div>
      <div className="db-label">{master.volume <= -60 ? '−∞' : `${master.volume > 0 ? '+' : ''}${master.volume.toFixed(1)} dB`}</div>
    </div>
  );
}

export function Mixer() {
  const tracks = useStore((s) => s.project.tracks);
  return (
    <div className="mixer">
      {tracks.map((t) => (
        <Strip key={t.id} track={t} />
      ))}
      <div style={{ flex: 1 }} />
      <MasterStrip />
    </div>
  );
}
