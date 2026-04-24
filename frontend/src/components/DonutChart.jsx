import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';

const JENIS_CONFIG = [
  { key: 'PICKUP GI', name: 'PICKUP GI', color: '#ef4444' },
  { key: 'PICKUP KP', name: 'PICKUP KP', color: '#3b82f6' },
];

function formatDateLabel(isoStr) {
  return new Date(isoStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CustomTooltip = ({ active, payload, total }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 12, color: d.payload.color, fontWeight: 700 }}>{d.name}</div>
      <div className="font-mono" style={{ fontSize: 16, color: 'var(--text)' }}>{d.value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</div>
    </div>
  );
};

export default function DonutChart({ dari, sampai, filterKey, applying, onFetchDone }) {
  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getDonut({ from: dari, to: sampai })
      .then(res => {
        // res = array [{ jenis: 'PICKUP GI', count: n }, ...]
        const arr = Array.isArray(res) ? res : [];
        const built = JENIS_CONFIG.map(c => {
          const found = arr.find(r => r.jenis === c.key);
          return { ...c, value: parseInt(found?.count) || 0 };
        }).filter(d => d.value > 0);
        const tot = arr.reduce((s, r) => s + (parseInt(r.count) || 0), 0);
        setData(built);
        setTotal(tot);
      })
      .catch(() => { setData([]); setTotal(0); })
      .finally(() => { setLoading(false); onFetchDone?.(); });
  }, [dari, sampai, filterKey]);

  const dateLabel = dari === sampai
    ? formatDateLabel(dari)
    : `${formatDateLabel(dari)} – ${formatDateLabel(sampai)}`;

  const CustomLabel = ({ cx, cy }) => (
    <>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize={22} fontWeight={700} fontFamily="JetBrains Mono, monospace">
        {loading ? '…' : total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--muted)" fontSize={11}>alarm</text>
    </>
  );

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 14px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
        Distribusi per jenis: <span style={{ color: 'var(--accent)' }}>{dateLabel}</span>
      </div>

      {(loading || applying) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div className="skeleton" style={{ width: 160, height: 160, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[70, 50].map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: `${w}%`, height: 12 }} />
                <div className="skeleton" style={{ width: 28, height: 14 }} />
              </div>
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>Tidak ada data pada periode ini</div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={72}
                  paddingAngle={3} dataKey="value"
                  labelLine={false} label={CustomLabel}
                >
                  {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1, paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map(d => (
              <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.name}</span>
                </div>
                <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: d.color }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
