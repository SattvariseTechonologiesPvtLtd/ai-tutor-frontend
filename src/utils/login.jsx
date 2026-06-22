import { useState } from 'react';
import { C, LOGO_PATH } from '../shared';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const VALID_USER = 'deftxr';
  const VALID_PASS = 'deftxr@1234';

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (username === VALID_USER && password === VALID_PASS) { onLogin(); }
      else { setError('Invalid credentials. Please try again.'); setLoading(false); }
    }, 600);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(${C.border}33 1px, transparent 1px), linear-gradient(90deg, ${C.border}33 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: '400px', height: '400px', borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: '400px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '40px', boxShadow: `0 24px 64px rgba(0,0,0,0.5)`, position: 'relative', animation: 'fadeUp 0.5s ease forwards' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
          <div style={{ width: '88px', height: '88px', borderRadius: '20px', overflow: 'hidden', border: `2px solid ${C.border}`, boxShadow: `0 0 24px ${C.accent}33`, flexShrink: 0 }}>
            <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '26px', fontWeight: '800', color: C.white }}>DEFTXR</h1>
            <p style={{ fontSize: '13px', color: C.textSec, marginTop: '4px', letterSpacing: '0.12em', fontFamily: 'Inter, sans-serif' }}>ANATOMY TUTOR</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {['username','password'].map(field => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: '11px', color: C.textMuted, fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', marginBottom: '6px' }}>{field.toUpperCase()}</label>
              <input type={field === 'password' ? 'password' : 'text'} value={field === 'username' ? username : password}
                onChange={e => field === 'username' ? setUsername(e.target.value) : setPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', color: C.textPrim, fontSize: '14px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
            </div>
          ))}
          {error && <p style={{ fontSize: '13px', color: C.error, textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ marginTop: '8px', padding: '12px', width: '100%', background: `linear-gradient(135deg, ${C.accent}, ${C.accentGlow})`, border: 'none', borderRadius: '10px', color: C.white, fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '14px', letterSpacing: '0.08em', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Signing in…' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
}