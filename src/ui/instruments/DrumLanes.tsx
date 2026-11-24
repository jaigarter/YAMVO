import type { Track } from '../../model/types';
import * as A from '../../state/actions';
import { DrumMachine } from '../../instruments/DrumMachine';
import { DRUM_VOICES, type DrumVoiceId } from '../../instruments/drumSynthesis';
import { Knob } from '../components/controls';
import { engine } from '../../engine';
import { PlayIcon } from '../components/Icons';

const VOICE_IDS = Object.keys(DRUM_VOICES) as DrumVoiceId[];

export function DrumLanes({ track }: { track: Track }) {
  const lanes = DrumMachine.lanesOf(track.instrument);
  return (
    <div className="param-group" style={{ marginBottom: 14 }}>
      <div className="panel-title">Pads</div>
      <table className="lanes-table">
        <thead>
          <tr>
            <th />
            <th>Pad</th>
            <th>Sound</th>
            <th>Tune</th>
            <th>Decay</th>
            <th>Level</th>
            <th>Pan</th>
          </tr>
        </thead>
        <tbody>
          {lanes.map((l) => (
            <tr key={l.note}>
              <td>
                <button className="play-btn" onClick={() => engine.audition(track.id, l.note, 0.9)} aria-label={`Play ${l.name}`}>
                  <PlayIcon size={11} />
                </button>
              </td>
              <td style={{ fontWeight: 600 }}>{l.name}</td>
              <td>
                {l.source.kind === 'synth' ? (
                  <select
                    className="select"
                    value={l.source.voice}
                    onChange={(e) => {
                      A.setDrumLane(track.id, l.note, { source: { kind: 'synth', voice: e.target.value } });
                      setTimeout(() => engine.audition(track.id, l.note, 0.9), 120);
                    }}
                  >
                    {VOICE_IDS.map((v) => (
                      <option key={v} value={v}>
                        {DRUM_VOICES[v].category} — {DRUM_VOICES[v].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="tag">Library sample</span>
                    <button className="btn small ghost" onClick={() => A.setDrumLane(track.id, l.note, { source: { kind: 'synth', voice: 'kick-909' } })}>
                      Use synth voice
                    </button>
                  </span>
                )}
              </td>
              <td>
                <Knob label="" size={30} value={l.tune} min={-12} max={12} step={0.5} unit="st" bipolar defaultValue={0} onChange={(v) => A.setDrumLane(track.id, l.note, { tune: v }, { history: false })} />
              </td>
              <td>
                <Knob label="" size={30} value={l.decay} min={0.2} max={2} step={0.05} defaultValue={1} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => A.setDrumLane(track.id, l.note, { decay: v }, { history: false })} />
              </td>
              <td>
                <Knob label="" size={30} value={l.level} min={-30} max={6} step={0.5} unit="dB" defaultValue={0} onChange={(v) => A.setDrumLane(track.id, l.note, { level: v }, { history: false })} />
              </td>
              <td>
                <Knob label="" size={30} value={l.pan} min={-1} max={1} step={0.05} bipolar defaultValue={0} format={(v) => (Math.abs(v) < 0.03 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} onChange={(v) => A.setDrumLane(track.id, l.note, { pan: v }, { history: false })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: 'var(--text-3)', fontSize: 11, margin: '10px 0 0' }}>Tip: drag any sound from the Library onto a pad name in the step sequencer to replace it.</p>
    </div>
  );
}
