import { useEffect, useState } from 'react';
import { api } from '../services/api';

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) { setError('Username dan password wajib diisi.'); return; }
    setError('');
    setLoading(true);
    try {
      const user = await api.login({ username, password });
      onLogin(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Login gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '24px 20px',
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Login</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.2 }}>OMC Dashboard</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontWeight: 600 }}>Username</div>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Masukkan username"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 12px',
                color: 'var(--text)', fontSize: 13,
                fontFamily: 'IBM Plex Sans, sans-serif',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontWeight: 600 }}>Password</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Masukkan password"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 12px',
                color: 'var(--text)', fontSize: 13,
                fontFamily: 'IBM Plex Sans, sans-serif',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '8px 12px',
              fontSize: 12, color: '#ef4444',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 2,
              background: loading
                ? 'linear-gradient(135deg, #16a5ba, #2563a8)'
                : 'linear-gradient(135deg, #22d3ee, #3b82f6)',
              border: 'none', borderRadius: 8,
              padding: '10px 0', width: '100%',
              color: '#0a0f1a', fontWeight: 700, fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.85 : 1,
              transition: 'background 0.2s, opacity 0.2s',
            }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Masuk...
              </>
            ) : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Header({ theme, toggleTheme, user, onLogin, onLogout }) {
  const [time, setTime]         = useState(new Date());
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = time.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const isDark = theme === 'dark';

  return (
    <>
      <header
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: '10px 16px 8px',
        }}
      >
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Gradient icon */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>OMC Dashboard</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.2 }}>UP2D Jateng</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* LIVE chip */}
            <div className="live-chip" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              borderRadius: 20,
              padding: '3px 8px',
            }}>
              <div className="pulse-dot" style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--success)',
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', letterSpacing: 0.5 }}>LIVE</span>
            </div>

            {/* Theme toggle */}
            <button className="theme-toggle" onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Login / Logout button */}
            {user ? (
              <button
                className="theme-toggle"
                onClick={onLogout}
                title={`Logout (${user.username})`}
                style={{ position: 'relative' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--success)', border: '1px solid var(--bg)',
                }} />
              </button>
            ) : (
              <button
                className="theme-toggle"
                onClick={() => setShowLogin(true)}
                title="Login"
              >
                <UserIcon />
              </button>
            )}
          </div>
        </div>

        {/* Row 2 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>SCADA Connected</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{dateStr}</span>
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', letterSpacing: 1 }}>{timeStr}</span>
        </div>
      </header>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={onLogin} />}
    </>
  );
}
