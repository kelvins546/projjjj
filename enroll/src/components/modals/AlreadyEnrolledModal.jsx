import React from 'react';
import './AlreadyEnrolledModal.css';
export default function AlreadyEnrolledModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>NOTICE OF ENROLLMENT</h2>
        <p>You've already completed this application.</p>
        <div className="center-btn">
          <button onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
