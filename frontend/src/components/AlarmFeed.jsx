import { activeAlarms } from '../data/mockData';

const TYPE_STYLE = {
  PICKUP: { colorVar: 'var(--pickup)', bgHex: 'rgba(239,68,68,0.1)',  borderVar: 'var(--pickup)' },
  RNR:    { colorVar: 'var(--rnr)',    bgHex: 'rgba(59,130,246,0.1)', borderVar: 'var(--rnr)'    },
  TCS:    { colorVar: 'var(--tcs)',    bgHex: 'rgba(168,85,247,0.1)', borderVar: 'var(--tcs)'    },
  EWS:    { colorVar: 'var(--ews)',    bgHex: 'rgba(245,158,11,0.1)', borderVar: 'var(--ews)'    },
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function AlarmFeed({ onItemClick }) {
  const items = activeAlarms.slice(0, 8);

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, margin: '0 0 10px', textTransform: 'uppercase' }}>
        Alarm Terbaru
      </p>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {items.map((alarm, i) => {
          const s = TYPE_STYLE[alarm.jenis] || TYPE_STYLE.PICKUP;
          return (
            <div
              key={alarm.id}
              onClick={() => onItemClick && onItemClick(alarm)}
              style={{
                padding: '10px 14px',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Left colored border indicator */}
              <div style={{
                width: 3,
                height: 36,
                borderRadius: 2,
                background: s.borderVar,
                flexShrink: 0,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alarm.gi}
                  </span>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--dim)', flexShrink: 0, marginLeft: 8 }}>
                    {formatTime(alarm.timestamp)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {alarm.feeder}
                  </span>
                  <span style={{
                    background: s.bgHex,
                    color: s.colorVar,
                    border: `1px solid ${s.colorVar}44`,
                    borderRadius: 5,
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {alarm.jenis}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
