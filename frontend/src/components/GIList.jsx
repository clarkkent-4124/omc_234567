import { useState, useEffect } from 'react';
import { api } from '../services/api';

const BADGE = {
  'PICKUP GI': { colorVar: 'var(--pickup)', bgVar: 'var(--pickup-bg)', borderHex: '#ef444433' },
  'PICKUP KP': { colorVar: 'var(--rnr)',    bgVar: 'var(--rnr-bg)',    borderHex: '#3b82f633' },
};

const TYPE_CHIPS = ['Semua', 'PICKUP GI', 'PICKUP KP'];

function formatDateLabel(isoStr) {
  return new Date(isoStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function GIList({ dari, sampai, filterKey, applying, onFetchDone, onGIClick }) {
  const [activeType, setActiveType] = useState('Semua');
  const [giData, setGiData]         = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { from: dari, to: sampai };
    if (activeType !== 'Semua') params.jenis = activeType;

    api.getDashboardGI(params)
      .then(res => {
        // res = direct array [{ nama_gi, total, pickup_gi, pickup_kp }]
        const arr = Array.isArray(res) ? res : (res.data || []);
        setGiData(arr);
      })
      .catch(() => setGiData([]))
      .finally(() => { setLoading(false); onFetchDone?.(); });
  }, [dari, sampai, filterKey, activeType]);

  const dateLabel = new Date(dari + 'T12:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
          Alarm per GI:{' '}
          <span style={{ color: 'var(--accent)', textTransform: 'none', letterSpacing: 0 }}>{dateLabel}</span>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {TYPE_CHIPS.map(chip => {
          const active   = activeType === chip;
          const colorVar = chip === 'Semua' ? 'var(--accent)' : chip === 'PICKUP GI' ? 'var(--pickup)' : 'var(--rnr)';
          const bgVar    = chip === 'Semua' ? 'var(--accent-bg)' : chip === 'PICKUP GI' ? 'var(--pickup-bg)' : 'var(--rnr-bg)';
          return (
            <button
              key={chip}
              onClick={() => setActiveType(chip)}
              style={{
                background: active ? bgVar : 'transparent',
                color: active ? colorVar : 'var(--dim)',
                border: `1px solid ${active ? colorVar : 'var(--border)'}`,
                borderRadius: 20, padding: '3px 12px',
                fontSize: 11, fontWeight: active ? 700 : 400,
                cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {(loading || applying) ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '55%', height: 10, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '30%', height: 8 }} />
              </div>
              <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 6 }} />
            </div>
          ))
        ) : giData.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            Tidak ada data alarm pada periode ini
          </div>
        ) : giData.map((gi, i) => (
          <div
            key={gi.nama_gi}
            onClick={() => onGIClick?.(gi.nama_gi)}
            style={{
              padding: '12px 14px',
              borderBottom: i < giData.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{gi.nama_gi}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>{parseInt(gi.total)} alarm</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {[['PICKUP GI', gi.pickup_gi], ['PICKUP KP', gi.pickup_kp]].map(([type, count]) =>
                parseInt(count) > 0 && (
                  <span key={type} style={{
                    background: BADGE[type].bgVar, color: BADGE[type].colorVar,
                    border: `1px solid ${BADGE[type].borderHex}`,
                    borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 700,
                  }}>
                    {type.split(' ')[1]}×{count}
                  </span>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
