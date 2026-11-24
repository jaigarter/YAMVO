import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { store } from '../../state/store';

/** Generic vertical-drag gesture. Calls checkpoint() once so a drag is one undo step. */
export function useDrag(onDelta: (dy: number, fine: boolean) => void, onEnd?: () => void) {
  const last = useRef(0);
  return (e: RPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    last.current = e.clientY;
    store.checkpoint();
    const move = (ev: PointerEvent) => {
      const dy = last.current - ev.clientY;
      last.current = ev.clientY;
      onDelta(dy, ev.shiftKey);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
}

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  log?: boolean;
  unit?: string;
  defaultValue?: number;
  size?: number;
  color?: string;
  bipolar?: boolean;
  format?: (v: number) => string;
  /** Called continuously while dragging (no history). */
  onChange: (v: number) => void;
}

function toNorm(v: number, min: number, max: number, log?: boolean) {
  if (log && min > 0) return Math.log(v / min) / Math.log(max / min);
  return (v - min) / (max - min);
}
function fromNorm(n: number, min: number, max: number, log?: boolean) {
  n = Math.min(1, Math.max(0, n));
  if (log && min > 0) return min * Math.pow(max / min, n);
  return min + n * (max - min);
}

export function formatValue(v: number, unit?: string): string {
  if (unit === 'Hz') return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v >= 100 ? v.toFixed(0) : v.toFixed(1);
  if (unit === 's') return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`;
  if (unit === 'dB') return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
  if (unit === 'st') return `${v > 0 ? '+' : ''}${Math.round(v)}`;
  if (Number.isInteger(v)) return String(v);
  return Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1);
}

export function Knob({ label, value, min, max, step, log, unit, defaultValue, size = 38, color = 'var(--accent)', bipolar, format, onChange }: KnobProps) {
  const norm = Math.min(1, Math.max(0, toNorm(value, min, max, log)));
  const normRef = useRef(norm);
  normRef.current = norm;
  const drag = useDrag((dy, fine) => {
    const n = normRef.current + dy * (fine ? 0.0015 : 0.006);
    let v = fromNorm(n, min, max, log);
    if (step) v = Math.round(v / step) * step;
    v = Math.min(max, Math.max(min, v));
    normRef.current = toNorm(v, min, max, log);
    onChange(v);
  });
  const r = size / 2 - 4;
  const c = size / 2;
  const a0 = -135;
  const a = a0 + norm * 270;
  const arc = (from: number, to: number) => {
    const p = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [c + r * Math.cos(rad), c + r * Math.sin(rad)];
    };
    const [x1, y1] = p(from);
    const [x2, y2] = p(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    const sweep = to > from ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
  };
  const centre = bipolar ? 0 : a0;
  const [ix, iy] = [c + (r - 5) * Math.cos(((a - 90) * Math.PI) / 180), c + (r - 5) * Math.sin(((a - 90) * Math.PI) / 180)];
  return (
    <div className="knob" title={`${label}: ${format ? format(value) : formatValue(value, unit)}${unit && unit !== 'st' ? ' ' + unit : ''} — drag, shift for fine, double-click to reset`}>
      <svg
        width={size}
        height={size}
        onPointerDown={drag}
        onDoubleClick={() => defaultValue !== undefined && (store.checkpoint(), onChange(defaultValue))}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <path d={arc(a0, 135)} stroke="#2b2e35" strokeWidth={3.5} fill="none" strokeLinecap="round" />
        {Math.abs(a - centre) > 0.5 && <path d={arc(Math.min(centre, a), Math.max(centre, a))} stroke={color} strokeWidth={3.5} fill="none" strokeLinecap="round" />}
        <circle cx={c} cy={c} r={r - 6} fill="#1d1f25" stroke="#33363e" />
        <line x1={c} y1={c} x2={ix} y2={iy} stroke="#e9eaee" strokeWidth={2} strokeLinecap="round" />
      </svg>
      <div className="knob-value">{format ? format(value) : formatValue(value, unit)}</div>
      <div className="knob-label">{label}</div>
    </div>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="toggle-track" />
      {label}
    </span>
  );
}

/** Numeric value editable by vertical drag or double-click to type. */
export function DragNumber({
  value,
  min,
  max,
  step = 1,
  sensitivity = 0.25,
  format = (v) => String(v),
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  sensitivity?: number;
  format?: (v: number) => string;
  onChange: (v: number, opts: { history: boolean }) => void;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const acc = useRef(value);
  const drag = useDrag(
    (dy, fine) => {
      acc.current = Math.min(max, Math.max(min, acc.current + dy * sensitivity * (fine ? 0.2 : 1) * step));
      onChange(Math.round(acc.current / step) * step, { history: false });
    },
  );
  if (editing) {
    return (
      <input
        className="drag-number-input"
        autoFocus
        defaultValue={value}
        aria-label={ariaLabel}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)), { history: true });
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <span
      className="lcd-value drag-number"
      tabIndex={0}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        acc.current = value;
        drag(e);
      }}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') onChange(Math.min(max, value + step), { history: true });
        if (e.key === 'ArrowDown') onChange(Math.max(min, value - step), { history: true });
        if (e.key === 'Enter') setEditing(true);
      }}
      title="Drag up/down · double-click to type"
    >
      {format(value)}
    </span>
  );
}

/** Vertical fader in dB. */
export function Fader({ value, min = -60, max = 6, onChange, height }: { value: number; min?: number; max?: number; onChange: (v: number) => void; height: number }) {
  // Perceptual mapping: more resolution near 0 dB.
  const toPos = (db: number) => Math.pow((Math.max(min, db) - min) / (max - min), 2.2);
  const fromPos = (p: number) => min + Math.pow(Math.min(1, Math.max(0, p)), 1 / 2.2) * (max - min);
  const posRef = useRef(toPos(value));
  posRef.current = toPos(value);
  const usable = Math.max(20, height - 12);
  const drag = useDrag((dy, fine) => {
    posRef.current = Math.min(1, Math.max(0, posRef.current + (dy / usable) * (fine ? 0.25 : 1)));
    const v = fromPos(posRef.current);
    onChange(Math.round(v * 10) / 10);
  });
  return (
    <div className="fader" style={{ height }} onPointerDown={drag} onDoubleClick={() => (store.checkpoint(), onChange(0))} title="Drag · double-click for 0 dB" role="slider" aria-label="Volume" aria-valuenow={value}>
      <div className="fader-track" />
      <div className="fader-thumb" style={{ top: 6 + (1 - toPos(value)) * usable }} />
    </div>
  );
}
