import './logout_modal.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../loaders/LoadingPopup';

export const Logout_Modal = ({ show, onClose }) => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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

  const handleLogout = () => {
    setLoggingOut(true);

    setTimeout(() => {
      localStorage.removeItem('user_id');
      localStorage.removeItem('role');
      navigate('/');
      onClose();
    }, 1500); 
  };

  if (!show) return null;

  return (
    <div className="logout-box-overlay">
      <LoadingPopup
        show={loggingOut}
        message="Logging Out..."
        Loader={GridLoader}
        color="#F5A623"
      />

      {!loggingOut && (
        <div className="logout-modal-box">
          <div className="title">
            <h2>Confirm Logout</h2>
            <p>Are you sure you want to log out?</p>
          </div>
          <div className="logout-box-buttons">
            <button className="confirm-btn" onClick={handleLogout}>
              Confirm
            </button>
            <button className="cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
