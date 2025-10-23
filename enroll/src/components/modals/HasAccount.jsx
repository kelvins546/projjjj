import './verified.css';
import { useNavigate } from 'react-router-dom';

export const HasAccount = ({ show, onClose, onGoToLanding }) => {
  const navigate = useNavigate();

  if (!show) return null;

  const handleLandingRedirect = () => {
    if (onGoToLanding) {
      onGoToLanding();
    } else {
      navigate('/');
    }
  };

  return (
    <div className='verified-box-overlay'>
      <div className="verifiedBox">
        <div className='img' style={{ paddingTop: "10px" }}>
          <img src="checkImg.png" alt="Bagong Pilipinas Logo" />
        </div>
        <h2>Account Already Exists</h2>
        <p>You already have an account with the same email.</p>
        <button onClick={handleLandingRedirect}>Go to Landing Page</button>
        <button style={{ marginTop: 10, backgroundColor: 'gray' }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
