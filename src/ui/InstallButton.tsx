import { useEffect, useState } from 'react';
import { installState, requestInstall } from '../platform/desktop';
import * as A from '../state/actions';

/** "Install app" — shown only where the Claude desktop app can install GROOVE LAB. */
export function InstallButton() {
  const [state, setState] = useState<'available' | 'installed' | 'unavailable'>('unavailable');
  useEffect(() => {
    let alive = true;
    void installState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  if (state !== 'available') return null;
  return (
    <button
      className="btn"
      title="Install GROOVE LAB as a desktop app with its own window and Dock icon"
      onClick={() => {
        void requestInstall().then((r) => {
          if (r === 'installed') {
            setState('installed');
            A.toast('Installing GROOVE LAB…');
          } else if (r === 'failed') A.toast('The install did not complete — try again from the artifact menu');
        });
      }}
    >
      Install app
    </button>
  );
}
