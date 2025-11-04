// src/components/modals/ForgotPasswordModal.jsx
import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { supabase } from '../../supabaseClient';

const SERVICE_ID = 'service_ns2e9xh';
const TEMPLATE_ID = 'template_6ta684d';
const PUBLIC_KEY = 'gBWh3ySHhkiaeg0mh';

const ForgotPasswordModal = ({
  isOpen,
  onClose,
  redirectPath = '/reset-password',
}) => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const genToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  const sendReset = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const clean = (email || '').trim();
    if (!looksLikeEmail(clean)) {
      setErr('Enter a valid email address.');
      return;
    }

    try {
      setBusy(true);

      // Look up user by email (privacy: never reveal existence)
      const { data: found, error: findErr } = await supabase
        .from('users')
        .select('user_id, first_name')
        .eq('email', clean)
        .limit(1);
      if (findErr) throw findErr;

      // Always show generic success to the user
      if (!found || !found.length) {
        setMsg('If an account exists, a reset link has been sent.');
        return;
      }
      const user = found[0];

      // Create 30‑minute token
      const token = genToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { error: insErr } = await supabase
        .from('password_resets')
        .insert([
          { user_id: user.user_id, email: clean, token, expires_at: expiresAt },
        ]);
      if (insErr) throw insErr; // store token server‑side for verification [web:194]

      // Build reset URL for your app
      const resetUrl = `${window.location.origin}${redirectPath}?token=${token}&uid=${user.user_id}`;

      // Send via EmailJS
      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          to_email: clean,
          reset_url: resetUrl,
          user_name: user.first_name || 'User',
          expires_minutes: 30,
        },
        { publicKey: PUBLIC_KEY }
      ); // client‑side email delivery with template params [web:357]

      setMsg('If an account exists, a reset link has been sent.');
    } catch (e2) {
      setErr(e2?.message || 'Could not send reset email. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fp_title"
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
          boxShadow: '0 12px 30px rgba(0,0,0,.2)',
        }}
      >
        <h3 id="fp_title" style={{ marginTop: 0 }}>
          Reset your password
        </h3>
        <p>
          Enter the email you use to sign in and we’ll send you a reset link.
        </p>
        <form onSubmit={sendReset} style={{ display: 'grid', gap: 10 }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {err && <div style={{ color: 'crimson' }}>{err}</div>}
          {msg && <div style={{ color: 'green' }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
