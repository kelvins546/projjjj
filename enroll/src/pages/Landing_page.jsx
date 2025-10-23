import { useState } from 'react';
import './landing_page.css';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useSession } from '../context/SessionContext';
import { GridLoader } from 'react-spinners';
import { LoadingPopup } from '../components/loaders/LoadingPopup';

export const Landing_page = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ id: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useSession();

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Simple identifier helpers
  const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const looksNumeric = (v) => /^\d+$/.test(v);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
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

      // 1) Locate the user by identifier only (no password yet)
      let query = supabase.from('users').select('*').limit(1);

      if (looksLikeEmail(id)) {
        query = query.eq('email', id);
      } else if (looksNumeric(id)) {
        // Try applicant_id first, then student_id if needed
        const { data: byApplicant, error: aErr } = await supabase
          .from('users')
          .select('*')
          .eq('applicant_id', id)
          .limit(1);
        if (aErr) throw aErr;
        if (byApplicant && byApplicant.length) {
          query = null; // already found
          var userRow = byApplicant[0];
        } else {
          query = supabase
            .from('users')
            .select('*')
            .eq('student_id', id)
            .limit(1);
        }
      } else {
        // Treat as string ID first (applicant_id), then fallback to email if nothing matches
        query = supabase
          .from('users')
          .select('*')
          .eq('applicant_id', id)
          .limit(1);
      }

      if (!userRow && query) {
        const { data: found, error: fErr } = await query;
        if (fErr) throw fErr;
        userRow = found && found.length ? found[0] : null;
      }

      if (!userRow) {
        setError('No account found for the provided identifier.');
        return;
      }

      // 2) Check password against stored password_hash directly (your flow)
      if (String(userRow.password_hash) !== String(pw)) {
        setError('Incorrect password. Please try again.');
        return;
      }

      // 3) Establish session and route by role
      setSession(userRow.user_id, userRow.role);

      switch (userRow.role) {
        case 'applicant':
          navigate('/Applicant_Homepage');
          break;
        case 'student':
          navigate('/Student_Homepage');
          break;
        case 'adviser':
        case 'teacher':
          navigate('/Teacher_Homepage');
          break;
        case 'dept_head':
          navigate('/DeptHead_Dashboard');
          break;
        case 'principal':
          navigate('/Dashboard');
          break;
        case 'super_admin':
          navigate('/Admin_Dashboard');
          break;
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
        message="Signing In..."
        Loader={GridLoader}
        color="#3FB23F"
      />
      <div className="content">
        <div
          className="landing_page"
          style={{
            backgroundImage:
              'linear-gradient(rgba(41, 112, 60, 0.5), rgba(41, 112, 60, 0.5)), url("/school.png")',
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
                    <input
                      name="id"
                      value={form.id}
                      onChange={handleInputChange}
                      required
                      autoComplete="username"
                    />
                    <label>Applicant ID / Student ID / Email</label>
                  </div>

                  <div className="input_Box">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleInputChange}
                      required
                      autoComplete="current-password"
                    />
                    <label>Password</label>
                    <i
                      className={`fa ${showPassword ?  'fa-eye' : 'fa-eye-slash'}`}
                      aria-hidden="true"
                      onClick={() => setShowPassword(!showPassword)}
                    />

                    <label>Password</label>
                  </div>
                  <div className='errorShow'>
                    {error && (
                      <div className="error" role="alert">
                        <p>{error}</p>
                      </div>
                    )}
                  </div>



                  <div className="passoption">
                    <p>
                      <a>Forgot Password?</a>
                    </p>
                  </div>
                  
                  <button type="submit" className="btn" disabled={busy}>
                    {busy ? 'Signing in…' : 'Login'}
                  </button>

                  <div className="enroll">
                    <p>
                      Are you an applicant/enrollee? { }
                      <Link to="/Register_ph1">
                        Apply/Enroll here.
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
};
