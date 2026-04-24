import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import AlarmDetailSheet from '../components/AlarmDetailSheet';

const TYPE_CHIPS = ['Semua', 'PICKUP GI', 'PICKUP KP'];

const TYPE_STYLE = {
  'PICKUP GI': { colorVar: 'var(--pickup)', bgVar: 'var(--pickup-bg)', borderVar: 'var(--pickup-border)' },
  'PICKUP KP': { colorVar: 'var(--rnr)',    bgVar: 'var(--rnr-bg)',    borderVar: 'var(--rnr-border)'    },
  OTHER:       { colorVar: 'var(--muted)',  bgVar: 'var(--surface2)',  borderVar: 'var(--border)'        },
};

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function TypeChips({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
      {TYPE_CHIPS.map(chip => {
        const isActive = active === chip;
        const s = chip !== 'Semua' ? TYPE_STYLE[chip] : null;
        return (
          <button
            key={chip}
            onClick={() => onChange(chip)}
            style={{
              background: isActive ? (s ? s.bgVar : 'var(--accent-bg)') : 'transparent',
              color:      isActive ? (s ? s.colorVar : 'var(--accent)') : 'var(--dim)',
              border: `1px solid ${isActive ? (s ? s.colorVar : 'var(--accent)') : 'var(--border)'}`,
              borderRadius: 20, padding: '4px 12px', fontSize: 11,
              fontWeight: isActive ? 700 : 400, cursor: 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif', transition: 'all 0.15s',
            }}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

function TableSkeleton({ cols }) {
  return Array.from({ length: 5 }).map((_, i) => (
    <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, padding: '12px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 0 }}>
      {[20, 80, 40].map((w, j) => (
        <div key={j} style={{ width: w, height: 9, background: 'var(--surface2)', borderRadius: 4 }} />
      ))}
    </div>
  ));
}

// ── SLA helpers ───────────────────────────────────────────────────
function getSlaState(datum_2, slaWarning, slaBreach) {
  if (!datum_2) return 'normal';
  const ageSeconds = (Date.now() - new Date(datum_2).getTime()) / 1000;
  if (slaBreach  && ageSeconds >= slaBreach  * 60) return 'breach';
  if (slaWarning && ageSeconds >= slaWarning * 60) return 'warning';
  return 'normal';
}
const SLA_ROW_STYLE = {
  normal:  { bg: 'transparent',          border: 'transparent' },
  warning: { bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)' },
  breach:  { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
};
const SLA_BADGE = {
  normal:  null,
  warning: { label: 'WARNING', color: '#ca8a04', bg: 'rgba(234,179,8,0.15)' },
  breach:  { label: 'BREACH',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

// ── Kesimpulan badge kecil ────────────────────────────────────────
function KBadge({ value }) {
  if (!value) return null;
  const isValid = value === 'valid';
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
      background: isValid ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      color:      isValid ? '#22c55e'               : '#ef4444',
      textTransform: 'uppercase', flexShrink: 0,
    }}>
      {value}
    </span>
  );
}

// ── Filter tanggal ────────────────────────────────────────────────
function DateFilter({ label, dari, setDari, sampai, setSampai, onApply }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input type="date" value={dari} onChange={e => setDari(e.target.value)}
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <span style={{ color: 'var(--dim)', flexShrink: 0, fontSize: 12 }}>—</span>
        <input type="date" value={sampai} onChange={e => setSampai(e.target.value)}
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <button onClick={onApply}
        style={{ width: '100%', background: 'linear-gradient(135deg, #22d3ee, #3b82f6)', border: 'none', borderRadius: 8, padding: '8px 0', color: '#0a0f1a', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        Terapkan
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB LIVE
// ════════════════════════════════════════════════════════════════
function TabLive({ user, onRefresh }) {
  const [activeChip,    setActiveChip]    = useState('Semua');
  const [alarms,        setAlarms]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [lastUpdate,    setLastUpdate]    = useState(null);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [slaSettings,   setSlaSettings]   = useState({ sla_warning: null, sla_breach: null });
  const [, forceUpdate]                   = useState(0);

  const fetchAlarms = useCallback(async () => {
    try {
      setError(null);
      const params = { status: 'ACTIVE', limit: 500 };
      if (activeChip !== 'Semua') params.jenis = activeChip;
      const res = await api.getAlarms(params);
      setAlarms(res.data || []);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, [activeChip]);

  useEffect(() => { setLoading(true); fetchAlarms(); }, [fetchAlarms]);
  useEffect(() => {
    const t = setInterval(fetchAlarms, 30000);
    return () => clearInterval(t);
  }, [fetchAlarms]);

  useEffect(() => {
    api.getSettings().then(s => {
      setSlaSettings({ sla_warning: s.sla_warning ? Number(s.sla_warning) : null, sla_breach: s.sla_breach ? Number(s.sla_breach) : null });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const counts = {
    'PICKUP GI': alarms.filter(a => a.jenis === 'PICKUP GI').length,
    'PICKUP KP': alarms.filter(a => a.jenis === 'PICKUP KP').length,
  };
  const displayed = activeChip === 'Semua' ? alarms : alarms.filter(a => a.jenis === activeChip);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {Object.entries(counts).map(([type, count]) => {
          const s = TYPE_STYLE[type];
          return (
            <div key={type} style={{ flex: 1, background: s.bgVar, border: `1px solid ${s.borderVar}`, borderRadius: 10, padding: '8px 0', textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: s.colorVar }}>{count}</div>
              <div style={{ fontSize: 9, color: s.colorVar, fontWeight: 600, marginTop: 2 }}>{type}</div>
            </div>
          );
        })}
      </div>

      <TypeChips active={activeChip} onChange={c => { setActiveChip(c); setLoading(true); }} />

      {error && (
        <div style={{ background: 'var(--pickup-bg)', border: '1px solid var(--pickup-border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, fontSize: 13, color: 'var(--pickup)', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 64px', padding: '8px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          {['#', 'GI / Point', 'Waktu'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {loading ? <TableSkeleton cols="32px 1fr 64px" /> : displayed.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            {error ? 'Tidak dapat memuat data' : 'Tidak ada alarm aktif'}
          </div>
        ) : displayed.map((alarm, i) => {
          const s         = TYPE_STYLE[alarm.jenis] || TYPE_STYLE.OTHER;
          const slaState  = getSlaState(alarm.datum_2, slaSettings.sla_warning, slaSettings.sla_breach);
          const slaRow    = SLA_ROW_STYLE[slaState];
          const slaBadge  = SLA_BADGE[slaState];
          return (
            <div
              key={alarm.id}
              onClick={() => setSelectedAlarm(alarm)}
              style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 64px',
                padding: '10px 14px',
                borderBottom: i < displayed.length - 1 ? '1px solid var(--border)' : 'none',
                borderLeft: slaState !== 'normal' ? `3px solid ${slaBadge.color}` : '3px solid transparent',
                background: slaRow.bg,
                alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = slaState !== 'normal' ? slaRow.bg : 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = slaRow.bg}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--dim)' }}>{String(i + 1).padStart(3, '0')}</span>
                <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: s.colorVar }} />
              </div>
              <div style={{ minWidth: 0, paddingRight: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ background: s.bgVar, color: s.colorVar, border: `1px solid ${s.colorVar}44`, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{alarm.jenis}</span>
                  {slaBadge && (
                    <span style={{ background: slaBadge.bg, color: slaBadge.color, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{slaBadge.label}</span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alarm.path1_text || '—'}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alarm.point_text || alarm.point_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="font-mono" style={{ fontSize: 11, color: slaState === 'breach' ? '#ef4444' : slaState === 'warning' ? '#ca8a04' : 'var(--accent)', fontWeight: 600 }}>{formatTime(alarm.datum_2)}</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>{formatDate(alarm.datum_2)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {lastUpdate && !loading && (
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: 'var(--dim)' }}>
          Update terakhir: {formatTime(lastUpdate.toISOString())} · auto-refresh 30s
        </div>
      )}

      {selectedAlarm && (
        <AlarmDetailSheet
          alarm={selectedAlarm}
          user={user}
          onClose={() => setSelectedAlarm(null)}
          onAck={() => { fetchAlarms(); onRefresh(); }}
        />
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB RESPONDED / INVALID  (reusable)
// ════════════════════════════════════════════════════════════════
function TabAcked({ user, refreshKey, kesimpulan }) {
  const today        = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [activeChip,    setActiveChip]    = useState('Semua');
  const [dari,          setDari]          = useState(sevenDaysAgo);
  const [sampai,        setSampai]        = useState(today);
  const [appliedDari,   setAppliedDari]   = useState(sevenDaysAgo);
  const [appliedSampai, setAppliedSampai] = useState(today);
  const [filterKey,     setFilterKey]     = useState(0);
  const [alarms,        setAlarms]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [selectedAlarm, setSelectedAlarm] = useState(null);

  const fetchAlarms = useCallback(async () => {
    try {
      setError(null);
      const params = { from: appliedDari, to: appliedSampai, kesimpulan };
      if (activeChip !== 'Semua') params.jenis = activeChip;
      const res = await api.getTerpantau(params);
      setAlarms(res.data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, [activeChip, appliedDari, appliedSampai, filterKey, refreshKey, kesimpulan]);

  useEffect(() => { setLoading(true); fetchAlarms(); }, [fetchAlarms]);

  function handleApply() {
    setAppliedDari(dari);
    setAppliedSampai(sampai);
    setFilterKey(k => k + 1);
    setLoading(true);
  }

  const displayed = activeChip === 'Semua' ? alarms : alarms.filter(a => a.jenis === activeChip);
  const isValid   = kesimpulan === 'valid';

  return (
    <>
      <DateFilter
        label={isValid ? 'Filter Waktu Responded' : 'Filter Waktu Invalid'}
        dari={dari} setDari={setDari}
        sampai={sampai} setSampai={setSampai}
        onApply={handleApply}
      />

      <TypeChips active={activeChip} onChange={c => { setActiveChip(c); setLoading(true); }} />

      <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 8, paddingLeft: 2 }}>
        {loading ? 'Memuat...' : `${displayed.length} alarm`}
        <span style={{ color: isValid ? '#22c55e' : '#ef4444', marginLeft: 6 }}>{appliedDari} — {appliedSampai}</span>
      </div>

      {error && (
        <div style={{ background: 'var(--pickup-bg)', border: '1px solid var(--pickup-border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, fontSize: 13, color: 'var(--pickup)', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 100px', padding: '8px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          {['#', 'GI / Point', 'Respond'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {loading ? <TableSkeleton cols="28px 1fr 100px" /> : displayed.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            {isValid ? 'Belum ada alarm responded' : 'Belum ada alarm invalid'}
          </div>
        ) : displayed.map((alarm, i) => {
          const s = TYPE_STYLE[alarm.jenis] || TYPE_STYLE.OTHER;
          return (
            <div
              key={alarm.id}
              onClick={() => setSelectedAlarm(alarm)}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr 100px', padding: '10px 14px', borderBottom: i < displayed.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--dim)' }}>{String(i + 1).padStart(3, '0')}</span>
              <div style={{ minWidth: 0, paddingRight: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ background: s.bgVar, color: s.colorVar, border: `1px solid ${s.colorVar}44`, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{alarm.jenis}</span>
                  <KBadge value={alarm.kesimpulan} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alarm.path1_text || '—'}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alarm.point_text || alarm.point_name}</div>
                {alarm.keterangan && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                    {alarm.keterangan}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: isValid ? '#22c55e' : '#ef4444' }}>{alarm.ack_by}</div>
                <div className="font-mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>{formatDateTime(alarm.ack_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedAlarm && (
        <AlarmDetailSheet
          alarm={{ ...selectedAlarm, ack_at: selectedAlarm.ack_at, ack_by: selectedAlarm.ack_by, kesimpulan: selectedAlarm.kesimpulan, keterangan: selectedAlarm.keterangan }}
          user={user}
          onClose={() => setSelectedAlarm(null)}
          onAck={fetchAlarms}
        />
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function AlarmPage({ user }) {
  const [activeTab, setActiveTab] = useState('live');
  const [ackedKey,  setAckedKey]  = useState(0);

  const TABS = [
    { key: 'live',      label: 'Live',      dot: true,  icon: null },
    { key: 'responded', label: 'Responded', dot: false, color: '#22c55e' },
    { key: 'invalid',   label: 'Invalid',   dot: false, color: '#ef4444' },
  ];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Alarm</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.2 }}>Monitoring alarm aktif</div>
          </div>
        </div>
        {user?.role === 'operator' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 20, padding: '4px 10px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ca8a04' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ca8a04' }}>OPERATOR</span>
          </div>
        )}
      </div>

      {/* Tab switcher — 3 tab */}
      <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 4, marginBottom: 14 }}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          const tabColor = tab.color || 'var(--accent)';
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, border: 'none', borderRadius: 7, padding: '8px 4px',
                background: active
                  ? tab.key === 'responded' ? 'rgba(34,197,94,0.12)'
                  : tab.key === 'invalid'   ? 'rgba(239,68,68,0.12)'
                  : 'var(--accent-bg)'
                  : 'transparent',
                color: active ? tabColor : 'var(--dim)',
                fontWeight: active ? 700 : 400, fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                borderBottom: active ? `2px solid ${tabColor}` : '2px solid transparent',
              }}
            >
              {tab.dot
                ? <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'var(--accent)' : 'var(--dim)' }} />
                : tab.key === 'responded'
                  ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              }
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'live'      && <TabLive  user={user} onRefresh={() => setAckedKey(k => k + 1)} />}
      {activeTab === 'responded' && <TabAcked user={user} refreshKey={ackedKey} kesimpulan="valid"   />}
      {activeTab === 'invalid'   && <TabAcked user={user} refreshKey={ackedKey} kesimpulan="invalid" />}
    </div>
  );
}
