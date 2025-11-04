// src/pages/ResetPassword.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ResetPassword() {
  const [status, setStatus] = useState('checking'); // checking | ready | invalid | done | error
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Eye toggles (match Register_ph1 style)
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get('token');
  const uid = params.get('uid');

  // Validation helpers (mirror registration strength + special char)
  const strengthIssues = (value) => {
    const issues = [];
    if (value.length < 8) issues.push('at least 8 characters');
    if (!/[A-Z]/.test(value)) issues.push('one uppercase letter');
    if (!/[a-z]/.test(value)) issues.push('one lowercase letter');
    if (!/[0-9]/.test(value)) issues.push('one number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value))
      issues.push('one special character');
    return issues;
  };

  useEffect(() => {
    const check = async () => {
      try {
        if (!token || !uid) {
          setStatus('invalid');
          return;
        }
        const nowIso = new Date().toISOString();
        const { data: row, error } = await supabase
          .from('password_resets')
          .select('*')
          .eq('user_id', uid)
          .eq('token', token)
          .is('used_at', null)
          .gt('expires_at', nowIso)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        setStatus(row ? 'ready' : 'invalid');
      } catch (e) {
        setStatus('error');
        setErr(e?.message || 'Validation error.');
        setErrorOpen(true);
      }
    };
    check();
  }, [token, uid]);

  const validate = () => {
    const issues = strengthIssues(pw);
    if (issues.length) {
      const msg = `Password must have ${issues.join(', ')}.`;
      setErr(msg);
      setErrorOpen(true);
      return false;
    }
    if (pw !== pw2) {
      const msg = 'Passwords do not match.';
      setErr(msg);
      setErrorOpen(true);
      return false;
    }
    return true;
  };

  const trySubmit = (e) => {
    e.preventDefault();
    setErr('');
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const doReset = async () => {
    try {
      setBusy(true);
      // Update password (replace with hashing when you add it)
      const { error: upErr } = await supabase
        .from('users')
        .update({ password_hash: pw })
        .eq('user_id', uid);
      if (upErr) throw upErr;

      // Consume token
      const { error: useErr } = await supabase
        .from('password_resets')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', uid)
        .eq('token', token);
      if (useErr) throw useErr;

      setStatus('done');
      setSuccessOpen(true);
    } catch (e) {
      setStatus('error');
      setErr(e?.message || 'Failed to set password.');
      setErrorOpen(true);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const goLogin = () => {
    setSuccessOpen(false);
    navigate('/'); // landing page
  };

  if (status === 'checking')
    return <div style={{ padding: 16 }}>Validating link…</div>;
  if (status === 'invalid')
    return (
      <div style={{ padding: 16 }}>This reset link is invalid or expired.</div>
    );

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h2>Set a new password</h2>
      <form onSubmit={trySubmit} style={{ display: 'grid', gap: 10 }}>
        <div className="inputGroup3" style={{ position: 'relative' }}>
          <label htmlFor="newPw">New Password</label>
          <input
            id="newPw"
            type={showPassword ? 'text' : 'password'}
            placeholder="New password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            autoComplete="new-password"
          />
          <i
            className={`fa ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}
            aria-hidden="true"
            onClick={() => setShowPassword((v) => !v)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '45%',
              transform: 'translateY(50%)',
              fontSize: '17px',
              color: showPassword ? '#248041' : '#555',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
            }}
            title={showPassword ? 'Hide password' : 'Show password'}
          />
        </div>

        <div className="inputGroup3" style={{ position: 'relative' }}>
          <label htmlFor="confirmPw">Confirm Password</label>
          <input
            id="confirmPw"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
            autoComplete="new-password"
          />
          <i
            className={`fa ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'}`}
            aria-hidden="true"
            onClick={() => setShowConfirmPassword((v) => !v)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '45%',
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

        {/* Live strength checklist */}
        <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, color: '#555' }}>
          <li>At least 8 characters</li>
          <li>
            Include uppercase, lowercase, a number, and a special character
          </li>
        </ul>

        {err && <div style={{ color: 'crimson' }}>{err}</div>}

        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>

      {/* Confirm Modal */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm_title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              width: 'min(420px, 92vw)',
              borderRadius: 10,
              padding: 18,
            }}
          >
            <h3 id="confirm_title" style={{ marginTop: 0 }}>
              Confirm password change
            </h3>
            <p>Do you want to update your password now?</p>
            <div
              style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
            >
              <button type="button" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={doReset} disabled={busy}>
                {busy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="err_title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              width: 'min(420px, 92vw)',
              borderRadius: 10,
              padding: 18,
            }}
          >
            <h3 id="err_title" style={{ marginTop: 0 }}>
              Cannot reset password
            </h3>
            <p>{err || 'Something went wrong.'}</p>
            <div
              style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
            >
              <button onClick={() => setErrorOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ok_title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              width: 'min(420px, 92vw)',
              borderRadius: 10,
              padding: 18,
            }}
          >
            <h3 id="ok_title" style={{ marginTop: 0 }}>
              Password updated
            </h3>
            <p>Your password has been changed successfully.</p>
            <div
              style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
            >
              <button onClick={goLogin}>Okay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
