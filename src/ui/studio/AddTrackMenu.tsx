import { PRESETS, PRESET_CATEGORIES, type PresetCategory } from '../../instruments/presets';
import * as A from '../../state/actions';

const CATS: PresetCategory[] = PRESET_CATEGORIES;

export function AddTrackMenu({ onClose, style }: { onClose: () => void; style?: React.CSSProperties }) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="popover" style={{ ...style, maxHeight: 460, overflow: 'auto', width: 280 }} role="menu">
        {CATS.map((cat) => (
          <div key={cat}>
            <div className="menu-label">{cat}</div>
            {PRESETS.filter((p) => p.category === cat).map((p) => (
              <button
                key={p.id}
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  A.addTrack(p.id);
                  onClose();
                }}
              >
                {p.name}
                <small>{p.family}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
