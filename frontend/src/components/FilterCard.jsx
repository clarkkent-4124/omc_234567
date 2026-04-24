export default function FilterCard({ dari, sampai, setDari, setSampai, onApply, applying }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '14px 14px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Filter Tanggal</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Dari</div>
          <input type="date" value={dari} onChange={e => setDari(e.target.value)} disabled={applying} />
        </div>
        <div style={{ color: 'var(--dim)', fontSize: 16, marginTop: 16, flexShrink: 0 }}>—</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Sampai</div>
          <input type="date" value={sampai} onChange={e => setSampai(e.target.value)} disabled={applying} />
        </div>
      </div>
      <button
        onClick={onApply}
        disabled={applying}
        style={{
          marginTop: 10,
          width: '100%',
          background: applying
            ? 'linear-gradient(135deg, #16a5ba, #2563a8)'
            : 'linear-gradient(135deg, #22d3ee, #3b82f6)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 0',
          color: '#0a0f1a',
          fontWeight: 700,
          fontSize: 13,
          cursor: applying ? 'not-allowed' : 'pointer',
          fontFamily: 'IBM Plex Sans, sans-serif',
          letterSpacing: 0.3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'background 0.2s, opacity 0.2s',
          opacity: applying ? 0.85 : 1,
        }}
      >
        {applying ? (
          <>
            <span className="spinner" />
            Memuat data...
          </>
        ) : (
          'Terapkan'
        )}
      </button>
    </div>
  );
}
