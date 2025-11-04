import React from 'react';
import './EnrollmentSuccessModal.css';
import { useNavigate } from 'react-router-dom';

const EnrollmentSuccessModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate(); // programmatic navigation [web:241]

  if (!isOpen) return null; // simple guard when hidden

  const handleProceed = () => {
    onClose();
    navigate('/Applicant_Homepage'); // keep existing redirect [web:241]
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog_title"
      aria-describedby="dialog_desc"
    >
      <div className="modal-content">
        <div className="img" style={{ paddingTop: '10px' }}>
          <img src="checkImg.png" alt="Submission received" />
        </div>

        {/* Title and description reflect application submission, not enrollment */}
        <h2 id="dialog_title">Application Submitted</h2>
        <p id="dialog_desc">
          You’ll receive an update once it’s approved or if additional
          information is required.
        </p>

        <div
          style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}
        >
          <button onClick={handleProceed}>Proceed to Home</button>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentSuccessModal;
