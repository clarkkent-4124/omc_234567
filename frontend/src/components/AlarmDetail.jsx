import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import AlarmDetailSheet from './AlarmDetailSheet';

const TYPE_STYLE = {
  'PICKUP GI': { colorVar: 'var(--pickup)', bgVar: 'var(--pickup-bg)' },
  'PICKUP KP': { colorVar: 'var(--rnr)',    bgVar: 'var(--rnr-bg)'    },
  OTHER:       { colorVar: 'var(--muted)',  bgVar: 'var(--surface2)'  },
};

const CHIPS = ['Semua', 'PICKUP GI', 'PICKUP KP'];
const PAGE_SIZE = 8;

function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

export default function AlarmDetail({ initialFilter, onBack, showBackButton = true, isDesktop = false }) {
  const today        = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [search, setSearch]         = useState('');
  const [dari, setDari]             = useState(sevenDaysAgo);
  const [sampai, setSampai]         = useState(today);
  const [activeChip, setActiveChip] = useState(
    initialFilter && initialFilter !== 'TOTAL' ? initialFilter : 'Semua'
  );
  const [selectedGI, setSelectedGI] = useState('Semua GI');
  const [giOptions, setGiOptions]   = useState([]);
  const [page, setPage]             = useState(1);

  const [alarms, setAlarms]               = useState([]);
  const [total, setTotal]                 = useState(0);
  const [totalPages, setTotalPages]       = useState(1);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [exporting, setExporting]         = useState(false);

  // Fetch GI list once
  useEffect(() => {
    api.getRefGI()
      .then(arr => setGiOptions(Array.isArray(arr) ? arr : []))
      .catch(() => {});
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        from:  dari,
        to:    sampai,
        page,
        limit: PAGE_SIZE,
      };
      if (activeChip !== 'Semua') params.jenis = activeChip;
      if (selectedGI !== 'Semua GI') params.gi = selectedGI;
      if (search) params.search = search;

      const res = await api.getAlarmHistory(params);
      setAlarms(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setError('Gagal memuat data. Periksa koneksi backend.');
    } finally {
      setLoading(false);
    }
  }, [dari, sampai, activeChip, selectedGI, search, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function handleChip(chip)   { setActiveChip(chip); setPage(1); }
  function handleGI(gi)       { setSelectedGI(gi);   setPage(1); }
  function handleSearch(v)    { setSearch(v);         setPage(1); }
  function handleDari(v)      { setDari(v);           setPage(1); }
  function handleSampai(v)    { setSampai(v);         setPage(1); }

  const title = activeChip === 'Semua' ? 'History Alarm' : `History ${activeChip}`;

  async function handleExport() {
    try {
      setExporting(true);
      const params = { from: dari, to: sampai, limit: 9999, page: 1 };
      if (activeChip !== 'Semua') params.jenis = activeChip;
      if (selectedGI !== 'Semua GI') params.gi = selectedGI;
      if (search) params.search = search;

      const res = await api.getAlarmHistory(params);
      const rows = (res.data || []).map((a, i) => ({
        'No':          i + 1,
        'Waktu Alarm': a.datum_2 ? new Date(a.datum_2).toLocaleString('id-ID') : '-',
        'Waktu Validasi': a.ack_at ? new Date(a.ack_at).toLocaleString('id-ID') : '-',
        'Status':      a.status,
        'Jenis':       a.jenis,
        'GI / Feeder': a.path1_text || '-',
        'Indikasi':    a.point_text || '-',
        'POINT_KEY':   a.POINT_KEY  || '-',
        'Kesimpulan':  a.kesimpulan || '-',
        'Keterangan':  a.keterangan || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'History Alarm');

      const fileName = `history_alarm_${dari}_${sampai}${activeChip !== 'Semua' ? '_' + activeChip.replace(' ', '') : ''}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      alert('Gagal export: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fade-in">

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showBackButton && onBack ? (
            <button
              onClick={onBack}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 10px', color: 'var(--text)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Kembali
            </button>
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.2 }}>
              {loading ? 'Memuat...' : `${total} record ditemukan`}
            </div>
          </div>
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={exporting || loading || total === 0}
          style={{
            background: exporting ? 'var(--surface2)' : 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 8, padding: '6px 10px', color: '#22c55e',
            cursor: exporting || total === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif',
            opacity: total === 0 ? 0.4 : 1, flexShrink: 0,
          }}
          title="Download Excel"
        >
          {exporting ? (
            <span className="spinner" style={{ borderTopColor: '#22c55e', borderColor: 'rgba(34,197,94,0.2)', width: 12, height: 12 }} />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          {exporting ? 'Mengunduh...' : 'Excel'}
        </button>
      </div>

      {/* Filter card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '12px', marginBottom: 12,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Cari GI, feeder, point..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={dari}   onChange={e => handleDari(e.target.value)}   style={{ flex: 1 }} />
          <span style={{ color: 'var(--dim)', flexShrink: 0 }}>—</span>
          <input type="date" value={sampai} onChange={e => handleSampai(e.target.value)} style={{ flex: 1 }} />
        </div>

        {/* GI filter dropdown */}
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="2"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <select
            value={selectedGI}
            onChange={e => handleGI(e.target.value)}
            style={{
              width: '100%', background: 'var(--surface2)',
              color: selectedGI === 'Semua GI' ? 'var(--dim)' : 'var(--text)',
              border: `1px solid ${selectedGI !== 'Semua GI' ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, padding: '8px 32px',
              fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif',
              outline: 'none', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="Semua GI">Semua GI</option>
            {giOptions.map(gi => (
              <option key={gi} value={gi}>{gi}</option>
            ))}
          </select>
        </div>

        {/* Type chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CHIPS.map(chip => {
            const active = activeChip === chip;
            const s = chip !== 'Semua' ? TYPE_STYLE[chip] : null;
            return (
              <button
                key={chip}
                onClick={() => handleChip(chip)}
                style={{
                  background: active ? (s ? s.bgVar : 'var(--accent-bg)') : 'transparent',
                  color:      active ? (s ? s.colorVar : 'var(--accent)') : 'var(--dim)',
                  border: `1px solid ${active ? (s ? s.colorVar : 'var(--accent)') : 'var(--border)'}`,
                  borderRadius: 20, padding: '4px 12px', fontSize: 12,
                  fontWeight: active ? 700 : 400, cursor: 'pointer',
                  fontFamily: 'IBM Plex Sans, sans-serif', transition: 'all 0.15s',
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)', marginBottom: 8, padding: '0 2px' }}>
        <span>
          {loading ? 'Memuat data...' : `${alarms.length} dari ${total} record`}
          {selectedGI !== 'Semua GI' && (
            <span style={{ color: 'var(--accent)', marginLeft: 4 }}>· {selectedGI}</span>
          )}
        </span>
        <span>hal. {page}/{totalPages}</span>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'var(--pickup-bg)', border: '1px solid var(--pickup-border)',
          borderRadius: 12, padding: '12px', marginBottom: 10,
          fontSize: 13, color: 'var(--pickup)', textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '28px 80px 60px 1fr',
          padding: '8px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
        }}>
          {['#', 'Waktu', 'Jenis', 'GI / Feeder'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '28px 80px 60px 1fr',
              padding: '12px', borderBottom: '1px solid var(--border)', alignItems: 'center',
            }}>
              {[20, 60, 40, 80].map((w, j) => (
                <div key={j} style={{ width: w, height: 9, background: 'var(--surface2)', borderRadius: 4 }} />
              ))}
            </div>
          ))
        ) : alarms.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            Tidak ada data
          </div>
        ) : alarms.map((alarm, i) => {
          const s = TYPE_STYLE[alarm.jenis] || TYPE_STYLE.OTHER;
          const rowNum = (page - 1) * PAGE_SIZE + i + 1;
          return (
            <div
              key={alarm.id}
              onClick={() => setSelectedAlarm(alarm)}
              style={{
                display: 'grid', gridTemplateColumns: '28px 80px 60px 1fr',
                padding: '10px 12px',
                borderBottom: i < alarms.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center', transition: 'background 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                {String(rowNum).padStart(3, '0')}
              </span>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                {formatDateTime(alarm.datum_2)}
              </span>
              <span style={{
                background: s.bgVar, color: s.colorVar,
                border: `1px solid ${s.colorVar}44`,
                borderRadius: 5, padding: '2px 5px',
                fontSize: 10, fontWeight: 700, width: 'fit-content',
              }}>
                {alarm.jenis}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {alarm.path1_text || '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alarm.point_text || '—'}
                  </span>
                  {alarm.status === 'ACTIVE'
                    ? <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pickup)', flexShrink: 0 }} />
                    : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 4px' }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            background: page === 1 ? 'transparent' : 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px',
            color: page === 1 ? 'var(--border)' : 'var(--text)',
            cursor: page === 1 ? 'default' : 'pointer',
            fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif',
          }}
        >
          ← Prev
        </button>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>Halaman {page} dari {totalPages}</span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{
            background: page === totalPages ? 'transparent' : 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px',
            color: page === totalPages ? 'var(--border)' : 'var(--text)',
            cursor: page === totalPages ? 'default' : 'pointer',
            fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif',
          }}
        >
          Next →
        </button>
      </div>

      {/* Detail sheet */}
      {selectedAlarm && (
        <AlarmDetailSheet
          alarm={selectedAlarm}
          isDesktop={isDesktop}
          onClose={() => setSelectedAlarm(null)}
        />
      )}
    </div>
  );
}
