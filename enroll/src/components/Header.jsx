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
    <header className="header">
      <div className="header_brand">
        <div className="logos">
          <img src="/bagongpilipinaslogo2.png" alt="Bagong Pilipinas" />
          <img src="/caloocan_logo.png" alt="Caloocan City" />
          <img src="/schoollogo.png" alt="School Logo" />
        </div>
        <h1 className="desktop">
          <span className="line1">BENIGNO AQUINO JR. </span>
          <span className="line2">HIGH SCHOOL</span>
        </h1>
      </div>

      {hasProfile && (
        <div className="profile" onClick={() => setShowAccountOption(true)}>
          <span className="profile_initial">U</span>{' '}
          {/* Adjust dynamically later */}
          <AccountOption
            show={showAccountOption}
            onClose={() => setShowAccountOption(false)}
          />
        </div>
      )}
    </header>
  );
};
