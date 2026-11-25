import { useEffect, useRef } from 'react';
import { Arrange } from './Arrange';
import { ClipEditor } from './ClipEditor';
import { store } from '../../state/store';
import * as A from '../../state/actions';
import { getFocusArea, setFocusArea } from './focus';
import { startDrag } from '../components/pointer';

export function Studio() {
  const ref = useRef<HTMLDivElement>(null);

  // Timeline shortcuts: Delete removes the selected clip, ⌘D duplicates it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || getFocusArea() !== 'timeline') return;
      const { selectedClipId } = store.get().ui;
      if (!selectedClipId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        A.deleteClip(selectedClipId);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        A.duplicateClip(selectedClipId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="studio" ref={ref}>
      <div style={{ minHeight: 0, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }} onPointerDown={() => setFocusArea('timeline')}>
        <Arrange />
      </div>
      <div
        className="splitter"
        onPointerDown={(e) => {
          const el = ref.current!;
          const total = el.clientHeight;
          const start = (el.lastElementChild as HTMLElement).clientHeight;
          startDrag(e, (_dx, dy) => {
            const h = Math.min(total - 170, Math.max(220, start - dy));
            el.style.setProperty('--editor-h', `${h}px`);
          });
        }}
      />
      <ClipEditor />
    </div>
  );
}
