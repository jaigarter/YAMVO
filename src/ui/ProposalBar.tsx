import { useState } from 'react';
import { useStore } from '../state/store';
import * as A from '../state/actions';
import { SparkIcon, PlayIcon, StopIcon } from './components/Icons';

/** Floating card for an AI change waiting for Keep / Discard. */
export function ProposalBar() {
  const proposal = useStore((s) => s.ui.proposal);
  const playing = useStore((s) => s.playing);
  const [open, setOpen] = useState(false);
  if (!proposal) return null;
  return (
    <div className="proposal" role="region" aria-label="AI proposal">
      <div className="proposal-main">
        <span className="proposal-icon">
          <SparkIcon />
        </span>
        <div className="proposal-text">
          <strong>{proposal.title}</strong>
          <span>{proposal.message}</span>
        </div>
        <button className="btn" onClick={() => void A.togglePlay()} aria-label={playing ? 'Stop' : 'Listen'}>
          {playing ? <StopIcon size={12} /> : <PlayIcon size={12} />} {playing ? 'Stop' : 'Listen'}
        </button>
        <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          {proposal.changes.length} changes
        </button>
        <button className="btn ghost" onClick={A.discardProposal}>
          Discard
        </button>
        <button className="btn primary" onClick={A.acceptProposal}>
          Keep
        </button>
      </div>
      {open && (
        <ul className="proposal-changes">
          {proposal.changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
          {proposal.errors.map((e, i) => (
            <li key={`e${i}`} className="skipped">
              Skipped: {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
