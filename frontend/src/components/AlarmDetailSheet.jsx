import { useEffect, useState } from 'react';
import { api } from '../services/api';

// ── Helpers ──────────────────────────────────────────────────────
const TYPE_STYLE = {
  'PICKUP GI': { color: 'var(--pickup)', bg: 'var(--pickup-bg)', border: 'var(--pickup-border)' },
  'PICKUP KP': { color: 'var(--rnr)',    bg: 'var(--rnr-bg)',    border: 'var(--rnr-border)'    },
  OTHER:       { color: 'var(--muted)', bg: 'var(--surface2)',  border: 'var(--border)'        },
};

function formatDurasi(detik) {
  if (!detik || detik < 0) return '—';
  if (detik < 60)  return `${detik} detik`;
  const m = Math.floor(detik / 60);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}j ${rm}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}h ${rh}j ${rm}m`;
}

function formatDT(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--dim)', flexShrink: 0, minWidth: 90 }}>{label}</span>
      <span style={{
        fontSize: 12, fontWeight: 600, textAlign: 'right',
        color: accent ? 'var(--accent)' : 'var(--text)',
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        wordBreak: 'break-all',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

const Divider = () => <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />;

// ── Kesimpulan badge ─────────────────────────────────────────────
function KesimpulanBadge({ value }) {
  if (!value) return null;
  const isValid = value === 'valid';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
      background: isValid ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      color:      isValid ? '#22c55e'               : '#ef4444',
      textTransform: 'uppercase',
    }}>
      {value}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function AlarmDetailSheet({ alarm: initialAlarm, onClose, user, onAck, isDesktop = false }) {
  const [detail,   setDetail]   = useState(null);
  const [riwayat,  setRiwayat]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  // Validasi form state
  const [kesimpulan,  setKesimpulan]  = useState('');
  const [keterangan,  setKeterangan]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit() {
    setSaveError('');
    if (!kesimpulan) { setSaveError('Pilih kesimpulan terlebih dahulu.'); return; }
    if (!keterangan.trim()) { setSaveError('Keterangan wajib diisi.'); return; }
    if (!user?.username) return;

    setSaving(true);
    try {
      await api.ackAlarm({
        pkey:       initialAlarm.id,
        ack_by:     user.username,
        kesimpulan,
        keterangan: keterangan.trim(),
      });
      onAck?.();
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Gagal menyimpan validasi.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!initialAlarm?.id) return;
    setLoading(true);
    api.getAlarmDetail(initialAlarm.id)
      .then(res => { setDetail(res.alarm); setRiwayat(res.riwayat || []); })
      .catch(err => setError(err.message || 'Gagal memuat detail.'))
      .finally(() => setLoading(false));
  }, [initialAlarm?.id]);

  const alarm        = detail || initialAlarm;
  const s            = TYPE_STYLE[alarm?.jenis] || TYPE_STYLE.OTHER;
  const isActive     = alarm?.status === 'ACTIVE';
  // Gunakan detail (dari API) untuk cek ack — initialAlarm dari list mungkin punya ack_at
  // dari riwayat lama (JOIN point_key tanpa filter waktu). Jika alarm masih ACTIVE,
  // pasti belum divalidasi → paksa alreadyAcked = false.
  const ackData      = detail || initialAlarm;
  const alreadyAcked = !isActive && !!ackData?.ack_at;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)' }} />

      {/* Sheet / Modal */}
      <div
        className={isDesktop ? 'modal-fade-in' : 'sheet-up'}
        style={isDesktop ? {
          position: 'fixed', top: '50%', left: '50%', zIndex: 101,
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface)',
          borderRadius: 16,
          width: '100%', maxWidth: 640,
          maxHeight: '88dvh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        } : {
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '88dvh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
        }}
      >
        {/* Drag handle — hanya mobile */}
        {!isDesktop && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
          </div>
        )}

        {/* ── Sheet header ── */}
        <div style={{ padding: '10px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {alarm?.jenis || '—'}
                </span>
                <span style={{
                  background: isActive ? 'var(--pickup-bg)' : 'rgba(34,197,94,0.1)',
                  color: isActive ? 'var(--pickup)' : '#22c55e',
                  border: `1px solid ${isActive ? 'var(--pickup-border)' : 'rgba(34,197,94,0.3)'}`,
                  borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {isActive && <div className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--pickup)' }} />}
                  {isActive ? 'ACTIVE' : 'CLEARED'}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                {alarm?.point_text || '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {alarm?.path1_text}
                {(alarm?.SUMBER_FEEDER || alarm?.KEYPOINT) ? ` · ${alarm.SUMBER_FEEDER || alarm.KEYPOINT}` : ''}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 18px 32px' }}>

          {error && (
            <div style={{ background: 'var(--pickup-bg)', border: '1px solid var(--pickup-border)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--pickup)', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* ── Sudah divalidasi — tampilkan hasil ── */}
          {alreadyAcked && (
            <div style={{
              borderRadius: 12, padding: '12px 14px', marginBottom: 16,
              background: ackData.kesimpulan === 'valid'
                ? 'rgba(34,197,94,0.08)' : ackData.kesimpulan === 'invalid'
                ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
              border: `1px solid ${ackData.kesimpulan === 'valid'
                ? 'rgba(34,197,94,0.3)' : ackData.kesimpulan === 'invalid'
                ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={ackData.kesimpulan === 'valid' ? '#22c55e' : ackData.kesimpulan === 'invalid' ? '#ef4444' : '#ca8a04'}
                  strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Sudah Divalidasi</span>
                <KesimpulanBadge value={ackData.kesimpulan} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                <div>Oleh: <strong>{ackData.ack_by}</strong> · {new Date(ackData.ack_at).toLocaleString('id-ID')}</div>
                {ackData.keterangan && (
                  <div style={{ marginTop: 4, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 11, color: 'var(--text)', borderLeft: '3px solid var(--border)' }}>
                    {ackData.keterangan}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Form validasi (operator / admin, alarm masih ACTIVE) ── */}
          {(user?.role === 'operator' || user?.role === 'admin') && !alreadyAcked && (
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '16px', marginBottom: 16,
            }}>
              {/* Header form */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Validasi Alarm</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>
                Operator: <strong>{user?.username}</strong>
              </div>

              {/* Kesimpulan */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                  Kesimpulan <span style={{ color: '#ef4444' }}>*</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { val: 'valid',   label: 'Valid',   desc: 'Alarm nyata',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.4)'  },
                    { val: 'invalid', label: 'Invalid', desc: 'False alarm',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.4)'  },
                  ].map(opt => {
                    const selected = kesimpulan === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => { setKesimpulan(opt.val); setSaveError(''); }}
                        style={{
                          padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                          fontFamily: 'IBM Plex Sans, sans-serif',
                          border: `2px solid ${selected ? opt.color : 'var(--border)'}`,
                          background: selected ? opt.bg : 'var(--surface)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: selected ? opt.color : 'var(--text)', marginBottom: 2 }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 10, color: selected ? opt.color : 'var(--dim)', opacity: 0.8 }}>
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Keterangan */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                  Keterangan <span style={{ color: '#ef4444' }}>*</span>
                </div>
                <textarea
                  value={keterangan}
                  onChange={e => { setKeterangan(e.target.value); setSaveError(''); }}
                  placeholder="Tuliskan keterangan / tindakan yang dilakukan..."
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 10px',
                    color: 'var(--text)', fontSize: 12,
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    outline: 'none', resize: 'none',
                  }}
                />
              </div>

              {/* Error */}
              {saveError && (
                <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 10, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                  {saveError}
                </div>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  width: '100%', border: 'none', borderRadius: 8, padding: '10px 0',
                  background: saving ? 'rgba(168,85,247,0.5)' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {saving
                  ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Menyimpan...</>
                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> Simpan Validasi</>
                }
              </button>
            </div>
          )}

          {/* ── Durasi ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Durasi',      value: loading ? '...' : formatDurasi(detail?.durasi_detik), color: isActive ? 'var(--pickup)' : '#22c55e' },
              { label: 'Waktu Alarm', value: loading ? '...' : formatTime(alarm?.datum_2), sub: formatDate(alarm?.datum_2), color: 'var(--accent)' },
              { label: 'Waktu Validasi',
                value: loading ? '...' : (ackData?.ack_at ? formatTime(ackData.ack_at) : '—'),
                sub:   ackData?.ack_at ? formatDate(ackData.ack_at) : '',
                color: ackData?.ack_at ? '#22c55e' : 'var(--dim)' },
            ].map(item => (
              <div key={item.label} style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.2 }}>{item.value}</div>
                {item.sub && <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{item.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── Informasi Lokasi ── */}
          <SectionTitle>Informasi Lokasi</SectionTitle>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <InfoRow label="GI / Feeder"   value={alarm?.path1_text} />
            <InfoRow label="Sumber/KP"     value={alarm?.SUMBER_FEEDER || alarm?.KEYPOINT} />
            <InfoRow label="POINT_KEY"     value={alarm?.POINT_KEY} mono />
          </div>

          {/* ── Detail Teknis ── */}
          <SectionTitle>Detail Teknis</SectionTitle>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <InfoRow label="Indikasi"   value={alarm?.point_text} />
            <InfoRow label="Relay"      value={alarm?.RELAY}   mono />
            <InfoRow label="Phase"      value={alarm?.PHASE}   mono />
            <InfoRow label="SCADA"      value={alarm?.KESIMPULAN} />
          </div>

          {/* ── Riwayat ── */}
          <SectionTitle>Riwayat Kejadian ({loading ? '...' : riwayat.length})</SectionTitle>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
              ))}
            </div>
          ) : riwayat.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 12, padding: '16px 0' }}>
              Tidak ada riwayat sebelumnya
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riwayat.map((r, i) => {
                const isApp = r.KESIMPULAN === 'App';
                return (
                  <div key={r.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'JetBrains Mono, monospace' }}>#{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: isApp ? 'var(--pickup-bg)' : 'rgba(34,197,94,0.1)',
                          color:      isApp ? 'var(--pickup)'    : '#22c55e' }}>
                          {isApp ? 'PICKUP' : 'CLEAR'}
                        </span>
                        {(r.INDIKASI || r.RELAY) && (
                          <span style={{ fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[r.INDIKASI, r.RELAY, r.PHASE].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDT(r.datum_2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
