// src/components/modals/EnrollmentSuccessModal.jsx

import React from 'react';
import './EnrollmentSuccessModal.css';
import { useNavigate } from 'react-router-dom';

const EnrollmentSuccessModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleProceed = () => {
    onClose();
    navigate('/Applicant_Homepage');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="img" style={{ paddingTop: '10px' }}>
          <img src="checkImg.png" alt="Bagong Pilipinas Logo" />
        </div>
        <h2>Enrollment Successful</h2>
        <p>
          Your enrollment has been successfully submitted. Please wait for
          confirmation.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '20px',
          }}
        >
          <button onClick={handleProceed}>Proceed to Home</button>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentSuccessModal;
