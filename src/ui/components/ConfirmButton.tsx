import { useEffect, useState, type ReactNode } from 'react';

/**
 * Two-step destructive button: the first click arms it, the second confirms.
 * Used instead of window.confirm(), which embedded viewers may block.
 */
export function ConfirmButton({ onConfirm, children, label, confirmText = 'Delete?' }: { onConfirm: () => void; children: ReactNode; label: string; confirmText?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`btn small ${armed ? 'danger-armed' : 'ghost danger'}`}
      aria-label={armed ? `Confirm: ${label}` : label}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmText : children}
    </button>
  );
}
