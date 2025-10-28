import { useState } from 'react';
import './header.css';
import { AccountOption } from './modals/AccountOption';

export const Header = ({ userRole }) => {
  const [showAccountOption, setShowAccountOption] = useState(false);

  const hasProfile =
    userRole === 'student' ||
    userRole === 'teacher' ||
    userRole === 'applicant' ||
    userRole === 'admin';

  return (
    <div className="header">
      <div className="logos">
        <img src="/bagongpilipinaslogo2.png"></img>
        <img src="/caloocan_logo.png"></img>
        <img src="/schoollogo.png"></img>
      </div>
      <h1 className="desktop">
        <strong>
          <span className="line1">BENIGNO AQUINO JR.</span>
          <span className="line2">HIGH SCHOOL</span>
        </strong>
      </h1>
      {hasProfile && (
        <div className="profile" onClick={() => setShowAccountOption(true)}>
          <AccountOption
            show={showAccountOption}
            onClose={() => setShowAccountOption(false)}
          />
        </div>
      )}
    </div>
  );
};
