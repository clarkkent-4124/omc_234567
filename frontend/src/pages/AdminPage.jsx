import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { api, BACKEND_URL } from '../services/api';

// ════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ════════════════════════════════════════════════════════════════

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: 'var(--dim)',
      letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function NumberInput({ label, unit, hint, value, onChange, min = 1 }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
        {label}
        <span style={{ fontWeight: 400, color: 'var(--dim)', marginLeft: 4 }}>({unit})</span>
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          min={min}
          step="1"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`Angka ≥ ${min}`}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 52px 10px 14px',
            color: 'var(--text)', fontSize: 15,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600, outline: 'none',
          }}
        />
        <span style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 11, color: 'var(--dim)', fontFamily: 'IBM Plex Sans, sans-serif',
          pointerEvents: 'none',
        }}>
          {unit}
        </span>
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function ValidationMsg({ type, children }) {
  const isError = type === 'error';
  if (!children) return null;
  return (
    <div style={{
      background: isError ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
      border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
      borderRadius: 8, padding: '8px 12px',
      fontSize: 12, color: isError ? '#ef4444' : '#ca8a04',
      display: 'flex', alignItems: 'flex-start', gap: 7,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
        {isError
          ? <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
          : <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>
        }
      </svg>
      {children}
    </div>
  );
}

function SuccessMsg({ show }) {
  if (!show) return null;
  return (
    <div style={{
      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 8, padding: '8px 12px',
      fontSize: 12, color: '#22c55e',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Berhasil disimpan.
    </div>
  );
}

// ── Input field kompak untuk form modal ─────────────────────────
function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 10px',
  color: 'var(--text)', fontSize: 13,
  fontFamily: 'IBM Plex Sans, sans-serif',
  outline: 'none',
};

// ════════════════════════════════════════════════════════════════
// DB STATUS CARD
// ════════════════════════════════════════════════════════════════
function DbStatusCard() {
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  async function fetchStatus() {
    try {
      const res = await api.getDbStatus();
      setStatus(res);
    } catch {
      setStatus({
        mysql: { ok: false, latency: null, error: 'Backend tidak dapat dijangkau' },
        mssql: { ok: false, latency: null, error: 'Backend tidak dapat dijangkau' },
        checkedAt: new Date().toISOString(),
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchStatus();
    timerRef.current = setInterval(fetchStatus, 15000);
    return () => clearInterval(timerRef.current);
  }, []);

  const DBS = [
    { key: 'mysql', label: 'MySQL', sub: 'Dashboard OMC', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)' },
    { key: 'mssql', label: 'SQL Server', sub: 'Sumber Data SCADA', gradient: 'linear-gradient(135deg, #e11d48, #9f1239)' },
  ];
  const dbIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );

  function formatChecked(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Koneksi Database</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>Auto-refresh setiap 15 detik</div>
          </div>
        </div>
        {!loading && status?.checkedAt && (
          <div style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'JetBrains Mono, monospace' }}>
            {formatChecked(status.checkedAt)}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
        )) : DBS.map(db => {
          const info        = status?.[db.key];
          const isOk        = info?.ok;
          const stateColor  = isOk ? '#22c55e' : '#ef4444';
          const stateBg     = isOk ? 'rgba(34,197,94,0.08)'  : 'rgba(239,68,68,0.08)';
          const stateBorder = isOk ? 'rgba(34,197,94,0.25)'  : 'rgba(239,68,68,0.25)';
          return (
            <div key={db.key} style={{ background: stateBg, border: `1px solid ${stateBorder}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: db.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {dbIcon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{db.label}</span>
                  <span style={{ fontSize: 9, color: 'var(--dim)' }}>{db.sub}</span>
                </div>
                {isOk ? (
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Latency:{' '}
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: info.latency < 100 ? '#22c55e' : info.latency < 500 ? '#eab308' : '#ef4444' }}>
                      {info.latency} ms
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {info?.error || 'Tidak dapat terhubung'}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stateColor, boxShadow: isOk ? `0 0 0 3px ${stateColor}33` : 'none' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: stateColor }}>{isOk ? 'Connected' : 'Error'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SCHEDULER STATUS CARD
// ════════════════════════════════════════════════════════════════
function SchedulerStatusCard({ intervalValue, onIntervalChange }) {
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  function formatAgo(iso) {
    if (!iso) return '—';
    const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60)   return `${secs}s lalu`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m lalu`;
    return `${Math.floor(secs / 3600)}j lalu`;
  }

  async function fetchStatus() {
    try { const res = await api.getSchedulerStatus(); setStatus(res); } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchStatus();
    timerRef.current = setInterval(fetchStatus, 8000);
    return () => clearInterval(timerRef.current);
  }, []);

  const dot = status?.running ? { color: '#22c55e', label: 'Berjalan' } : { color: '#ef4444', label: 'Berhenti' };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Status Scheduler</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
              Cek <code style={{ fontFamily: 'JetBrains Mono, monospace', background: 'var(--border)', padding: '0 3px', borderRadius: 3 }}>sync_prtspl</code>{' '}
              tiap{' '}
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text)' }}>
                {status?.intervalSeconds ?? '…'} seconds
              </span>
              {' '}→ trigger alarm ke <code style={{ fontFamily: 'JetBrains Mono, monospace', background: 'var(--border)', padding: '0 3px', borderRadius: 3 }}>alarm_active</code>
            </div>
          </div>
        </div>
        {!loading && status && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot.color, boxShadow: status?.running ? `0 0 0 3px ${dot.color}33` : 'none' }} />
            <span style={{ fontSize: 11, color: dot.color, fontWeight: 600 }}>{dot.label}</span>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ marginBottom: 14 }}>
          <NumberInput
            label="Interval Pengecekan" unit="seconds"
            hint="Seberapa sering sistem cek alarm baru. Harus lebih kecil dari Trigger Duration."
            value={intervalValue} onChange={onIntervalChange}
          />
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '0 0 14px' }} />
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 10, borderRadius: 5, width: i === 1 ? '60%' : '85%' }} />
            ))}
          </div>
        ) : !status ? (
          <div style={{ fontSize: 12, color: 'var(--dim)', textAlign: 'center', padding: '8px 0' }}>Tidak dapat membaca status scheduler.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Run Terakhir',   value: formatAgo(status.lastRun) },
              { label: 'Interval Aktif', value: status.intervalSeconds ? `${status.intervalSeconds}s` : '—' },
              { label: 'Alarm Aktif',    value: status.totalActive    ?? '—', accent: Number(status.totalActive)    > 0 },
              { label: 'Total Trigger',  value: status.totalTriggered ?? '—', accent: Number(status.totalTriggered) > 0 },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: item.accent ? 'var(--accent)' : 'var(--text)' }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
        {status?.error && (
          <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ wordBreak: 'break-all' }}>{status.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL POINT STATUS (Tambah / Edit)
// ════════════════════════════════════════════════════════════════
const EMPTY_FORM = {
  point_number: '', point_name: '', point_text: '',
  path1: '', path1_text: '', path3: '', path3_text: '',
  id_pointtype: '', id_up3: '', id_ulp: '', is_active: '1',
};

function PointStatusModal({ mode, initial, refUp3, refPointtype, onClose, onSaved }) {
  const [form,    setForm]    = useState(mode === 'edit' ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.point_number.trim()) { setError('Point number wajib diisi.'); return; }
    setSaving(true);
    try {
      if (mode === 'add') {
        await api.createPointStatus(form);
      } else {
        await api.updatePointStatus(initial.id, form);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
        <div style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--border)',
          width: '100%', maxWidth: 480,
          maxHeight: '90vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}>

          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {mode === 'add' ? 'Tambah Point Status' : 'Edit Point Status'}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* ── Bagian: Identitas ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase' }}>Identitas</div>

              <Field label="Point Number" required>
                <input
                  style={{ ...inputStyle, background: mode === 'edit' ? 'var(--border)' : 'var(--bg)', color: mode === 'edit' ? 'var(--dim)' : 'var(--text)' }}
                  value={form.point_number}
                  onChange={e => setF('point_number', e.target.value)}
                  disabled={mode === 'edit'}
                  placeholder="Contoh: PLN.001.GI.01"
                />
              </Field>

              <Field label="Point Database">
                <input style={inputStyle} value={form.point_name} onChange={e => setF('point_name', e.target.value)} placeholder="Nama point di database" />
              </Field>

              <Field label="Point Text">
                <input style={inputStyle} value={form.point_text} onChange={e => setF('point_text', e.target.value)} placeholder="Deskripsi / label tampilan" />
              </Field>

              {/* ── Bagian: Lokasi ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>Lokasi</div>

              <Field label="UP3">
                <select style={inputStyle} value={form.id_up3} onChange={e => setF('id_up3', e.target.value)}>
                  <option value="">— Pilih UP3 —</option>
                  {refUp3.map(r => (
                    <option key={r.APJ_ID} value={String(r.APJ_ID)}>{r.APJ_NAMA}</option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                <Field label="Path 1 (kode)">
                  <input style={inputStyle} value={form.path1} onChange={e => setF('path1', e.target.value)} placeholder="Kode" />
                </Field>
                <Field label="GI (nama)">
                  <input style={inputStyle} value={form.path1_text} onChange={e => setF('path1_text', e.target.value)} placeholder="Nama GI" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                <Field label="Path 3 (kode)">
                  <input style={inputStyle} value={form.path3} onChange={e => setF('path3', e.target.value)} placeholder="Kode" />
                </Field>
                <Field label="Bay (nama)">
                  <input style={inputStyle} value={form.path3_text} onChange={e => setF('path3_text', e.target.value)} placeholder="Nama bay" />
                </Field>
              </div>

              <Field label="ULP">
                <input style={inputStyle} value={form.id_ulp} onChange={e => setF('id_ulp', e.target.value)} placeholder="ID ULP" />
              </Field>

              {/* ── Bagian: Konfigurasi ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>Konfigurasi</div>

              <Field label="Jenis">
                <select style={inputStyle} value={form.id_pointtype} onChange={e => setF('id_pointtype', e.target.value)}>
                  <option value="">— Pilih Jenis —</option>
                  {refPointtype.map(r => (
                    <option key={r.id_pointtype} value={r.id_pointtype}>{r.pointtype}</option>
                  ))}
                </select>
              </Field>

              <Field label="Status">
                <select style={inputStyle} value={form.is_active} onChange={e => setF('is_active', e.target.value)}>
                  <option value="1">Aktif — dipantau (alarm, dashboard, laporan)</option>
                  <option value="0">Nonaktif — diabaikan</option>
                </select>
              </Field>

            </div>
          </form>

          {/* Footer */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {error && <ValidationMsg type="error">{error}</ValidationMsg>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button" onClick={onClose}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
              >
                Batal
              </button>
              <button
                type="submit" onClick={handleSubmit} disabled={saving}
                style={{ flex: 2, padding: '9px 0', borderRadius: 10, border: 'none', background: saving ? 'rgba(168,85,247,0.6)' : 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {saving
                  ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Menyimpan...</>
                  : mode === 'add' ? 'Tambah' : 'Simpan Perubahan'
                }
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// MASTER DATA — POINT STATUS TABLE
// ════════════════════════════════════════════════════════════════
function MasterPointStatus() {
  const [rows,       setRows]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [refUp3,     setRefUp3]     = useState([]);
  const [refPT,      setRefPT]      = useState([]);
  const [modal,      setModal]      = useState({ open: false, mode: 'add', row: null });
  const [toast,      setToast]      = useState('');

  const LIMIT = 20;

  // Mirror scroll: top bar ↔ table
  const topScrollRef   = useRef(null);
  const tableScrollRef = useRef(null);
  useEffect(() => {
    const top   = topScrollRef.current;
    const table = tableScrollRef.current;
    if (!top || !table) return;
    const syncFromTop   = () => { table.scrollLeft = top.scrollLeft; };
    const syncFromTable = () => { top.scrollLeft   = table.scrollLeft; };
    top.addEventListener('scroll',   syncFromTop);
    table.addEventListener('scroll', syncFromTable);
    return () => {
      top.removeEventListener('scroll',   syncFromTop);
      table.removeEventListener('scroll', syncFromTable);
    };
  }, []);

  const [filters, setFilters] = useState({ point_name: '', path1: '', id_up3: '', id_pointtype: '' });
  const [applied, setApplied] = useState({ point_name: '', path1: '', id_up3: '', id_pointtype: '' });

  // Load ref data sekali saja
  useEffect(() => {
    api.getRefUp3().then(setRefUp3).catch(() => {});
    api.getRefPointtype().then(setRefPT).catch(() => {});
  }, []);

  const loadData = useCallback(async (pg, fil) => {
    setLoading(true);
    try {
      const res = await api.getMasterPointStatus({ ...fil, page: pg, limit: LIMIT });
      setRows(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(page, applied); }, [page, applied, loadData]);

  function handleSearch() {
    setPage(1);
    setApplied({ ...filters });
  }

  function handleReset() {
    const empty = { point_name: '', path1: '', id_up3: '', id_pointtype: '' };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleSaved() {
    setModal({ open: false, mode: 'add', row: null });
    loadData(page, applied);
    showToast(modal.mode === 'add' ? 'Point berhasil ditambahkan.' : 'Data berhasil diperbarui.');
  }

  const up3Map = {};
  refUp3.forEach(r => { up3Map[String(r.APJ_ID)] = r.APJ_NAMA; });

  const ptMap = {};
  refPT.forEach(r => { ptMap[r.id_pointtype] = r.pointtype; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, background: '#22c55e', color: '#fff',
          borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <PointStatusModal
          mode={modal.mode}
          initial={modal.row}
          refUp3={refUp3}
          refPointtype={refPT}
          onClose={() => setModal({ open: false, mode: 'add', row: null })}
          onSaved={handleSaved}
        />
      )}

      {/* ── Filter bar ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>

          <Field label="Point Database">
            <input
              style={inputStyle}
              value={filters.point_name}
              onChange={e => setFilters(f => ({ ...f, point_name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Cari nama point..."
            />
          </Field>

          <Field label="GI">
            <input
              style={inputStyle}
              value={filters.path1}
              onChange={e => setFilters(f => ({ ...f, path1: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Cari nama GI..."
            />
          </Field>

          <Field label="UP3">
            <select style={inputStyle} value={filters.id_up3} onChange={e => setFilters(f => ({ ...f, id_up3: e.target.value }))}>
              <option value="">Semua UP3</option>
              {refUp3.map(r => <option key={r.APJ_ID} value={String(r.APJ_ID)}>{r.APJ_NAMA}</option>)}
            </select>
          </Field>

          <Field label="Jenis">
            <select style={inputStyle} value={filters.id_pointtype} onChange={e => setFilters(f => ({ ...f, id_pointtype: e.target.value }))}>
              <option value="">Semua Jenis</option>
              {refPT.map(r => <option key={r.id_pointtype} value={r.id_pointtype}>{r.pointtype}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSearch}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            Cari
          </button>
          <button
            onClick={handleReset}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Table header + add button ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: 'var(--dim)' }}>
          {loading ? 'Memuat...' : `${total.toLocaleString('id-ID')} data ditemukan`}
        </div>
        <button
          onClick={() => setModal({ open: true, mode: 'add', row: null })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>

        {/* Scrollbar atas — mirror dari scrollbar bawah tabel */}
        <div
          ref={topScrollRef}
          style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', borderBottom: '1px solid var(--border)' }}
        >
          <div style={{ minWidth: 480, height: 1 }} />
        </div>

        <div ref={tableScrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ minWidth: 480, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['', 'Point Database', 'UP3', 'Jenis', 'Status'].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 12px', textAlign: i === 0 ? 'center' : 'left',
                    fontSize: 10, fontWeight: 700, color: 'var(--dim)',
                    letterSpacing: 0.5, textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    borderRight: i < 4 ? '1px solid var(--border)' : 'none',
                    width: i === 0 ? 56 : 'auto',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} style={{ padding: '10px 12px' }}>
                        <div className="skeleton" style={{ height: 12, borderRadius: 4, width: j === 0 ? 40 : '80%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
                    Tidak ada data.
                  </td>
                </tr>
              ) : rows.map(row => {
                const isActive = row.is_active == null ? true : row.is_active === 1;
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Aksi — paling kiri */}
                    <td style={{ padding: '8px 10px', borderRight: '1px solid var(--border)', textAlign: 'center', width: 56 }}>
                      <button
                        onClick={() => setModal({ open: true, mode: 'edit', row })}
                        style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', whiteSpace: 'nowrap' }}
                      >
                        Edit
                      </button>
                    </td>

                    {/* Point Database */}
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                        {row.point_name || <span style={{ color: 'var(--dim)' }}>—</span>}
                      </div>
                      {row.point_text && (
                        <div style={{ fontSize: 10, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                          {row.point_text}
                        </div>
                      )}
                    </td>

                    {/* UP3 */}
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--muted)' }}>{row.up3_nama || <span style={{ color: 'var(--dim)' }}>—</span>}</span>
                    </td>

                    {/* Jenis */}
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {row.pointtype
                        ? <span style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{row.pointtype}</span>
                        : <span style={{ color: 'var(--dim)' }}>—</span>
                      }
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                        background: isActive ? 'rgba(34,197,94,0.12)'  : 'rgba(100,116,139,0.12)',
                        color:      isActive ? '#22c55e'                : '#64748b',
                      }}>
                        {isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: page <= 1 ? 'var(--dim)' : 'var(--text)', fontSize: 12, fontWeight: 600, cursor: page <= 1 ? 'not-allowed' : 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: page >= totalPages ? 'var(--dim)' : 'var(--text)', fontSize: 12, fontWeight: 600, cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PENGATURAN TAB (existing settings)
// ════════════════════════════════════════════════════════════════
function PengaturanTab({ user, isDesktop = false }) {
  const [form, setForm] = useState({
    trigger_duration: '', scheduler_interval: '', sla_warning: '', sla_breach: '',
  });
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState('');
  const [warnings,     setWarnings]     = useState([]);

  // Toggle alarm engine (trigger)
  const [engineEnabled,         setEngineEnabled]         = useState(true);
  const [toggling,              setToggling]              = useState(false);

  // Toggle auto-cleanup
  const [cleanupEnabled,        setCleanupEnabled]        = useState(true);
  const [togglingClean,         setTogglingClean]         = useState(false);

  // Toggle trigger duration (glitch filter)
  const [triggerDurEnabled,     setTriggerDurEnabled]     = useState(true);
  const [togglingTriggerDur,    setTogglingTriggerDur]    = useState(false);

  useEffect(() => {
    api.getSettings()
      .then(data => {
        setForm({
          trigger_duration:   data.trigger_duration   ?? '',
          scheduler_interval: data.scheduler_interval ?? '',
          sla_warning:        data.sla_warning        ?? '',
          sla_breach:         data.sla_breach         ?? '',
        });
        setEngineEnabled(data.scheduler_enabled        === undefined || Number(data.scheduler_enabled)        === 1);
        setCleanupEnabled(data.cleanup_enabled         === undefined || Number(data.cleanup_enabled)          === 1);
        setTriggerDurEnabled(data.trigger_duration_enabled === undefined || Number(data.trigger_duration_enabled) === 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleEngine() {
    const newVal = engineEnabled ? 0 : 1;
    setToggling(true);
    try {
      await api.saveSettings({ scheduler_enabled: newVal });
      setEngineEnabled(!!newVal);
    } catch (err) {
      setError('Gagal mengubah status alarm engine: ' + err.message);
    } finally {
      setToggling(false);
    }
  }

  async function handleToggleCleanup() {
    const newVal = cleanupEnabled ? 0 : 1;
    setTogglingClean(true);
    try {
      await api.saveSettings({ cleanup_enabled: newVal });
      setCleanupEnabled(!!newVal);
    } catch (err) {
      setError('Gagal mengubah status auto-cleanup: ' + err.message);
    } finally {
      setTogglingClean(false);
    }
  }

  async function handleToggleTriggerDur() {
    const newVal = triggerDurEnabled ? 0 : 1;
    setTogglingTriggerDur(true);
    try {
      await api.saveSettings({ trigger_duration_enabled: newVal });
      setTriggerDurEnabled(!!newVal);
    } catch (err) {
      setError('Gagal mengubah trigger duration: ' + err.message);
    } finally {
      setTogglingTriggerDur(false);
    }
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setError(''); setSaved(false); setWarnings([]);
  }

  function validate() {
    const errs = []; const warns = [];
    const n = key => Number(form[key]);
    if (!form.trigger_duration   || n('trigger_duration')   < 1) errs.push('Trigger Duration harus ≥ 1 seconds.');
    if (!form.scheduler_interval || n('scheduler_interval') < 1) errs.push('Interval Pengecekan harus ≥ 1 seconds.');
    if (!form.sla_warning        || n('sla_warning')        < 1) errs.push('Batas Warning SLA harus ≥ 1 minutes.');
    if (!form.sla_breach         || n('sla_breach')         < 1) errs.push('Batas Breach SLA harus ≥ 1 minutes.');
    if (n('scheduler_interval') >= n('trigger_duration'))
      warns.push('Interval Pengecekan sebaiknya lebih kecil dari Trigger Duration.');
    if (n('sla_warning') >= n('sla_breach'))
      warns.push('Batas Warning harus lebih kecil dari Batas Breach.');
    return { errs, warns };
  }

  async function handleSave(e) {
    e.preventDefault();
    const { errs, warns } = validate();
    if (errs.length > 0) { setError(errs[0]); return; }
    if (warns.length > 0) { setWarnings(warns); return; }
    setError(''); setWarnings([]); setSaving(true); setShowProgress(true); setSaved(false);
    const startTime = Date.now();
    let isError = false;
    try {
      await api.saveSettings({
        trigger_duration:   Number(form.trigger_duration),
        scheduler_interval: Number(form.scheduler_interval),
        sla_warning:        Number(form.sla_warning),
        sla_breach:         Number(form.sla_breach),
      });
    } catch (err) {
      setError(err.message || 'Gagal menyimpan pengaturan.');
      isError = true;
    } finally {
      const remaining = Math.max(0, 1000 - (Date.now() - startTime));
      setTimeout(() => {
        setSaving(false); setShowProgress(false);
        if (!isError) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      }, remaining);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status cards: 2-kolom di desktop, 1-kolom di mobile */}
      <div style={isDesktop
        ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }
        : { display: 'flex', flexDirection: 'column', gap: 16 }
      }>
        <DbStatusCard />
        <SchedulerStatusCard intervalValue={form.scheduler_interval} onIntervalChange={v => setField('scheduler_interval', v)} />
      </div>

      <form
        onSubmit={handleSave}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: saving ? 0.55 : 1, transition: 'opacity 0.25s', pointerEvents: saving ? 'none' : 'auto' }}
      >
        {/* Alarm Engine */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ height: 3, background: 'var(--border)', overflow: 'hidden', opacity: showProgress ? 1 : 0, transition: 'opacity 0.2s' }}>
            <div className="progress-sweep" style={{ width: '25%', height: '100%', background: 'linear-gradient(90deg, transparent, #a855f7, #7c3aed, transparent)', borderRadius: 2 }} />
          </div>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: engineEnabled ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.3s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={engineEnabled ? 'white' : 'var(--dim)'} strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Alarm Engine</div>
                <div style={{ fontSize: 10, color: engineEnabled ? 'var(--dim)' : '#ef4444', marginTop: 1, fontWeight: engineEnabled ? 400 : 600 }}>
                  {engineEnabled ? 'Deteksi & aktivasi alarm aktif' : 'Alarm engine dinonaktifkan'}
                </div>
              </div>
            </div>

            {/* Toggle ON/OFF */}
            <button
              type="button"
              onClick={handleToggleEngine}
              disabled={toggling || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 12px', borderRadius: 20, cursor: toggling ? 'wait' : 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 11, fontWeight: 700,
                border: `1px solid ${engineEnabled ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                background: engineEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: engineEnabled ? '#22c55e' : '#ef4444',
                transition: 'all 0.2s', flexShrink: 0,
                opacity: toggling || loading ? 0.6 : 1,
              }}
            >
              {/* Slider visual */}
              <div style={{
                width: 28, height: 16, borderRadius: 8, position: 'relative',
                background: engineEnabled ? '#22c55e' : '#ef4444',
                transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 2,
                  left: engineEnabled ? 14 : 2,
                  width: 12, height: 12, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </div>
              {toggling ? '...' : engineEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {/* Trigger Duration toggle row */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: triggerDurEnabled ? 'rgba(99,102,241,0.15)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.3s' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={triggerDurEnabled ? '#818cf8' : 'var(--dim)'} strokeWidth="2.5">
                  <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>Trigger Duration (Glitch Filter)</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>
                  {triggerDurEnabled
                    ? 'App harus bertahan X detik sebelum jadi alarm'
                    : 'Trigger langsung — setiap App terbaru per relay'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleTriggerDur}
              disabled={togglingTriggerDur || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 20, cursor: togglingTriggerDur ? 'wait' : 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 11, fontWeight: 700,
                border: `1px solid ${triggerDurEnabled ? 'rgba(99,102,241,0.4)' : 'rgba(100,116,139,0.4)'}`,
                background: triggerDurEnabled ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.1)',
                color: triggerDurEnabled ? '#818cf8' : '#64748b',
                transition: 'all 0.2s', flexShrink: 0,
                opacity: togglingTriggerDur || loading ? 0.6 : 1,
              }}
            >
              <div style={{ width: 24, height: 14, borderRadius: 7, position: 'relative', background: triggerDurEnabled ? '#6366f1' : '#64748b', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 1, left: triggerDurEnabled ? 11 : 1, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
              {togglingTriggerDur ? '...' : triggerDurEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Trigger Duration input — persis di bawah toggle-nya */}
          {triggerDurEnabled && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              {loading
                ? <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
                : <NumberInput label="Trigger Duration" unit="seconds" hint="App harus bertahan X detik (tanpa Dis baru) sebelum dikonfirmasi alarm." value={form.trigger_duration} onChange={v => setField('trigger_duration', v)} />
              }
            </div>
          )}

          {/* Auto-Cleanup toggle row */}
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: cleanupEnabled ? 'rgba(234,179,8,0.2)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.3s' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={cleanupEnabled ? '#eab308' : 'var(--dim)'} strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>Auto-Cleanup Recovery</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>
                  {cleanupEnabled
                    ? 'Hapus otomatis alarm yang sudah recovery (Dis)'
                    : 'Alarm tidak dihapus otomatis — manual ack saja'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleCleanup}
              disabled={togglingClean || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 20, cursor: togglingClean ? 'wait' : 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 11, fontWeight: 700,
                border: `1px solid ${cleanupEnabled ? 'rgba(234,179,8,0.4)' : 'rgba(100,116,139,0.4)'}`,
                background: cleanupEnabled ? 'rgba(234,179,8,0.1)' : 'rgba(100,116,139,0.1)',
                color: cleanupEnabled ? '#ca8a04' : '#64748b',
                transition: 'all 0.2s', flexShrink: 0,
                opacity: togglingClean || loading ? 0.6 : 1,
              }}
            >
              <div style={{ width: 24, height: 14, borderRadius: 7, position: 'relative', background: cleanupEnabled ? '#eab308' : '#64748b', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 1, left: cleanupEnabled ? 11 : 1, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
              {togglingClean ? '...' : cleanupEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* SLA */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #eab308, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>SLA</div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>Service Level Agreement — batas waktu penanganan alarm</div>
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: i % 2 === 0 ? 32 : 42, borderRadius: 8, width: '100%' }} />
                ))}
              </div>
            ) : (
              <>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                  {[{ label: 'NORMAL', color: '#22c55e', flex: 3 }, { label: 'WARNING', color: '#eab308', flex: 2 }, { label: 'BREACH', color: '#ef4444', flex: 2 }].map((s, i) => (
                    <div key={s.label} style={{ flex: s.flex, textAlign: 'center', padding: '5px 4px', background: `${s.color}18`, borderLeft: i > 0 ? `1px solid ${s.color}44` : 'none' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: 0.5 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <NumberInput label="Batas Warning" unit="minutes" hint="Alarm berubah dari NORMAL → WARNING setelah X minutes." value={form.sla_warning} onChange={v => setField('sla_warning', v)} />
                  <NumberInput label="Batas Breach" unit="minutes" hint="Alarm berubah dari WARNING → BREACH setelah X minutes. Harus lebih besar dari Batas Warning." value={form.sla_breach} onChange={v => setField('sla_breach', v)} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {warnings.map((w, i) => <ValidationMsg key={i} type="warn">{w}</ValidationMsg>)}
          {error && <ValidationMsg type="error">{error}</ValidationMsg>}
          {warnings.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'center' }}>
              Klik <strong>Simpan</strong> sekali lagi untuk tetap menyimpan.
            </div>
          )}
          <SuccessMsg show={saved} />
          <button
            type="submit" disabled={saving}
            style={{
              background: saving ? 'linear-gradient(135deg, #7c3aed99, #6d28d999)' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
              border: 'none', borderRadius: 10, padding: '11px 0', width: '100%',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: saving ? 0.85 : 1, transition: 'background 0.2s, opacity 0.2s',
            }}
          >
            {saving ? (
              <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Menyimpan...</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>Simpan Pengaturan</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ALARM SOUND CARD
// ════════════════════════════════════════════════════════════════
function AlarmSoundCard() {
  const [exists,    setExists]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState('');
  const [error,     setError]     = useState('');

  useEffect(() => {
    api.checkAlarmSound().then(r => setExists(r.exists)).catch(() => {});
  }, []);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setError(''); setResult('');
    try {
      await api.uploadAlarmSound(file);
      setExists(true);
      setResult('Suara alarm berhasil diupload.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handlePreview() {
    try {
      const a = new Audio(`${BACKEND_URL}/uploads/alarm.wav?t=${Date.now()}`);
      a.play().catch(() => setError('Autoplay diblokir browser. Coba klik play manual.'));
    } catch {}
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #f97316, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Suara Alarm</div>
            <div style={{ fontSize: 10, color: 'var(--dim)' }}>File .wav — diputar saat alarm baru masuk</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: exists ? '#22c55e' : '#64748b' }} />
          <span style={{ fontSize: 11, color: exists ? '#22c55e' : 'var(--dim)', fontWeight: 600 }}>
            {exists ? 'Terpasang' : 'Belum ada'}
          </span>
        </div>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '9px 0', borderRadius: 10, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--muted)', fontSize: 12, fontWeight: 600,
            opacity: uploading ? 0.6 : 1,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? 'Mengupload...' : 'Upload .wav'}
            <input type="file" accept=".wav,audio/wav" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
          </label>
          {exists && (
            <button
              onClick={handlePreview}
              style={{
                padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.4)',
                background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Test
            </button>
          )}
        </div>
        {result && <div style={{ fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '7px 12px' }}>{result}</div>}
        {error  && <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '7px 12px' }}>{error}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// UPLOAD TAB
// ════════════════════════════════════════════════════════════════
function UploadTab() {
  const [rows,      setRows]      = useState([]);
  const [fileName,  setFileName]  = useState('');
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');

  function toMySQLDatetime(d) {
    if (!d) return null;
    if (d instanceof Date) {
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    return String(d);
  }

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFileName(f.name); setResult(null); setError('');
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const wb   = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        // range: 1 → skip baris header (A1=TIME, B1=DESC)
        const data = XLSX.utils.sheet_to_json(ws, { header: ['TIME', 'DESC'], range: 1 });
        const clean = data.filter(r => r.TIME && r.DESC).map(r => ({
          TIME: toMySQLDatetime(r.TIME),
          DESC: String(r.DESC),
        }));
        setRows(clean);
        if (clean.length === 0) setError('Tidak ada baris valid. Pastikan kolom A=TIME, B=DESC, baris 1 adalah header.');
      } catch (err) {
        setError('Gagal membaca file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(f);
  }

  async function handleUpload() {
    if (rows.length === 0 || uploading) return;
    setUploading(true); setError(''); setResult(null);
    try {
      const res = await api.importPrtspl(rows);
      setResult(res);
      setRows([]); setFileName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AlarmSoundCard />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Import Data SCADA</div>
            <div style={{ fontSize: 10, color: 'var(--dim)' }}>Excel .xlsx — kolom A: TIME, kolom B: DESC (baris 1 = header)</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Format hint */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Format Excel:</div>
            <div><code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}>A1</code> → TIME &nbsp;|&nbsp; <code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}>B1</code> → DESC</div>
            <div><code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--dim)' }}>A2</code> → 2026-04-01 08:00:00</div>
            <div><code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--dim)' }}>B2</code> → GI-GI SRATEN.SF GN1.OC.REC1.R.App</div>
          </div>

          {/* File input */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            border: '2px dashed var(--border)', cursor: 'pointer',
            background: 'var(--bg)', transition: 'border-color 0.2s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span style={{ fontSize: 12, color: fileName ? 'var(--text)' : 'var(--dim)', fontWeight: fileName ? 600 : 400 }}>
              {fileName || 'Pilih file .xlsx / .xls'}
            </span>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          </label>

          {/* Row count */}
          {rows.length > 0 && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
              {rows.length.toLocaleString('id-ID')} baris valid siap diimport
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ef4444' }}>
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#22c55e' }}>
              ✓ Berhasil: <strong>{result.inserted.toLocaleString('id-ID')}</strong> baris &nbsp;·&nbsp; Dilewati: <strong>{result.skipped}</strong> baris
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleUpload}
            disabled={rows.length === 0 || uploading}
            style={{
              padding: '11px 0', borderRadius: 10, border: 'none',
              background: rows.length === 0 ? 'var(--border)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: rows.length === 0 ? 'var(--dim)' : '#fff',
              fontSize: 13, fontWeight: 700,
              cursor: rows.length === 0 || uploading ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading
              ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Mengimport...</>
              : `Import${rows.length > 0 ? ` ${rows.length.toLocaleString('id-ID')} Baris` : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN — AdminPage
// ════════════════════════════════════════════════════════════════
export default function AdminPage({ user, isDesktop = false }) {
  const [activeTab, setActiveTab] = useState('pengaturan');

  const TABS = [
    { key: 'pengaturan', label: 'Pengaturan' },
    { key: 'upload',     label: 'Upload' },
    { key: 'master',     label: 'Master Data' },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: isDesktop ? 900 : undefined }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Panel Admin</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.2 }}>Login sebagai: {user?.username}</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: activeTab === tab.key ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'pengaturan' && <PengaturanTab user={user} isDesktop={isDesktop} />}
      {activeTab === 'upload'     && <UploadTab />}
      {activeTab === 'master'     && <MasterPointStatus />}

    </div>
  );
}
