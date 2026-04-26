import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';

function formatDateLabel(isoStr) {
  return new Date(isoStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: p.fill }}>{p.dataKey}</span>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>Total</span>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text)', fontWeight: 700 }}>
            {payload.reduce((s, p) => s + (p.value || 0), 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function BarChartUP3({ dari, sampai, filterKey, applying, onFetchDone }) {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getDashboardUP3({ from: dari, to: sampai })
      .then(res => {
        const arr = Array.isArray(res) ? res : [];
        setData(arr.map(r => ({
          name:        r.nama_up3,
          'PICKUP GI': parseInt(r.pickup_gi) || 0,
          'PICKUP KP': parseInt(r.pickup_kp) || 0,
          'RNR':       parseInt(r.rnr)       || 0,
          'TCS':       parseInt(r.tcs)       || 0,
        })));
      })
      .catch(() => setData([]))
      .finally(() => { setLoading(false); onFetchDone?.(); });
  }, [dari, sampai, filterKey]);

  const dateLabel = new Date(dari + 'T12:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const hasData = data.some(r => r['PICKUP GI'] > 0 || r['PICKUP KP'] > 0 || r['RNR'] > 0 || r['TCS'] > 0);
  const barHeight = Math.max(180, data.length * 36);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 14px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
        Alarm per UP3: <span style={{ color: 'var(--accent)' }}>{dateLabel}</span>
      </div>

      {(loading || applying) ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center', padding: '4px 0' }}>
          {[80, 60, 90, 50, 70].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="skeleton" style={{ width: 80, height: 11, borderRadius: 4, flexShrink: 0 }} />
              <div className="skeleton" style={{ width: `${w}%`, height: 22, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : !hasData ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>Tidak ada data pada periode ini</div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: barHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--dim)', fontSize: 10 }}
                  axisLine={false} tickLine={false} allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'IBM Plex Sans, sans-serif' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
                <Bar dataKey="PICKUP GI" stackId="a" fill="#ef4444" />
                <Bar dataKey="PICKUP KP" stackId="a" fill="#3b82f6" />
                <Bar dataKey="RNR"       stackId="a" fill="#f59e0b" />
                <Bar dataKey="TCS"       stackId="a" fill="#a855f7" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['PICKUP GI', '#ef4444'], ['PICKUP KP', '#3b82f6'], ['RNR', '#f59e0b'], ['TCS', '#a855f7']].map(([name, color]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
