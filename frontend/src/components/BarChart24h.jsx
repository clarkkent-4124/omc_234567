import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';

function formatDateLabel(isoStr) {
  return new Date(isoStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: p.fill }}>{p.dataKey}</span>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function BarChart24h({ dari, sampai, filterKey, applying, onFetchDone }) {
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getTrend({ from: dari, to: sampai })
      .then(res => {
        // res = array [{ hour: '00:00', pickup_gi: n, pickup_kp: n }]
        const arr = Array.isArray(res) ? res : [];
        setTrendData(arr.map(row => ({
          hour:       row.hour,
          'PICKUP GI': parseInt(row.pickup_gi) || 0,
          'PICKUP KP': parseInt(row.pickup_kp) || 0,
        })));
      })
      .catch(() => setTrendData([]))
      .finally(() => { setLoading(false); onFetchDone?.(); });
  }, [dari, sampai, filterKey]);

  const dateLabel = new Date(dari + 'T12:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 14px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
        Tren Alarm per jam: <span style={{ color: 'var(--accent)' }}>{dateLabel}</span>
      </div>

      {(loading || applying) ? (
        <div style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180, paddingBottom: 4 }}>
            {[60, 80, 45, 100, 70, 55, 90, 40, 75, 85, 50, 65].map((h, i) => (
              <div key={i} className="skeleton" style={{ flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0' }} />
            ))}
          </div>
        </div>
      ) : trendData.every(r => r['PICKUP GI'] === 0 && r['PICKUP KP'] === 0) ? (
        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>Tidak ada data pada periode ini</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trendData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: 'var(--dim)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false} tickLine={false} interval={2}
            />
            <YAxis
              tick={{ fill: 'var(--dim)', fontSize: 10 }}
              axisLine={false} tickLine={false} allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
            <Bar dataKey="PICKUP GI" stackId="a" fill="#ef4444" />
            <Bar dataKey="PICKUP KP" stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center' }}>
        {[['PICKUP GI', '#ef4444'], ['PICKUP KP', '#3b82f6']].map(([name, color]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
