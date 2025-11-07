// src/pages/Landing_page.jsx
import React, { useState } from 'react';
import './landing_page.css';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useSession } from '../context/SessionContext';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../components/loaders/LoadingPopup';
import ForgotPasswordModal from '../components/modals/ForgotPasswordModal'; // modal that calls resetPasswordForEmail

export const Landing_page = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ id: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(false); // NEW
  const navigate = useNavigate(); // programmatic navigation after login
  const { setSession } = useSession();

  // Forgot Password modal
  const [forgotOpen, setForgotOpen] = useState(false); // controls the modal

  const handleInputChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // LOGIN with unified lookup + inactive guard
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const id = (form.id || '').trim();
    const pw = form.password || '';
    if (!id) {
      setError('Please enter your Applicant ID, Student ID, or Email.');
      return;
    }
    if (!pw) {
      setError('Please enter your password.');
      return;
    }

    try {
      setBusy(true);

      // Build an OR filter across columns; maybeSingle() returns null on no match (no 406)
      // If it's an email, check only email; otherwise check applicant_id or student_id
      const { data: userRow, error: fErr } = await (
        looksLikeEmail(id)
          ? supabase.from('users').select('*').eq('email', id)
          : supabase
              .from('users')
              .select('*')
              .or(`applicant_id.eq.${id},student_id.eq.${id}`)
      ).maybeSingle();

      if (fErr) throw fErr;
      if (!userRow) {
        setError('No account found for the provided identifier.');
        return;
      }
      if (String(userRow.password_hash) !== String(pw)) {
        setError('Incorrect password.');
        return;
      }

      // Strict inactive gate: only block when explicitly false
      if (userRow.is_active === false) {
        setInactiveOpen(true);
        setForm((f) => ({ ...f, password: '' })); // clear password
        return; // do NOT setSession or navigate
      }

      // Active -> proceed
      setSession(userRow.user_id, userRow.role);

      switch (userRow.role) {
        case 'applicant':
          navigate('/Applicant_Homepage');
          break; // route
        case 'student':
          navigate('/Student_Homepage');
          break; // route
        case 'adviser':
        case 'teacher':
          navigate('/Teacher_Homepage');
          break; // route
        case 'dept_head':
          navigate('/DeptHead_Dashboard');
          break; // route
        case 'principal':
          navigate('/Dashboard');
          break; // route
        case 'super_admin':
          navigate('/Admin_Dashboard');
          break; // route
        default:
          setError('Unknown user role. Please contact support.');
          break;
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header />
      <LoadingPopup
        show={busy}
        message="Working..."
        Loader={GridLoader}
        color="#3FB23F"
      />
      <div className="content">
        <div
          className="landing_page"
          style={{
            backgroundImage:
              'linear-gradient(rgba(41,112,60,.5), rgba(41,112,60,.5)), url("/school.png")',
          }}
        >
          <div className="container">
            <div className="mission_Vision">
              <div className="titleName">
                <h2>Student Enrollment and Grading Access System</h2>
              </div>
              <div className="mission">
                <h2>Mission</h2>
                <p>
                  To protect the right of every Filipino to quality, equitable,
                  culture-based, and complete basic education where: Students
                  learn in a child-friendly, gender sensitive, and safe and
                  motivating environment.
                </p>
              </div>
              <div className="vision">
                <h2>Vision</h2>
                <p>
                  We dream of Filipinos who passionately love their country and
                  whose competencies and values enable them to realize their
                  full potential and contribute meaningfully to building the
                  nation. As a learner-centered public institution, the Benigno
                  Aquino Jr. High School continuously improves itself to better
                  service its stakeholders.
                </p>
              </div>
            </div>

            <div className="login_Form">
              <h2>User Authentication</h2>
              <div className="login_Form_Box">
                <form onSubmit={handleLogin}>
                  <div className="input_Box">
                    <label>Login ID</label>
                    <input
                      placeholder="Enter Applicant ID / Student ID / Email"
                      name="id"
                      value={form.id}
                      onChange={handleInputChange}
                      required
                      autoComplete="username"
                    />
                  </div>

                  <div className="input_Box">
                    <label>Password</label>
                    <input
                      placeholder="Enter Password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleInputChange}
                      required
                      autoComplete="current-password"
                    />

                    <i
                      className={`fa ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}
                      aria-hidden="true"
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </div>

                  <div className="errorShow">
                    {error && (
                      <div className="error" role="alert">
                        <p>{error}</p>
                      </div>
                    )}
                  </div>

                  <div className="passoption">
                    <p onClick={() => setForgotOpen(true)}>Forgot Password?</p>
                  </div>

                  <button type="submit" className="btn" disabled={busy}>
                    {busy ? 'Signing in…' : 'Login'}
                  </button>

                  <div className="enroll">
                    <p>
                      Are you an applicant/enrollee?{' '}
                      <Link to="/Register_ph1">Apply/Enroll here.</Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Inactive account modal */}
          {inactiveOpen && (
            <div
              role="dialog"
              aria-modal="true"
              className="modal-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 1000,
              }}
            >
              <div
                className="modal"
                style={{
                  background: '#fff',
                  borderRadius: 8,
                  padding: 20,
                  maxWidth: 420,
                  width: '90%',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ marginBottom: 8 }}>Account inactive</h3>
                <p style={{ color: '#444', marginBottom: 16 }}>
                  Your account is currently deactivated. Please contact the
                  administrator for assistance.
                </p>
                <button onClick={() => setInactiveOpen(false)}>OK</button>
              </div>
            </div>
          )}

          {/* Forgot Password Modal: sends Supabase reset email and redirects back to /reset-password */}
          <ForgotPasswordModal
            isOpen={forgotOpen}
            onClose={() => setForgotOpen(false)}
            redirectPath="/reset-password"
          />
        </div>
        <Footer />
      </div>
    </>
  );
};
