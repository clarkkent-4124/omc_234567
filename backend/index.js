const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config();

// ── Uploads directory ─────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const { mysql: db } = require('./db');
const scheduler = require('./scheduler');
const sync      = require('./sync');
const app       = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Multer: alarm sound (.wav, max 5 MB) ──────────────────────────
const alarmSoundUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, 'alarm.wav'),
  }),
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'audio/wav'
            || file.mimetype === 'audio/wave'
            || file.originalname.toLowerCase().endsWith('.wav');
    ok ? cb(null, true) : cb(new Error('Hanya file .wav yang diizinkan.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Helper: date range ───────────────────────────────────────────
function dateRange(from, to) {
  const params = [];
  let clause = '';
  if (from) { clause += ' AND sp.TIME >= ?'; params.push(from + ' 00:00:00'); }
  if (to)   { clause += ' AND sp.TIME <= ?'; params.push(to   + ' 23:59:59'); }
  return { clause, params };
}

// ── SQL fragment: nama tampilan alarm ─────────────────────────────
// GI Pickup  : GI + SUMBER_FEEDER + INDIKASI + RELAY + PHASE
// KP Pickup  : FEEDER_MURNI + KEYPOINT + INDIKASI + RELAY + PHASE
const POINT_TEXT_SQL = `
  CASE
    WHEN sp.JENIS = 'PICKUP GI' THEN
      TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(sp.GI),''),
        NULLIF(TRIM(sp.SUMBER_FEEDER),''),
        NULLIF(TRIM(sp.INDIKASI),''),
        NULLIF(TRIM(sp.RELAY),''),
        NULLIF(TRIM(sp.PHASE),'')
      ))
    WHEN sp.JENIS IN ('RNR', 'TCS') THEN
      TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(sp.GI),''),
        NULLIF(TRIM(sp.SUMBER_FEEDER),''),
        NULLIF(TRIM(sp.INDIKASI),'')
      ))
    ELSE
      TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(sp.FEEDER_MURNI),''),
        NULLIF(TRIM(sp.KEYPOINT),''),
        NULLIF(TRIM(sp.INDIKASI),''),
        NULLIF(TRIM(sp.RELAY),''),
        NULLIF(TRIM(sp.PHASE),'')
      ))
  END
`;

// ── SQL fragment: path1_text (label GI / feeder utama) ───────────
const PATH1_SQL = `COALESCE(NULLIF(TRIM(sp.GI),''), NULLIF(TRIM(sp.FEEDER_MURNI),''))`;

// ════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════
app.get('/api/ping', async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT NOW() AS time');
    res.json({ message: 'Backend OK', db: 'Connected', time: row.time });
  } catch (err) {
    res.status(500).json({ message: 'DB Error', error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════

// ── GET /api/dashboard/summary ───────────────────────────────────
// Hitung alarm aktif saat ini dari alarm_active
app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sp.JENIS AS jenis, COUNT(*) AS cnt
      FROM alarm_active aa
      JOIN sync_prtspl sp ON sp.PKEY = aa.pkey
      WHERE sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')
      GROUP BY sp.JENIS
    `);

    const result = { pickup_gi: 0, pickup_kp: 0, rnr: 0, tcs: 0, total: 0 };
    rows.forEach(r => {
      if (r.jenis === 'PICKUP GI') result.pickup_gi = r.cnt;
      if (r.jenis === 'PICKUP KP') result.pickup_kp = r.cnt;
      if (r.jenis === 'RNR')       result.rnr       = r.cnt;
      if (r.jenis === 'TCS')       result.tcs       = r.cnt;
    });
    result.total = result.pickup_gi + result.pickup_kp + result.rnr + result.tcs;

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/trend ─────────────────────────────────────
// Alarm per jam — hanya yang sudah divalidasi operator (alarm_ack valid)
app.get('/api/dashboard/trend', async (req, res) => {
  try {
    const { from, to } = req.query;
    const { clause, params } = dateRange(from, to);

    const [rows] = await db.query(`
      SELECT
        HOUR(sp.TIME) AS hour_num,
        SUM(CASE WHEN sp.JENIS = 'PICKUP GI' THEN 1 ELSE 0 END) AS pickup_gi,
        SUM(CASE WHEN sp.JENIS = 'PICKUP KP' THEN 1 ELSE 0 END) AS pickup_kp
      FROM sync_prtspl sp
      INNER JOIN alarm_ack aa ON aa.pkey = sp.PKEY AND aa.kesimpulan = 'valid'
      WHERE sp.KESIMPULAN = 'App'
        AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP')
        ${clause}
      GROUP BY HOUR(sp.TIME)
      ORDER BY hour_num ASC
    `, [...params]);

    const map = {};
    rows.forEach(r => { map[r.hour_num] = r; });

    const data = Array.from({ length: 24 }, (_, h) => ({
      hour:      `${String(h).padStart(2, '0')}:00`,
      pickup_gi: map[h]?.pickup_gi ?? 0,
      pickup_kp: map[h]?.pickup_kp ?? 0,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/donut ─────────────────────────────────────
app.get('/api/dashboard/donut', async (req, res) => {
  try {
    const { from, to } = req.query;
    const { clause, params } = dateRange(from, to);

    const [rows] = await db.query(`
      SELECT sp.JENIS AS jenis, COUNT(*) AS count
      FROM sync_prtspl sp
      INNER JOIN alarm_ack aa ON aa.pkey = sp.PKEY AND aa.kesimpulan = 'valid'
      WHERE sp.KESIMPULAN = 'App'
        AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')
        ${clause}
      GROUP BY sp.JENIS
    `, [...params]);

    res.json(rows.map(r => ({ jenis: r.jenis, count: r.count })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/up3 ───────────────────────────────────────
app.get('/api/dashboard/up3', async (req, res) => {
  try {
    const { from, to } = req.query;
    const { clause, params } = dateRange(from, to);

    const [rows] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(da.APJ_NAMA),''), '—') AS nama_up3,
        COUNT(*)                                       AS total,
        SUM(CASE WHEN sp.JENIS = 'PICKUP GI' THEN 1 ELSE 0 END) AS pickup_gi,
        SUM(CASE WHEN sp.JENIS = 'PICKUP KP' THEN 1 ELSE 0 END) AS pickup_kp,
        SUM(CASE WHEN sp.JENIS = 'RNR'       THEN 1 ELSE 0 END) AS rnr,
        SUM(CASE WHEN sp.JENIS = 'TCS'       THEN 1 ELSE 0 END) AS tcs
      FROM sync_prtspl sp
      INNER JOIN alarm_ack aa ON aa.pkey = sp.PKEY AND aa.kesimpulan = 'valid'
      LEFT JOIN dc_apj da ON da.APJ_ID = sp.ID_UP3
      WHERE sp.KESIMPULAN = 'App'
        AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')
        ${clause}
      GROUP BY da.APJ_ID, da.APJ_NAMA
      ORDER BY total DESC
    `, [...params]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/gi-bermasalah ─────────────────────────────
app.get('/api/dashboard/gi-bermasalah', async (req, res) => {
  try {
    const { from, to } = req.query;
    const { clause, params } = dateRange(from, to);

    const [rows] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(sp.GI),''), NULLIF(TRIM(sp.FEEDER_MURNI),''), '—') AS nama_gi,
        COUNT(*)                                                                  AS total,
        SUM(CASE WHEN sp.JENIS = 'PICKUP GI' THEN 1 ELSE 0 END)                AS pickup_gi,
        SUM(CASE WHEN sp.JENIS = 'PICKUP KP' THEN 1 ELSE 0 END)                AS pickup_kp,
        SUM(CASE WHEN sp.JENIS = 'RNR'       THEN 1 ELSE 0 END)                AS rnr,
        SUM(CASE WHEN sp.JENIS = 'TCS'       THEN 1 ELSE 0 END)                AS tcs
      FROM sync_prtspl sp
      INNER JOIN alarm_ack aa ON aa.pkey = sp.PKEY AND aa.kesimpulan = 'valid'
      WHERE sp.KESIMPULAN = 'App'
        AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')
        ${clause}
      GROUP BY COALESCE(NULLIF(TRIM(sp.GI),''), NULLIF(TRIM(sp.FEEDER_MURNI),''))
      ORDER BY total DESC
    `, [...params]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// ALARM LIST
// ════════════════════════════════════════════════════════════════

// ── GET /api/alarms/history ──────────────────────────────────────
// History semua alarm dari sync_prtspl (KESIMPULAN='App')
// Sumber permanen — tidak hilang meski sudah cleared dari alarm_active
app.get('/api/alarms/history', async (req, res) => {
  try {
    const { from, to, jenis, gi, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = `WHERE sp.KESIMPULAN = 'App' AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')`;
    const params = [];

    if (from)   { where += ' AND sp.TIME >= ?'; params.push(from + ' 00:00:00'); }
    if (to)     { where += ' AND sp.TIME <= ?'; params.push(to   + ' 23:59:59'); }
    if (jenis && ['PICKUP GI', 'PICKUP KP', 'RNR', 'TCS'].includes(jenis)) {
      where += ' AND sp.JENIS = ?'; params.push(jenis);
    }
    if (gi)     { where += ' AND sp.GI = ?'; params.push(gi); }
    if (search) {
      where += ' AND (sp.GI LIKE ? OR sp.FEEDER_MURNI LIKE ? OR sp.KEYPOINT LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const base = `
      FROM sync_prtspl sp
      LEFT JOIN alarm_active aa_a ON aa_a.pkey = sp.PKEY
      LEFT JOIN alarm_ack    aa_k ON aa_k.pkey = sp.PKEY
      ${where}
    `;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`, params);

    const [rows] = await db.query(`
      SELECT
        sp.PKEY                               AS id,
        sp.TIME                               AS datum_2,
        sp.JENIS                              AS jenis,
        ${PATH1_SQL}                          AS path1_text,
        ${POINT_TEXT_SQL}                     AS point_text,
        sp.GI, sp.SUMBER_FEEDER, sp.FEEDER_MURNI,
        sp.KEYPOINT, sp.INDIKASI, sp.RELAY, sp.PHASE,
        sp.POINT_KEY,
        CASE WHEN aa_a.id IS NOT NULL THEN 'ACTIVE' ELSE 'CLEARED' END AS status,
        aa_a.ack_at, aa_a.ack_by,
        aa_k.kesimpulan,
        aa_k.catatan                          AS keterangan,
        TIMESTAMPDIFF(SECOND, sp.TIME, NOW()) AS durasi_detik
      ${base}
      ORDER BY sp.PKEY DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      data:       rows,
      total:      parseInt(total),
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages: Math.ceil(parseInt(total) / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/alarms ──────────────────────────────────────────────
// Alarm aktif dari alarm_active (tab Live)
app.get('/api/alarms', async (req, res) => {
  try {
    const { jenis, gi, search, limit = 500 } = req.query;

    const ALL_JENIS_SQL = `'PICKUP GI', 'PICKUP KP', 'RNR', 'TCS'`;
    let where = `WHERE sp.JENIS IN (${ALL_JENIS_SQL})`;
    const params = [];

    if (jenis && ['PICKUP GI', 'PICKUP KP', 'RNR', 'TCS'].includes(jenis)) {
      where += ` AND sp.JENIS = ?`; params.push(jenis);
    }
    if (gi)     { where += ' AND sp.GI = ?';     params.push(gi); }
    if (search) {
      where += ' AND (sp.GI LIKE ? OR sp.FEEDER_MURNI LIKE ? OR sp.KEYPOINT LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const [rows] = await db.query(`
      SELECT
        sp.PKEY                              AS id,
        sp.TIME                              AS datum_2,
        sp.JENIS                             AS jenis,
        ${PATH1_SQL}                         AS path1_text,
        ${POINT_TEXT_SQL}                    AS point_text,
        sp.GI, sp.SUMBER_FEEDER, sp.FEEDER_MURNI,
        sp.KEYPOINT, sp.INDIKASI, sp.RELAY, sp.PHASE,
        sp.POINT_KEY, sp.POINTPID,
        da.APJ_NAMA,
        'ACTIVE'                             AS status,
        aa_k.ack_at,
        aa_k.ack_by,
        aa_k.kesimpulan,
        aa_k.catatan                         AS keterangan,
        TIMESTAMPDIFF(SECOND, sp.TIME, NOW()) AS durasi_detik
      FROM alarm_active aa_a
      JOIN sync_prtspl sp ON sp.PKEY = aa_a.pkey
      LEFT JOIN alarm_ack aa_k ON aa_k.pkey = sp.PKEY
      LEFT JOIN dc_apj da ON da.APJ_ID = sp.ID_UP3
      ${where}
      ORDER BY sp.TIME DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    res.json({ data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/alarms/terpantau ─────────────────────────────────────
// ?kesimpulan=valid   → tab Responded
// ?kesimpulan=invalid → tab Invalid
app.get('/api/alarms/terpantau', async (req, res) => {
  try {
    const { from, to, jenis, gi, kesimpulan } = req.query;

    let sql = `
      SELECT
        sp.PKEY                              AS id,
        sp.TIME                              AS datum_2,
        sp.JENIS                             AS jenis,
        ${PATH1_SQL}                         AS path1_text,
        ${POINT_TEXT_SQL}                    AS point_text,
        sp.GI, sp.SUMBER_FEEDER, sp.FEEDER_MURNI,
        sp.KEYPOINT, sp.INDIKASI, sp.RELAY, sp.PHASE,
        TIMESTAMPDIFF(SECOND, sp.TIME, NOW()) AS durasi_detik,
        aa.ack_at, aa.ack_by,
        aa.kesimpulan,
        aa.catatan                           AS keterangan
      FROM sync_prtspl sp
      JOIN alarm_ack aa ON aa.pkey = sp.PKEY
      WHERE sp.KESIMPULAN = 'App'
        AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')
    `;
    const params = [];

    if (kesimpulan === 'valid' || kesimpulan === 'invalid') {
      sql += ' AND aa.kesimpulan = ?'; params.push(kesimpulan);
    }
    if (from) { sql += ' AND aa.ack_at >= ?'; params.push(from + ' 00:00:00'); }
    if (to)   { sql += ' AND aa.ack_at <= ?'; params.push(to   + ' 23:59:59'); }
    if (jenis && ['PICKUP GI', 'PICKUP KP', 'RNR', 'TCS'].includes(jenis)) {
      sql += ' AND sp.JENIS = ?'; params.push(jenis);
    }
    if (gi)   { sql += ' AND sp.GI = ?'; params.push(gi); }

    sql += ' ORDER BY aa.ack_at DESC';

    const [rows] = await db.query(sql, params);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/alarms/:id ──────────────────────────────────────────
app.get('/api/alarms/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [[alarm]] = await db.query(`
      SELECT
        sp.PKEY                              AS id,
        sp.TIME                              AS datum_2,
        sp.DESC                              AS deskripsi,
        sp.JENIS                             AS jenis,
        ${PATH1_SQL}                         AS path1_text,
        ${POINT_TEXT_SQL}                    AS point_text,
        sp.GI, sp.SUMBER_FEEDER, sp.FEEDER_MURNI,
        sp.KEYPOINT, sp.INDIKASI, sp.RELAY, sp.PHASE,
        sp.KESIMPULAN, sp.POINT_KEY, sp.POINTPID,
        da.APJ_NAMA,
        CASE WHEN aa_a.id IS NOT NULL THEN 'ACTIVE' ELSE 'CLEARED' END AS status,
        aa_a.status                          AS alarm_status,
        aa_k.ack_at, aa_k.ack_by,
        aa_k.kesimpulan,
        aa_k.catatan                         AS keterangan,
        TIMESTAMPDIFF(SECOND, sp.TIME, NOW()) AS durasi_detik
      FROM sync_prtspl sp
      LEFT JOIN alarm_active aa_a ON aa_a.pkey = sp.PKEY
      LEFT JOIN alarm_ack aa_k ON aa_k.pkey = sp.PKEY
      LEFT JOIN dc_apj da ON da.APJ_ID = sp.ID_UP3
      WHERE sp.PKEY = ?
    `, [id]);

    if (!alarm) return res.status(404).json({ error: 'Alarm tidak ditemukan.' });

    // Riwayat: event lain pada POINTPID yang sama (fallback ke POINT_KEY)
    // Gunakan POINTPID jika alarm punya POINTPID, supaya riwayat akurat per titik SCADA
    const usePointpid = alarm.POINTPID && alarm.POINTPID.trim() !== '';
    const [riwayat] = await db.query(
      usePointpid
        ? `SELECT sp.PKEY AS id, sp.TIME AS datum_2, sp.KESIMPULAN,
                  sp.INDIKASI, sp.RELAY, sp.PHASE
           FROM sync_prtspl sp
           WHERE sp.POINTPID = ? AND sp.PKEY != ?
           ORDER BY sp.PKEY DESC LIMIT 20`
        : `SELECT sp.PKEY AS id, sp.TIME AS datum_2, sp.KESIMPULAN,
                  sp.INDIKASI, sp.RELAY, sp.PHASE
           FROM sync_prtspl sp
           WHERE sp.POINT_KEY = ? AND sp.PKEY != ?
           ORDER BY sp.PKEY DESC LIMIT 20`,
      usePointpid ? [alarm.POINTPID, id] : [alarm.POINT_KEY, id]
    );

    res.json({ alarm, riwayat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });

    const [rows] = await db.query(
      'SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Username atau password salah.' });

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Username atau password salah.' });

    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/alarms/ack ──────────────────────────────────────────
// Body: { pkey, ack_by, kesimpulan: 'valid'|'invalid', keterangan }
app.post('/api/alarms/ack', async (req, res) => {
  try {
    const { pkey, ack_by, kesimpulan, keterangan } = req.body;

    if (!pkey || !ack_by)
      return res.status(400).json({ error: 'Data tidak lengkap.' });
    if (!kesimpulan || !['valid', 'invalid'].includes(kesimpulan))
      return res.status(400).json({ error: 'Kesimpulan wajib diisi (valid / invalid).' });
    if (!keterangan || !keterangan.trim())
      return res.status(400).json({ error: 'Keterangan wajib diisi.' });

    // 1. Simpan ke alarm_ack — record permanen, tidak pernah dihapus
    await db.query(
      `INSERT INTO alarm_ack (pkey, ack_by, kesimpulan, catatan)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ack_by     = VALUES(ack_by),
         kesimpulan = VALUES(kesimpulan),
         catatan    = VALUES(catatan),
         ack_at     = NOW()`,
      [pkey, ack_by, kesimpulan, keterangan.trim()]
    );

    // 2. Hapus dari alarm_active — alarm sudah ditangani operator
    //    point_key bebas untuk trigger alarm baru jika relay pickup lagi
    await db.query(
      `DELETE FROM alarm_active WHERE pkey = ?`,
      [pkey]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// LAPORAN
// ════════════════════════════════════════════════════════════════

// ── GET /api/laporan/kalender ─────────────────────────────────────
app.get('/api/laporan/kalender', async (req, res) => {
  try {
    const { bulan, jenis, gi } = req.query;
    const [tahun, bln] = (bulan || '').split('-');
    if (!tahun || !bln) return res.status(400).json({ error: 'Parameter bulan wajib (format: YYYY-MM)' });

    let where = `
      WHERE sp.KESIMPULAN = 'App'
        AND YEAR(sp.TIME) = ? AND MONTH(sp.TIME) = ?
        AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')
    `;
    const params = [parseInt(tahun), parseInt(bln)];

    if (jenis && ['PICKUP GI', 'PICKUP KP', 'RNR', 'TCS'].includes(jenis)) {
      where += ' AND sp.JENIS = ?'; params.push(jenis);
    }
    if (gi) { where += ' AND sp.GI = ?'; params.push(gi); }

    const KALENDER_POINT_SQL = `
      CASE
        WHEN sp.JENIS = 'PICKUP GI' THEN
          TRIM(CONCAT_WS(' ',
            NULLIF(TRIM(sp.GI),''),
            NULLIF(TRIM(sp.SUMBER_FEEDER),''),
            NULLIF(TRIM(sp.RELAY),'')
          ))
        WHEN sp.JENIS IN ('RNR', 'TCS') THEN
          TRIM(CONCAT_WS(' ',
            NULLIF(TRIM(sp.GI),''),
            NULLIF(TRIM(sp.SUMBER_FEEDER),''),
            NULLIF(TRIM(sp.INDIKASI),'')
          ))
        ELSE
          TRIM(CONCAT_WS(' ',
            NULLIF(TRIM(sp.KEYPOINT),''),
            NULLIF(TRIM(sp.INDIKASI),'')
          ))
      END
    `;
    const [rows] = await db.query(`
      SELECT
        ${KALENDER_POINT_SQL}                                      AS peralatan,
        COALESCE(NULLIF(TRIM(sp.GI),''), NULLIF(TRIM(sp.FEEDER_MURNI),''), '—') AS gi_name,
        DAY(sp.TIME)                                              AS hari,
        COUNT(*)                                                   AS jumlah
      FROM sync_prtspl sp
      INNER JOIN alarm_ack aa ON aa.pkey = sp.PKEY AND aa.kesimpulan = 'valid'
      ${where}
      GROUP BY ${KALENDER_POINT_SQL}, gi_name, DAY(sp.TIME)
      ORDER BY peralatan, hari
    `, params);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/laporan/peralatan ────────────────────────────────────
app.get('/api/laporan/peralatan', async (req, res) => {
  try {
    const { bulan, jenis } = req.query;
    const [tahun, bln] = (bulan || '').split('-');
    if (!tahun || !bln) return res.status(400).json({ error: 'Parameter bulan wajib (format: YYYY-MM)' });

    let where = `
      WHERE sp.KESIMPULAN = 'App'
        AND YEAR(sp.TIME) = ? AND MONTH(sp.TIME) = ?
        AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')
    `;
    const params = [parseInt(tahun), parseInt(bln)];

    if (jenis && ['PICKUP GI', 'PICKUP KP', 'RNR', 'TCS'].includes(jenis)) {
      where += ' AND sp.JENIS = ?'; params.push(jenis);
    }

    const [rows] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(sp.GI),''), NULLIF(TRIM(sp.FEEDER_MURNI),''), '—') AS nama_gi,
        COUNT(*)                                                                  AS jumlah,
        COUNT(DISTINCT sp.POINT_KEY)                                              AS jumlah_peralatan
      FROM sync_prtspl sp
      INNER JOIN alarm_ack aa ON aa.pkey = sp.PKEY AND aa.kesimpulan = 'valid'
      ${where}
      GROUP BY COALESCE(NULLIF(TRIM(sp.GI),''), NULLIF(TRIM(sp.FEEDER_MURNI),''))
      ORDER BY jumlah DESC
    `, params);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════
app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
    const result = {};
    rows.forEach(r => { result[r.setting_key] = r.setting_value; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const ALLOWED = ['trigger_duration', 'trigger_duration_enabled', 'scheduler_interval', 'sync_interval', 'scheduler_enabled', 'cleanup_enabled', 'sla_warning', 'sla_breach'];
    const entries = Object.entries(req.body).filter(([k]) => ALLOWED.includes(k));
    if (entries.length === 0) return res.status(400).json({ error: 'Data tidak lengkap.' });

    for (const [key, value] of entries) {
      await db.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, String(value), String(value)]
      );
    }

    scheduler.start().catch(err => console.error('[API] Gagal restart scheduler:', err.message));
    sync.start().catch(err => console.error('[API] Gagal restart sync:', err.message));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/scheduler/status ────────────────────────────────────
app.get('/api/scheduler/status', (req, res) => {
  res.json(scheduler.getStatus());
});

// ── GET /api/sync/status ─────────────────────────────────────────
app.get('/api/sync/status', (req, res) => {
  res.json(sync.getStatus());
});

// ── GET /api/db-status ───────────────────────────────────────────
app.get('/api/db-status', async (req, res) => {
  require('dotenv').config({ override: true });

  const mysql2   = require('mysql2/promise');
  const mssqlLib = require('mssql');

  let mysqlResult = { ok: false, latency: null, error: null };
  let mysqlConn;
  try {
    const t0 = Date.now();
    mysqlConn = await mysql2.createConnection({
      host:           process.env.MYSQL_HOST || '127.0.0.1',
      port:           Number(process.env.MYSQL_PORT) || 3306,
      user:           process.env.MYSQL_USER,
      password:       process.env.MYSQL_PASS,
      database:       process.env.MYSQL_NAME,
      connectTimeout: 5000,
    });
    await mysqlConn.query('SELECT 1');
    mysqlResult = { ok: true, latency: Date.now() - t0, error: null };
  } catch (err) {
    mysqlResult.error = err.message;
  } finally {
    if (mysqlConn) mysqlConn.destroy();
  }

  let mssqlResult = { ok: false, latency: null, error: null };
  let mssqlConn;
  try {
    const t0 = Date.now();
    mssqlConn = await mssqlLib.connect({
      server:   process.env.MSSQL_HOST || '127.0.0.1',
      port:     Number(process.env.MSSQL_PORT) || 1433,
      user:     process.env.MSSQL_USER,
      password: process.env.MSSQL_PASS,
      database: process.env.MSSQL_NAME,
      options: {
        instanceName:           process.env.MSSQL_INSTANCE || undefined,
        encrypt:                false,
        trustServerCertificate: true,
        connectTimeout:         5000,
      },
    });
    await mssqlConn.request().query('SELECT 1 AS ok');
    mssqlResult = { ok: true, latency: Date.now() - t0, error: null };
  } catch (err) {
    mssqlResult.error = err.message;
  } finally {
    if (mssqlConn) await mssqlConn.close().catch(() => {});
  }

  res.json({ mysql: mysqlResult, mssql: mssqlResult, checkedAt: new Date() });
});

// ════════════════════════════════════════════════════════════════
// REF / FILTER DROPDOWNS
// ════════════════════════════════════════════════════════════════

// ── GET /api/ref/gi ──────────────────────────────────────────────
app.get('/api/ref/gi', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT TRIM(GI) AS nama
      FROM sync_prtspl
      WHERE GI IS NOT NULL AND TRIM(GI) != ''
        AND JENIS IN ('PICKUP GI', 'PICKUP KP')
      ORDER BY nama
    `);
    res.json(rows.map(r => r.nama));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ref/up3 ─────────────────────────────────────────────
app.get('/api/ref/up3', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT APJ_ID, APJ_NAMA FROM dc_apj ORDER BY APJ_NAMA'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ref/pointtype ───────────────────────────────────────
app.get('/api/ref/pointtype', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id_pointtype, pointtype FROM ref_pointtype ORDER BY pointtype'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// MASTER DATA — POINT STATUS
// ════════════════════════════════════════════════════════════════

// ── GET /api/master/point-status ─────────────────────────────────
app.get('/api/master/point-status', async (req, res) => {
  try {
    const {
      point_name, path1, id_up3, id_pointtype,
      page = 1, limit = 20,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE 1=1';
    const params = [];

    if (point_name)    { where += ' AND ps.point_name LIKE ?';   params.push(`%${point_name}%`); }
    if (path1)         { where += ' AND ps.path1_text LIKE ?';   params.push(`%${path1}%`); }
    if (id_up3)        { where += ' AND ps.id_up3 = ?';          params.push(id_up3); }
    if (id_pointtype)  { where += ' AND ps.id_pointtype = ?';    params.push(id_pointtype); }

    const base = `
      FROM point_status ps
      LEFT JOIN dc_apj da ON da.APJ_ID = ps.id_up3
      LEFT JOIN ref_pointtype rp ON rp.id_pointtype = ps.id_pointtype
      ${where}
    `;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`, params);

    const [rows] = await db.query(`
      SELECT
        ps.id,
        ps.point_number,
        ps.point_name,
        ps.point_text,
        ps.path1,
        ps.path1_text,
        ps.path3,
        ps.path3_text,
        ps.id_pointtype,
        ps.id_up3,
        ps.id_ulp,
        ps.is_active,
        ps.created_at,
        ps.updated_at,
        da.APJ_NAMA AS up3_nama,
        rp.pointtype
      ${base}
      ORDER BY ps.point_name ASC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      data:       rows,
      total:      parseInt(total),
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages: Math.ceil(parseInt(total) / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/master/point-status ────────────────────────────────
app.post('/api/master/point-status', async (req, res) => {
  try {
    const {
      point_number, point_name, point_text,
      path1, path1_text, path3, path3_text,
      id_pointtype, id_up3, id_ulp, is_active,
    } = req.body;

    if (!point_number) return res.status(400).json({ error: 'Point number wajib diisi.' });

    await db.query(`
      INSERT INTO point_status
        (point_number, point_name, point_text, path1, path1_text, path3, path3_text,
         id_pointtype, id_up3, id_ulp, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      point_number,
      point_name   || null,
      point_text   || null,
      path1        || null,
      path1_text   || null,
      path3        || null,
      path3_text   || null,
      id_pointtype || null,
      id_up3       || null,
      id_ulp       || null,
      is_active != null ? Number(is_active) : 1,
    ]);

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Point number sudah ada.' });
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/master/point-status/:id ─────────────────────────────
app.put('/api/master/point-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      point_name, point_text,
      path1, path1_text, path3, path3_text,
      id_pointtype, id_up3, id_ulp, is_active,
    } = req.body;

    const [result] = await db.query(`
      UPDATE point_status
      SET point_name   = ?,
          point_text   = ?,
          path1        = ?,
          path1_text   = ?,
          path3        = ?,
          path3_text   = ?,
          id_pointtype = ?,
          id_up3       = ?,
          id_ulp       = ?,
          is_active    = ?,
          updated_at   = NOW()
      WHERE id = ?
    `, [
      point_name   || null,
      point_text   || null,
      path1        || null,
      path1_text   || null,
      path3        || null,
      path3_text   || null,
      id_pointtype || null,
      id_up3       || null,
      id_ulp       || null,
      is_active != null ? Number(is_active) : 1,
      id,
    ]);

    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Data tidak ditemukan.' });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// ALARM SOUND UPLOAD
// ════════════════════════════════════════════════════════════════
app.post('/api/upload/alarm-sound', alarmSoundUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
  res.json({ success: true });
});

app.get('/api/upload/alarm-sound/check', (req, res) => {
  res.json({ exists: fs.existsSync(path.join(UPLOADS_DIR, 'alarm.wav')) });
});

app.delete('/api/upload/alarm-sound', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, 'alarm.wav');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File tidak ada.' });
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// IMPORT EXCEL — POST /api/import/prtspl
// ════════════════════════════════════════════════════════════════
app.post('/api/import/prtspl', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: 'Data kosong.' });

    const { parseDesc } = require('./sync');

    // Gunakan PKEY negatif agar tidak tabrakan dengan data SQL Server (selalu positif)
    const [[{ minPkey }]] = await db.query('SELECT COALESCE(MIN(PKEY), 0) AS minPkey FROM sync_prtspl');
    let pkey = Math.min(0, minPkey) - 1;

    let inserted = 0, skipped = 0;

    for (const row of rows) {
      if (!row.TIME || !row.DESC) { skipped++; continue; }
      const parsed = parseDesc(String(row.DESC));
      if (!parsed.KESIMPULAN) { skipped++; continue; }

      try {
        await db.query(
          `INSERT IGNORE INTO sync_prtspl
             (PKEY, TIME, \`DESC\`, JENIS, GI, SUMBER_FEEDER, FEEDER_MURNI,
              KEYPOINT, INDIKASI, RELAY, PHASE, KESIMPULAN, POINT_KEY)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pkey--, row.TIME, row.DESC,
            parsed.JENIS, parsed.GI, parsed.SUMBER_FEEDER, parsed.FEEDER_MURNI,
            parsed.KEYPOINT, parsed.INDIKASI, parsed.RELAY, parsed.PHASE,
            parsed.KESIMPULAN, parsed.POINT_KEY,
          ]
        );
        inserted++;
      } catch { skipped++; }
    }

    res.json({ success: true, inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  sync.start();        // SQL Server → MySQL sync_prtspl
  scheduler.start();   // sync_prtspl → alarm_active
});
