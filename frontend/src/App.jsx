import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import { api } from './services/api';
import Dashboard from './pages/Dashboard';
import AlarmPage from './pages/AlarmPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import LaporanPage from './pages/LaporanPage';

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

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [historyFilter, setHistoryFilter] = useState('Semua');
  const [theme, setTheme] = useState(() => localStorage.getItem('omc-theme') || 'dark');
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('omc-user')) || null; } catch { return null; }
  });
  const [alarmCount, setAlarmCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('omc-theme', theme);
  }, [theme]);

  // Poll active alarm count for badge
  const fetchAlarmCount = useCallback(() => {
    api.getSummary().then(data => setAlarmCount(data.total || 0)).catch(() => {});
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
    guest:    ['dashboard', 'alarm', 'history', 'laporan'],
    operator: ['dashboard', 'alarm', 'history', 'laporan', 'tindak'],
    admin:    ['dashboard', 'alarm', 'history', 'laporan', 'admin'],
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

  return (
    <div data-theme={theme} style={{
      background: 'var(--bg)',
      minHeight: '100dvh',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        minHeight: '100dvh',
        position: 'relative',
        background: 'var(--bg)',
      }}>
        <Header
          theme={theme}
          toggleTheme={toggleTheme}
          user={user}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />

        <main style={{
          paddingTop: 88,
          paddingBottom: 72,
          paddingLeft: 14,
          paddingRight: 14,
          minHeight: '100dvh',
          overflowY: 'auto',
        }}>
          {activePage === 'dashboard' && (
            <Dashboard
              onCardClick={handleCardClick}
              onGIClick={() => { setHistoryFilter('Semua'); setActivePage('history'); }}
            />
          )}
          {activePage === 'alarm'   && <AlarmPage user={user} />}
          {activePage === 'history' && <HistoryPage initialFilter={historyFilter} />}
          {activePage === 'laporan' && <LaporanPage />}
          {activePage === 'tindak'  && user?.role === 'operator' && <PLACEHOLDER_PAGE />}
          {activePage === 'admin'   && user?.role === 'admin'    && <AdminPage user={user} />}
        </main>

        <BottomNav
          activePage={activePage}
          setActivePage={handleTabChange}
          user={user}
          alarmCount={alarmCount}
        />
      </div>
    </div>
  );
}
