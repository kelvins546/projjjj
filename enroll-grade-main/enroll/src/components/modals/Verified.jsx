import './verified.css';
import { useNavigate } from 'react-router-dom';

export const Verified_Box = ({ showVerifiedBox }) => {
  const navigate = useNavigate();

  if (!showVerifiedBox) return null;

  const handleLoginRedirect = () => {
    navigate('/'); };

  return (
    <div className='verified-box-overlay'>
      <div className="verifiedBox">
        <div className='img' style={{ paddingTop: "10px" }}>
          <img src="checkImg.png" alt="Bagong Pilipinas Logo" />
        </div>
        <h2>Verification Successful</h2>
<p>
  Your email has been successfully verified. <br />
  Please check your inbox for your <strong>Applicant ID</strong> and login instructions.
</p>
        <button onClick={handleLoginRedirect}>Login</button>
      </div>
    </div>
  );
};
