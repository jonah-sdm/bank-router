import { useEffect } from 'react';

// Minimal modal shell. Closes via backdrop click, the ×, or Esc.
// Pass `isDirty` to guard accidental close (backdrop or Esc) when content has
// unsaved edits; the user is asked to confirm.
export default function Modal({ title, onClose, footer, children, isDirty = false }) {

  function attemptClose() {
    if (isDirty) {
      // eslint-disable-next-line no-alert
      if (!confirm('Discard unsaved changes?')) return;
    }
    onClose?.();
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') attemptClose(); };
    document.addEventListener('keydown', onKey);
    // lock body scroll while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  return (
    <div className="modal-backdrop" onClick={attemptClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-x" onClick={attemptClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
