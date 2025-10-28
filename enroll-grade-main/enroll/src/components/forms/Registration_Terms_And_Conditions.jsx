import './registration_terms_and_conditions.css';
import { useEffect, useState } from 'react';

export const Terms_And_Conditions = ({ onAccept }) => {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setShow(true);
  }, []);

  const handleClose = () => {
    if (checked) {
      setShow(false);
      if (onAccept) onAccept(); 
    }
  };

  if (!show) return null; 

  return (
    <div className="overlay">
      <div className="termsAndConditions box">
        <div className='terms'>
        <h2 className="title">Terms and Conditions</h2>
        <h3 className="subtitle">
          Benigno Aquino Junior High School Student Enrollment with Grading Access System
        </h3>

        <p>
          By creating an account and using this system, you agree to comply with the following Terms and Conditions. 
          Please read them carefully before proceeding with enrollment and accessing the grading portal.
        </p>

        <ol>
          <li>
            <strong>Purpose of the System</strong>
            <ul>
              <li>Facilitate online student registration and enrollment.</li>
              <li>Allow students, parents/guardians, and teachers to monitor academic performance.</li>
              <li>Provide administrators with tools for managing student records and analytics.</li>
            </ul>
          </li>

          <li>
            <strong>User Eligibility</strong>
            <ul>
              <li>Only duly enrolled students of Benigno Aquino Junior High School, their parents/guardians, authorized faculty members, and designated staff are allowed to create and maintain accounts.</li>
              <li>Users must provide accurate and verifiable personal information during the registration process.</li>
            </ul>
          </li>

          <li>
            <strong>Account Responsibility</strong>
            <ul>
              <li>You are solely responsible for maintaining the confidentiality of your login credentials.</li>
              <li>Any actions taken under your account are your responsibility.</li>
              <li>Sharing of accounts is strictly prohibited.</li>
            </ul>
          </li>

          <li>
            <strong>Data Privacy</strong>
            <ul>
              <li>The system collects personal information such as student details, guardian information, academic records, and documents necessary for school enrollment.</li>
              <li>Collected information will only be used for school-related purposes, in compliance with the Data Privacy Act of 2012 (RA 10173).</li>
              <li>The school ensures that all reasonable safeguards are in place to protect student and guardian data.</li>
            </ul>
          </li>

          <li>
            <strong>User Conduct</strong>
            <p>By using the system, you agree that you will not:</p>
            <ul>
              <li>Provide false or misleading information.</li>
              <li>Attempt to gain unauthorized access to other accounts or restricted areas.</li>
              <li>Misuse any enrollment or grading information for fraudulent or malicious activities.</li>
            </ul>
          </li>

          <li>
            <strong>Academic Records and Grading</strong>
            <ul>
              <li>Grades and academic information displayed are official records maintained by the school.</li>
              <li>Any disputes regarding grades must be addressed through proper school procedures, not through direct changes in the system.</li>
            </ul>
          </li>

          <li>
            <strong>System Availability</strong>
            <ul>
              <li>While the school takes measures to ensure the availability of the system, there may be occasional downtime for maintenance or unforeseen technical issues.</li>
              <li>The school will not be held liable for any inconvenience caused by system unavailability.</li>
            </ul>
          </li>

          <li>
            <strong>Modification of Terms</strong>
            <ul>
              <li>The school reserves the right to update or modify these Terms and Conditions at any time.</li>
              <li>Continued use of the system after such changes constitutes acceptance of the updated terms.</li>
            </ul>
          </li>

          <li>
            <strong>Termination of Access</strong>
            <ul>
              <li>The school may suspend or permanently revoke a user’s access for violations of these Terms and Conditions, or for misuse of the system.</li>
            </ul>
          </li>
        </ol>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          I Agree to proceed with account creation, I acknowledge that I have read, understood, and accepted these Terms and Conditions.
        </label>
        <div className='buttons'>
            <button onClick={handleClose} disabled={!checked}>
          Next
        </button>
        </div>
        </div>
      </div>
    </div>
  );
};
