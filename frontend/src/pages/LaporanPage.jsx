import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';

// ── Helpers ──────────────────────────────────────────────────────
const JENIS_LIST = ['PICKUP GI', 'PICKUP KP'];

const JENIS_STYLE = {
  'PICKUP GI': { color: 'var(--pickup)', bg: 'var(--pickup-bg)', border: 'var(--pickup-border)' },
  'PICKUP KP': { color: 'var(--rnr)',    bg: 'var(--rnr-bg)',    border: 'var(--rnr-border)'    },
};

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function defaultBulan() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(bulanStr) {
  const [y, m] = bulanStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function labelBulan(bulanStr) {
  const [y, m] = bulanStr.split('-').map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

// ── Shared input styles ──────────────────────────────────────────
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '7px 10px',
  color: 'var(--text)', fontSize: 13,
  outline: 'none', fontFamily: 'inherit',
};

const labelStyle = {
  fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block',
};

// ── Table styles ─────────────────────────────────────────────────
const thStyle = {
  padding: '7px 8px',
  fontSize: 10, fontWeight: 700,
  color: 'var(--dim)', letterSpacing: 0.5,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  textAlign: 'center',
};

const tdStyle = {
  padding: '7px 8px',
  borderRight: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
};

// ── Excel helpers ─────────────────────────────────────────────────
function downloadExcel(sheetData, filename) {
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ── Apply button ─────────────────────────────────────────────────
function ApplyBtn({ onClick }) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    try { await onClick(); } finally { setLoading(false); }
  }
  return (
    <button
      onClick={handle}
      disabled={loading}
      style={{
        width: '100%', border: 'none', borderRadius: 8,
        padding: '9px 0', fontWeight: 700, fontSize: 13,
        cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        background: loading ? 'rgba(34,211,238,0.4)' : 'linear-gradient(135deg, #22d3ee, #3b82f6)',
        color: '#0a0f1a', transition: 'background 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      {loading
        ? <><span className="spinner" style={{ borderTopColor: '#0a0f1a', borderColor: 'rgba(10,15,26,0.3)', width: 13, height: 13 }} /> Memuat...</>
        : 'Tampilkan'
      }
    </button>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────
function SkeletonRows({ n = 5 }) {
  return (
    <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 32, borderRadius: 6 }} />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 1 — Kalender Pickup
// ════════════════════════════════════════════════════════════════
function TabKalender({ isDesktop = false }) {
  const [bulan,    setBulan]    = useState(defaultBulan);
  const [jenis,    setJenis]    = useState('PICKUP GI');
  const [gi,       setGi]       = useState('');
  const [giOptions, setGiOptions] = useState([]);
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [applied,  setApplied]  = useState({ bulan: defaultBulan(), jenis: 'PICKUP GI', gi: '' });

  // Load GI options once
  useEffect(() => {
    api.getRefGI().then(arr => setGiOptions(Array.isArray(arr) ? arr : [])).catch(() => {});
  }, []);

  // Fetch & pivot on apply
  useEffect(() => {
    setLoading(true);
    api.getLaporanKalender({ bulan: applied.bulan, jenis: applied.jenis, gi: applied.gi })
      .then(res => {
        const matrix = {};
        (res.data || []).forEach(r => {
          const key = `${r.peralatan}||${r.gi_name}||${r.nama_up3}`;
          if (!matrix[key]) matrix[key] = { peralatan: r.peralatan, gi_name: r.gi_name, nama_up3: r.nama_up3, nama_ulp: r.nama_ulp, days: {}, total: 0 };
          matrix[key].days[r.hari] = r.jumlah;
          matrix[key].total += Number(r.jumlah);
        });
        setRows(Object.values(matrix).sort((a, b) => a.peralatan.localeCompare(b.peralatan)));
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [applied]);

  const totalDays = daysInMonth(applied.bulan);
  const s = JENIS_STYLE[applied.jenis] || JENIS_STYLE['PICKUP GI'];

  function handleDownload() {
    // Header row: Peralatan, GI, UP3, ULP, 1..N, Total
    const header = ['Peralatan', 'GI', 'UP3', 'ULP',
      ...Array.from({ length: totalDays }, (_, i) => String(i + 1)),
      'Total',
    ];
    const dataRows = rows.map(row => [
      row.peralatan,
      row.gi_name   || '',
      row.nama_gi  || '',
      row.nama_ulp  || '',
      ...Array.from({ length: totalDays }, (_, i) => row.days[i + 1] || 0),
      row.total,
    ]);
    const filename = `Kalender_${applied.jenis}_${applied.bulan}.xlsx`;
    downloadExcel([header, ...dataRows], filename);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Filter card ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Filter</div>

        {isDesktop ? (
          /* ── Desktop: 2 row ── */
          <>
            {/* Row 1: Bulan + Jenis */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Bulan</label>
                <input type="month" value={bulan} onChange={e => setBulan(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Jenis</label>
                <select value={jenis} onChange={e => setJenis(e.target.value)} style={inputStyle}>
                  {JENIS_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>
            {/* Row 2: GI + Tombol */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>GI</label>
                <select value={gi} onChange={e => setGi(e.target.value)} style={inputStyle}>
                  <option value="">Semua GI</option>
                  {giOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 130 }}>
                <ApplyBtn onClick={() => setApplied({ bulan, jenis, gi })} />
              </div>
            </div>
          </>
        ) : (
          /* ── Mobile: stacked ── */
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Bulan</label>
                <input type="month" value={bulan} onChange={e => setBulan(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Jenis</label>
                <select value={jenis} onChange={e => setJenis(e.target.value)} style={inputStyle}>
                  {JENIS_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>GI</label>
              <select value={gi} onChange={e => setGi(e.target.value)} style={inputStyle}>
                <option value="">Semua GI</option>
                {giOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <ApplyBtn onClick={() => setApplied({ bulan, jenis, gi })} />
          </>
        )}
      </div>

      {/* ── Calendar table card ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {/* Card header */}
        <div style={{ padding: '11px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Kalender Peralatan — {applied.jenis}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{labelBulan(applied.bulan)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              {rows.length}
            </span>
            {rows.length > 0 && !loading && (
              <button
                onClick={handleDownload}
                title="Download Excel"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
                  borderRadius: 7, padding: '4px 9px', cursor: 'pointer',
                  color: '#22c55e', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                <DownloadIcon /> Excel
              </button>
            )}
          </div>
        </div>

        {loading ? <SkeletonRows n={6} /> : rows.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Tidak ada data untuk filter ini</div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {/* Sticky first col */}
                  <th style={{ ...thStyle, minWidth: 150, maxWidth: 150, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 2, borderRight: '2px solid var(--border)' }}>
                    Peralatan
                  </th>
                  {/* Day columns */}
                  {Array.from({ length: totalDays }, (_, i) => (
                    <th key={i + 1} style={{ ...thStyle, minWidth: 28, width: 28 }}>{i + 1}</th>
                  ))}
                  {/* Total column */}
                  <th style={{ ...thStyle, minWidth: 44, width: 44, color: s.color }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const evenBg = 'var(--surface)';
                  const oddBg  = 'var(--surface2)';
                  const rowBg  = ri % 2 === 0 ? evenBg : oddBg;
                  return (
                    <tr key={ri}>
                      {/* Sticky peralatan cell */}
                      <td style={{ ...tdStyle, position: 'sticky', left: 0, background: rowBg, zIndex: 1, minWidth: 150, maxWidth: 150, borderRight: '2px solid var(--border)' }}>
                        <div className="tooltip-wrap">
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.peralatan}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.gi_name}
                          </div>
                          <span className="tooltip-text">{row.peralatan}{row.gi_name ? `\n${row.gi_name}` : ''}</span>
                        </div>
                      </td>

                      {/* Day cells */}
                      {Array.from({ length: totalDays }, (_, di) => {
                        const count = row.days[di + 1] || 0;
                        return (
                          <td key={di + 1} style={{ ...tdStyle, textAlign: 'center', background: count > 0 ? s.bg : rowBg, padding: '4px 2px' }}>
                            {count > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: s.color, lineHeight: 1 }}>{count}</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total cell */}
                      <td style={{ ...tdStyle, textAlign: 'center', background: rowBg }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>
                          {row.total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 2 — Laporan Tiap Peralatan (per UP3)
// ════════════════════════════════════════════════════════════════
function TabPeralatan({ isDesktop = false }) {
  const [bulan,   setBulan]   = useState(defaultBulan);
  const [jenis,   setJenis]   = useState('PICKUP GI');
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState({ bulan: defaultBulan(), jenis: 'PICKUP GI' });

  useEffect(() => {
    setLoading(true);
    api.getLaporanPeralatan({ bulan: applied.bulan, jenis: applied.jenis })
      .then(res => setRows(res.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [applied]);

  const s = JENIS_STYLE[applied.jenis] || JENIS_STYLE['PICKUP GI'];
  const maxJumlah  = Math.max(...rows.map(r => Number(r.jumlah)), 1);
  const grandTotal = rows.reduce((sum, r) => sum + Number(r.jumlah), 0);

  function handleDownload() {
    const header = ['No', 'UP3', 'Jumlah Kejadian', 'Jumlah Peralatan', '% dari Total'];
    const dataRows = rows.map((row, i) => [
      i + 1,
      row.nama_gi,
      Number(row.jumlah),
      Number(row.jumlah_peralatan),
      grandTotal > 0 ? Math.round((Number(row.jumlah) / grandTotal) * 100) : 0,
    ]);
    const totalRow = ['', 'TOTAL', grandTotal, '', 100];
    const filename  = `Laporan_${applied.jenis}_${applied.bulan}.xlsx`;
    downloadExcel([header, ...dataRows, [], totalRow], filename);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Filter card ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Filter</div>

        {isDesktop ? (
          /* ── Desktop: 2 row ── */
          <>
            {/* Row 1: Bulan + Jenis */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Bulan</label>
                <input type="month" value={bulan} onChange={e => setBulan(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Jenis</label>
                <select value={jenis} onChange={e => setJenis(e.target.value)} style={inputStyle}>
                  {JENIS_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>
            {/* Row 2: Tombol */}
            <ApplyBtn onClick={() => setApplied({ bulan, jenis })} />
          </>
        ) : (
          /* ── Mobile: stacked ── */
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Bulan</label>
                <input type="month" value={bulan} onChange={e => setBulan(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Jenis</label>
                <select value={jenis} onChange={e => setJenis(e.target.value)} style={inputStyle}>
                  {JENIS_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>
            <ApplyBtn onClick={() => setApplied({ bulan, jenis })} />
          </>
        )}
      </div>

      {/* ── Summary strip ── */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Total Kejadian', value: grandTotal, mono: true },
            { label: 'Jumlah UP3', value: rows.length, mono: false },
          ].map(item => (
            <div key={item.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: item.mono ? 22 : 20, fontWeight: 800, color: s.color, fontFamily: item.mono ? 'JetBrains Mono, monospace' : 'inherit' }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── List card ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {/* Card header */}
        <div style={{ padding: '11px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Laporan {applied.jenis}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>per UP3 · {labelBulan(applied.bulan)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              {rows.length} UP3
            </span>
            {rows.length > 0 && !loading && (
              <button
                onClick={handleDownload}
                title="Download Excel"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
                  borderRadius: 7, padding: '4px 9px', cursor: 'pointer',
                  color: '#22c55e', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                <DownloadIcon /> Excel
              </button>
            )}
          </div>
        </div>

        {loading ? <SkeletonRows n={5} /> : rows.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Tidak ada data untuk filter ini</div>
        ) : rows.map((row, i) => {
          const jumlah = Number(row.jumlah);
          const pct    = Math.round((jumlah / maxJumlah) * 100);
          return (
            <div key={row.nama_gi} style={{ padding: '12px 14px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {/* Row header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.nama_gi || '—'}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {row.jumlah_peralatan} peralatan terdampak
                  </span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                    {jumlah}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>kejadian</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 3,
                  background: `linear-gradient(90deg, ${s.color}66, ${s.color})`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3, textAlign: 'right' }}>
                {Math.round((jumlah / grandTotal) * 100)}% dari total
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function LaporanPage({ isDesktop = false }) {
  const [activeTab, setActiveTab] = useState('kalender');

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Laporan</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.2 }}>Kalender & analisis alarm</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 4,
      }}>
        {[
          { key: 'kalender',   label: 'Kalender Peralatan' },
          { key: 'peralatan',  label: 'Laporan Peralatan' },
        ].map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, border: 'none', borderRadius: 7, padding: '8px 4px',
                background: active ? 'var(--accent-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--dim)',
                fontWeight: active ? 700 : 400,
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'kalender'  && <TabKalender  isDesktop={isDesktop} />}
      {activeTab === 'peralatan' && <TabPeralatan isDesktop={isDesktop} />}
    </div>
  );
}
