// ── Tab definitions ───────────────────────────────────────────────
const TAB_DASHBOARD = {
  key: 'dashboard', label: 'Dashboard',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
};
const TAB_ALARM = {
  key: 'alarm', label: 'Alarm',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};
const TAB_HISTORY = {
  key: 'history', label: 'History',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  ),
};
const TAB_LAPORAN = {
  key: 'laporan', label: 'Laporan',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
};
const TAB_TINDAK = {
  key: 'tindak', label: 'Tindak Lanjut',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),
};
const TAB_ADMIN = {
  key: 'admin', label: 'Admin',
  color: '#a855f7',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
};

// ── Tab list per role ─────────────────────────────────────────────
function getTabsByRole(role) {
  const base = [TAB_DASHBOARD, TAB_ALARM, TAB_LAPORAN, TAB_HISTORY];
  if (role === 'operator') return [...base, TAB_TINDAK];
  if (role === 'admin')    return [...base, TAB_ADMIN];
  return base; // belum login
}

// ── Component ─────────────────────────────────────────────────────
export default function BottomNav({ activePage, setActivePage, user, alarmCount = 0 }) {
  const tabs = getTabsByRole(user?.role);

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      display: 'flex', zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
    }}>
      {tabs.map(tab => {
        const active      = activePage === tab.key;
        const accentColor = tab.color || 'var(--accent)';
        const showBadge   = tab.key === 'alarm' && alarmCount > 0;
        return (
          <button
            key={tab.key}
            onClick={() => setActivePage(tab.key)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 4px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              color: active ? accentColor : 'var(--dim)',
              transition: 'color 0.2s', position: 'relative',
            }}
          >
            {active && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 32, height: 2, borderRadius: '0 0 2px 2px',
                background: accentColor,
              }} />
            )}
            {/* Icon wrapper with badge */}
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              {tab.icon}
              {showBadge && (
                <span style={{
                  position: 'absolute', top: -5, right: -8,
                  background: '#ef4444', color: '#fff',
                  borderRadius: 10, minWidth: 16, height: 16,
                  fontSize: 9, fontWeight: 700, lineHeight: '16px',
                  textAlign: 'center', padding: '0 4px',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  boxShadow: '0 0 0 2px var(--surface)',
                }}>
                  {alarmCount > 99 ? '99+' : alarmCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
