import { useState, useEffect, useCallback } from 'react';
import Header, { LoginModal } from './components/Header';
import BottomNav from './components/BottomNav';
import { api } from './services/api';
import Dashboard from './pages/Dashboard';
import AlarmPage from './pages/AlarmPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import LaporanPage from './pages/LaporanPage';

function useIsDesktop() {
  const [v, setV] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const h = e => setV(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return v;
}

const PLACEHOLDER_PAGE = () => (
  <div className="fade-in" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: 12,
  }}>
    <div style={{
      width: 56,
      height: 56,
      borderRadius: 16,
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="12" y1="8" x2="12" y2="16" />
      </svg>
    </div>
    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted)' }}>Tindak Lanjut</div>
    <div style={{ fontSize: 12, color: 'var(--dim)' }}>Segera hadir</div>
  </div>
);

// ── Nav items definition (shared mobile & desktop) ───────────────
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  { key: 'alarm', label: 'Alarm', badge: true, icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )},
  { key: 'laporan', label: 'Laporan', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  )},
  { key: 'tindak', label: 'Tindak Lanjut', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )},
  { key: 'history', label: 'History', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
    </svg>
  )},
  { key: 'admin', label: 'Admin', adminOnly: true, icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )},
];

// ── Desktop Sidebar ───────────────────────────────────────────────
function Sidebar({ activePage, onNav, user, alarmCount, theme, toggleTheme, onLogin, onLogout }) {
  const [showLogin, setShowLogin] = useState(false);

  const items = NAV_ITEMS.filter(n => {
    if (n.adminOnly) return user?.role === 'admin';
    return true;
  });

  return (
    <div style={{
      width: 220, flexShrink: 0,
      height: '100dvh', position: 'sticky', top: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #22d3ee, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>OMC Dashboard</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.2 }}>UP2D Jateng</div>
          </div>
        </div>
        {/* SCADA Connected */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>SCADA Connected</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {items.map(n => {
          const active = activePage === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onNav(n.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, border: 'none',
                background: active ? 'var(--accent-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: 13, fontWeight: active ? 700 : 500,
                width: '100%', textAlign: 'left',
                transition: 'background 0.15s, color 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              {n.icon}
              {n.label}
              {n.badge && alarmCount > 0 && (
                <span style={{
                  marginLeft: 'auto', minWidth: 18, height: 18,
                  background: '#ef4444', borderRadius: 9,
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px',
                }}>
                  {alarmCount > 99 ? '99+' : alarmCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom — theme + user */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 10, border: 'none',
            background: 'transparent', color: 'var(--muted)',
            cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 12, fontWeight: 500, width: '100%', textAlign: 'left',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
          {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
        </button>

        {/* User */}
        {user ? (
          <div style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{user.username}</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 6 }}>{user.role}</div>
            <button
              onClick={onLogout}
              style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 600 }}
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            style={{
              padding: '8px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--muted)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
              width: '100%',
            }}
          >
            Login
          </button>
        )}
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={u => { onLogin(u); setShowLogin(false); }}
        />
      )}
    </div>
  );
}

export default function App() {
  const isDesktop = useIsDesktop();
  const [activePage, setActivePage] = useState('dashboard');
  const [historyFilter, setHistoryFilter] = useState('Semua');
  const [theme, setTheme] = useState(() => localStorage.getItem('omc-theme') || 'light');
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('omc-user')) || null; } catch { return null; }
  });
  const [alarmCount, setAlarmCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('omc-theme', theme);
  }, [theme]);

  // Poll active alarm count for badge
  const fetchAlarmCount = useCallback(() => {
    api.getSummary().then(data => setAlarmCount(data.total_aktif || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchAlarmCount();
    const t = setInterval(fetchAlarmCount, 30000);
    return () => clearInterval(t);
  }, [fetchAlarmCount]);

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  // Halaman yang boleh diakses per role
  const ALLOWED = {
    guest:    ['dashboard', 'alarm', 'history', 'laporan', 'tindak'],
    operator: ['dashboard', 'alarm', 'history', 'laporan', 'tindak'],
    admin:    ['dashboard', 'alarm', 'history', 'laporan', 'tindak', 'admin'],
  };

  function canAccess(page, role) {
    const key = role || 'guest';
    return (ALLOWED[key] || ALLOWED.guest).includes(page);
  }

  function handleLogin(userData) {
    setUser(userData);
    sessionStorage.setItem('omc-user', JSON.stringify(userData));
  }

  function handleLogout() {
    setUser(null);
    sessionStorage.removeItem('omc-user');
    // Redirect ke dashboard jika halaman sekarang tidak boleh diakses guest
    if (!canAccess(activePage, null)) setActivePage('dashboard');
  }

  function handleCardClick(type) {
    const filter = (type === 'TOTAL') ? 'Semua' : type;
    setHistoryFilter(filter);
    setActivePage('history');
  }

  function handleTabChange(tab) {
    if (!canAccess(tab, user?.role)) return;
    setActivePage(tab);
  }

  const pageContent = (
    <>
      {activePage === 'dashboard' && (
        <Dashboard
          isDesktop={isDesktop}
          onCardClick={handleCardClick}
          onGIClick={() => { setHistoryFilter('Semua'); setActivePage('history'); }}
        />
      )}
      {activePage === 'alarm'   && <AlarmPage user={user} isDesktop={isDesktop} />}
      {activePage === 'history' && <HistoryPage initialFilter={historyFilter} isDesktop={isDesktop} />}
      {activePage === 'laporan' && <LaporanPage isDesktop={isDesktop} />}
      {activePage === 'tindak'  && <PLACEHOLDER_PAGE />}
      {activePage === 'admin'   && user?.role === 'admin'    && <AdminPage user={user} isDesktop={isDesktop} />}
    </>
  );

  // ── DESKTOP layout ────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div data-theme={theme} style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)' }}>
        <Sidebar
          activePage={activePage}
          onNav={handleTabChange}
          user={user}
          alarmCount={alarmCount}
          theme={theme}
          toggleTheme={toggleTheme}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
        <main style={{ flex: 1, minHeight: '100dvh', overflowY: 'auto', padding: '28px 32px' }}>
          {pageContent}
        </main>
      </div>
    );
  }

  // ── MOBILE layout (tidak berubah) ─────────────────────────────
  return (
    <div data-theme={theme} style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', position: 'relative', background: 'var(--bg)' }}>
        <Header theme={theme} toggleTheme={toggleTheme} user={user} onLogin={handleLogin} onLogout={handleLogout} />
        <main style={{ paddingTop: 88, paddingBottom: 72, paddingLeft: 14, paddingRight: 14, minHeight: '100dvh', overflowY: 'auto' }}>
          {pageContent}
        </main>
        <BottomNav activePage={activePage} setActivePage={handleTabChange} user={user} alarmCount={alarmCount} />
      </div>
    </div>
  );
}
