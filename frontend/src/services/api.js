const BASE = 'http://localhost:5000/api';

async function get(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const body = await res.json(); if (body.error) msg = body.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function post(path, body = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

async function put(path, body = {}) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

export const api = {
  // Dashboard
  getSummary:           (params = {}) => get('/dashboard/summary',         params),
  getDonut:             (params = {}) => get('/dashboard/donut',           params),
  getTrend:             (params = {}) => get('/dashboard/trend',           params),
  getDashboardGI:       (params = {}) => get('/dashboard/gi-bermasalah',   params),

  // Alarms
  getAlarms:            (params = {}) => get('/alarms',                    params),
  getAlarmDetail:       (id)          => get(`/alarms/${id}`),
  getTerpantau:         (params = {}) => get('/alarms/terpantau',          params),
  ackAlarm:             (body)        => post('/alarms/ack',               body),

  // Laporan
  getLaporanKalender:   (params = {}) => get('/laporan/kalender',          params),
  getLaporanPeralatan:  (params = {}) => get('/laporan/peralatan',         params),

  // Auth
  login:                (body)        => post('/login',                    body),

  // Settings
  getSettings:          ()            => get('/settings'),
  saveSettings:         (body)        => post('/settings',                 body),

  // Scheduler
  getSchedulerStatus:   ()            => get('/scheduler/status'),

  // Ref / filter dropdowns
  getRefGI:             ()            => get('/ref/gi'),
  getRefUp3:            ()            => get('/ref/up3'),
  getRefPointtype:      ()            => get('/ref/pointtype'),

  // DB status
  getDbStatus:          ()            => get('/db-status'),

  // Master Data — Point Status
  getMasterPointStatus: (params = {}) => get('/master/point-status',       params),
  createPointStatus:    (body)        => post('/master/point-status',      body),
  updatePointStatus:    (id, body)    => put(`/master/point-status/${id}`, body),
};
