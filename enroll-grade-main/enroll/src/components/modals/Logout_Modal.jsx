import './logout_modal.css';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const Logout_Modal = ({ show, onClose }) => {
  const navigate = useNavigate();

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
    localStorage.removeItem('user_id');
    localStorage.removeItem('role');

    onClose();
    navigate('/');
  };

  if (!show) return null;

  return (
    <div className="logout-box-overlay">
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
    </div>
  );
};
