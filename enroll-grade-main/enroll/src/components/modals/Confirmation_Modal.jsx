import './confirmation_modal.css';
import { useEffect } from 'react';

export const Confirmation_Modal = ({ show, onClose, onConfirm }) => {
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="confirmOverlay" onClick={onClose}>
      <div className="confirm-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="title">
          <h2>Confirm Accept</h2>
          <p>Are you sure you want to accept?</p>
        </div>
        <div className="confirm-box-buttons">
          <button className="confirm-btn" onClick={onConfirm}>
            Confirm
          </button>
          <button className="cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
