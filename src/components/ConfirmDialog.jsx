import Modal from './Modal.jsx';

// Styled replacement for browser confirm().
//   <ConfirmDialog
//     open={open}
//     title="Delete bank?"
//     body="This cannot be undone."
//     confirmLabel="Delete"
//     danger
//     onConfirm={...}
//     onCancel={...}
//   />
export default function ConfirmDialog({
  open, title, body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}) {
  if (!open) return null;
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={<>
        <button className="btn ghost" onClick={onCancel}>{cancelLabel}</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </>}
    >
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
        {body}
      </div>
    </Modal>
  );
}
