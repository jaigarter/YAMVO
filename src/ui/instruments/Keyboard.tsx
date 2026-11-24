import { useState } from 'react';
import type { Track } from '../../model/types';
import { engine } from '../../engine';
import { noteName } from '../../model/theory';
import { useMidiStatus } from '../../midi/input';

const BLACK = new Set([1, 3, 6, 8, 10]);

/** Clickable on-screen keyboard (3 octaves around the current QWERTY octave). */
export function Keyboard({ track }: { track: Track }) {
  const { octave } = useMidiStatus();
  const [down, setDown] = useState<number | null>(null);
  const start = track.kind === 'drums' ? 36 : Math.max(1, octave) * 12;
  const notes = Array.from({ length: 37 }, (_, i) => start + i);
  const whites = notes.filter((n) => !BLACK.has(n % 12));
  const press = (n: number) => {
    setDown(n);
    engine.noteOn(track.id, n, 0.85);
    const up = () => {
      engine.noteOff(track.id, n);
      setDown(null);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="keyboard" role="group" aria-label="Keyboard">
      {whites.map((n) => (
        <div key={n} className={`kb-white ${down === n ? 'down' : ''}`} onPointerDown={() => press(n)}>
          {n % 12 === 0 ? noteName(n) : ''}
        </div>
      ))}
      {notes
        .filter((n) => BLACK.has(n % 12))
        .map((n) => {
          const whiteIndex = whites.filter((w) => w < n).length;
          return <div key={n} className={`kb-black ${down === n ? 'down' : ''}`} style={{ left: whiteIndex * 30 - 10 }} onPointerDown={() => press(n)} />;
        })}
    </div>
  );
}
