import React from 'react';
import './image_modal.css';

export const ImageModal = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="image-modal-close" onClick={onClose}>
          ×
        </button>
        <img
          src={imageUrl}
          alt="Document Preview"
          style={{
            width: 'auto',
            height: '70vh',
            maxWidth: '95vw',
            display: 'block',
            margin: 'auto',
            objectFit: 'contain',
            borderRadius: '12px',
          }}
        />
      </div>
    </div>
  );
};
