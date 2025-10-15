import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './accountOption.css';
import { Logout_Modal } from '../../components/modals/Logout_Modal';

export const AccountOption = ({ show, onClose }) => {
  const boxRef = useRef(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!show) {
      setShowLogoutModal(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !showLogoutModal) {
        onClose();
      }
    };

    const handleDocMouseDown = (e) => {
      if (showLogoutModal) return;
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleDocMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleDocMouseDown);
    };
  }, [show, onClose, showLogoutModal]);

  if (!show) return null;

  const handleConfirmLogout = () => {
    console.log('User logged out');
    setShowLogoutModal(false);
    onClose();
  };

  return (
    <>
      <Logout_Modal
        show={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      <div
        className="account-box-overlay"
        onClick={() => {
          if (!showLogoutModal) onClose();
        }}
      >
        <div
          className="account-box"
          ref={boxRef}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="account-btn"
            onClick={() => navigate('/applicant_profile')}
          >
            Account
          </button>
          <button
            className="logout-btn"
            onClick={() => setShowLogoutModal(true)}
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
};
