import { Header } from '../components/Header';
import { Link } from 'react-router-dom';
import './register.css';
import { Terms_And_Conditions } from '../components/forms/Registration_Terms_And_Conditions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Otp_Modal } from '../components/modals/Otp_Modal';
import { supabase } from '../supabaseClient';
import emailjs from 'emailjs-com';
import { HasAccount } from '../components/modals/HasAccount';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../components/loaders/LoadingPopup';

export const Register_ph1 = () => {
  const [show, setShow] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState('');
  const [showHasAccount, setShowHasAccount] = useState(false);
  const [busy, setBusy] = useState(false); // block double submit during OTP send

  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    suffix: '',
    birthDate: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessages, setErrorMessages] = useState({});
  const emailLookupTimer = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target || {};
    // Keep whitespace tidy and avoid accidental leading/trailing spaces
    const trimmed = [
      'email',
      'lastName',
      'firstName',
      'middleName',
      'suffix',
    ].includes(name)
      ? value.replace(/\s{2,}/g, ' ')
      : value;
    setFormData((prev) => ({ ...prev, [name]: trimmed }));
  };

  const sendOtpToEmail = async (email, otpCode) => {
    // Returns a promise to allow awaiting and error handling
    return emailjs.send(
      'service_dqnfkgj',
      'template_nb9e4to',
      { to_email: email, otp_code: otpCode },
      '9gSnrINVUn_cu5Wr9'
    );
  };

  const validateForm = () => {
    const errors = {};
    const nameRegex = /^[A-Za-z\s'-]+$/;

    // Names
    if (!formData.lastName.trim()) errors.lastName = 'Last Name is required';
    else if (!nameRegex.test(formData.lastName))
      errors.lastName = 'Only letters, spaces, apostrophes, and hyphens';
    if (!formData.firstName.trim()) errors.firstName = 'First Name is required';
    else if (!nameRegex.test(formData.firstName))
      errors.firstName = 'Only letters, spaces, apostrophes, and hyphens';
    if (formData.middleName && !nameRegex.test(formData.middleName))
      errors.middleName = 'Only letters, spaces, apostrophes, and hyphens';
    if (formData.suffix && !/^[A-Za-z0-9.\-]{0,10}$/.test(formData.suffix))
      errors.suffix = 'Max 10 chars; letters/numbers/.- only';

    // Birthdate and age
    if (!formData.birthDate.trim()) {
      errors.birthDate = 'Birthdate is required';
    } else {
      const birth = new Date(formData.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 12) errors.birthDate = 'Must be at least 12 years old';
      if (age > 100) errors.birthDate = 'Age cannot exceed 100 years';
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(formData.email))
      errors.email = 'Invalid email address';

    // Password
    const pw = formData.password;
    if (!pw) errors.password = 'Password is required';
    else {
      if (pw.length < 8) errors.password = 'At least 8 characters';
      else if (!/[A-Z]/.test(pw))
        errors.password = 'At least one uppercase letter';
      else if (!/[a-z]/.test(pw))
        errors.password = 'At least one lowercase letter';
      else if (!/[0-9]/.test(pw)) errors.password = 'At least one number';
      else if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw))
        errors.password = 'At least one special character';
    }

    if (!formData.confirmPassword)
      errors.confirmPassword = 'Confirm your password';
    else if (formData.password !== formData.confirmPassword)
      errors.confirmPassword = 'Passwords do not match';

    setErrorMessages(errors);
    return Object.keys(errors).length === 0;
  };

  // Debounced email existence check to provide early feedback without changing your flow
  useEffect(() => {
    if (emailLookupTimer.current) clearTimeout(emailLookupTimer.current);
    if (!formData.email) {
      setErrorMessages((prev) => ({
        ...prev,
        email: prev.email && prev.email.startsWith('Already') ? '' : prev.email,
      }));
      return;
    }
    emailLookupTimer.current = setTimeout(async () => {
      try {
        const { data: existing, error } = await supabase
          .from('users')
          .select('email')
          .eq('email', formData.email)
          .single(); // single() returns error with code when not found [web:5]

        if (existing) {
          setErrorMessages((prev) => ({
            ...prev,
            email: 'Already registered. Use a different email.',
          }));
        } else if (error && error.code === 'PGRST116') {
          // not found: clear "already" error if present
          setErrorMessages((prev) => ({
            ...prev,
            email: prev.email?.startsWith('Already') ? '' : prev.email,
          }));
        }
      } catch {
        // ignore here; main submit still validates
      }
    }, 500);
    return () => clearTimeout(emailLookupTimer.current);
  }, [formData.email]);

  const handleNext = async (e) => {
    e.preventDefault();
    if (!validateForm() || busy) return;

    try {
      setBusy(true);

      // Server-side email existence check (final gate)
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('email')
        .eq('email', formData.email)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        setErrorMessages((prev) => ({
          ...prev,
          email: 'Error validating email. Please try again.',
        }));
        return;
      }

      if (existingUser) {
        setShowHasAccount(true);
        return;
      }

      // Generate and send OTP
      const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
      setOtp(newOtp);
      await sendOtpToEmail(formData.email, newOtp);
      setShowOTP(true);
    } catch (err) {
      setErrorMessages((prev) => ({
        ...prev,
        email: 'Failed to send OTP. Please try again.',
      }));
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async (email) => {
    try {
      const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
      setOtp(newOtp);
      await sendOtpToEmail(email, newOtp);
    } catch {
      // keep modal open; you may show a small toast if you have one
    }
  };

  // Accessibility: describe the eye buttons
  const pwToggleLabel = useMemo(
    () => (showPassword ? 'Hide password' : 'Show password'),
    [showPassword]
  );
  const cpwToggleLabel = useMemo(
    () =>
      showConfirmPassword ? 'Hide confirm password' : 'Show confirm password',
    [showConfirmPassword]
  );

  return (
    <>
      <Header />
      <LoadingPopup
        show={busy}
        message="Sending OTP... "
        Loader={GridLoader}
        color="#3FB23F"
      />
      <HasAccount
        show={showHasAccount}
        onClose={() => setShowHasAccount(false)}
      />

      <div className="mainContent">
        <div className="registerBackground">
          <Terms_And_Conditions show={show} onHide={() => setShow(false)} />
          <Otp_Modal
            showOTPbox={showOTP}
            onBack={() => setShowOTP(false)}
            expectedOtp={otp}
            userData={formData}
            onSuccess={() => setShowOTP(false)}
            onResendOtp={resendOtp}
          />

          <div className="registrationBox">
            <div>
              <h2>User Registration</h2>
              <p>Register to access the enrollment system</p>

              <form onSubmit={handleNext} noValidate>
                <div className="registrationFullName">
                  <div className="inputGroup1">
                    <label htmlFor="lastName">Last Name*</label>
                    <input
                      id="lastName"
                      name="lastName"
                      className="name"
                      autoComplete="family-name"
                      value={formData.lastName}
                      onChange={handleInputChange}
                    />
                    <div className="errorContainer">
                      {errorMessages.lastName && (
                        <p className="error">{errorMessages.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="inputGroup1">
                    <label htmlFor="firstName">First Name*</label>
                    <input
                      id="firstName"
                      name="firstName"
                      className="name"
                      autoComplete="given-name"
                      value={formData.firstName}
                      onChange={handleInputChange}
                    />
                    <div className="errorContainer">
                      {errorMessages.firstName && (
                        <p className="error">{errorMessages.firstName}</p>
                      )}
                    </div>
                  </div>

                  <div className="inputGroup1">
                    <label htmlFor="middleName">Middle Name</label>
                    <input
                      id="middleName"
                      name="middleName"
                      className="name"
                      value={formData.middleName}
                      onChange={handleInputChange}
                    />
                    <div className="errorContainer">
                      {errorMessages.middleName && (
                        <p className="error">{errorMessages.middleName}</p>
                      )}
                    </div>
                  </div>

                  <div className="inputGroup1">
                    <label htmlFor="suffix">Suffix</label>
                    <input
                      id="suffix"
                      type="text"
                      name="suffix"
                      className="suffix"
                      autoComplete="honorific-suffix"
                      value={formData.suffix}
                      onChange={handleInputChange}
                    />
                    <div className="errorContainer">
                      {errorMessages.suffix && (
                        <p className="error">{errorMessages.suffix}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="registrationInput2">
                  <div className="inputGroup2">
                    <label htmlFor="birthDate">Birthdate*</label>
                    <input
                      id="birthDate"
                      type="date"
                      name="birthDate"
                      className="birthdate"
                      value={formData.birthDate}
                      onChange={handleInputChange}
                    />
                    <div className="errorContainer">
                      {errorMessages.birthDate && (
                        <p className="error">{errorMessages.birthDate}</p>
                      )}
                    </div>
                  </div>

                  <div className="inputGroup2">
                    <label htmlFor="email">Email*</label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      className="registrationEmail"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                    <div className="errorContainer">
                      {errorMessages.email && (
                        <p className="error">{errorMessages.email}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="registrationInput3">
                  <div className="inputGroup3" style={{ position: 'relative' }}>
                    <label htmlFor="password">Password*</label>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={handleInputChange}
                    />
                    <div className="errorContainer">
                      {errorMessages.password && (
                        <p className="error">{errorMessages.password}</p>
                      )}
                    </div>

                    <i
                      className={`fa ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}
                      aria-hidden="true"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '30%',
                        transform: 'translateY(50%)',
                        fontSize: '17px',
                        color: showPassword ? '#248041' : '#555',
                        cursor: 'pointer',
                        transition: 'color 0.2s ease',
                      }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    ></i>
                  </div>

                  <div className="inputGroup3" style={{ position: 'relative' }}>
                    <label htmlFor="confirmPassword">Confirm Password*</label>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                    />
                    {errorMessages.confirmPassword && (
                      <p className="error">{errorMessages.confirmPassword}</p>
                    )}

                    <i
                      className={`fa ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'}`}
                      aria-hidden="true"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '30%',
                        transform: 'translateY(50%)',
                        fontSize: '17px',
                        color: showConfirmPassword ? '#248041' : '#555',
                        cursor: 'pointer',
                        transition: 'color 0.2s ease',
                      }}
                      title={
                        showConfirmPassword
                          ? 'Hide confirm password'
                          : 'Show confirm password'
                      }
                    />
                  </div>
                </div>

                <div className="button1">
                  <button
                    className="registrationPh1_Next"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? 'Sending OTP…' : 'Next'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="backToLogin">
            <p>
              Already have an account? {}
              <Link to="/">Login here.</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
