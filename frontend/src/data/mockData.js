export const GI_LIST = [
  'GI Kaliwungu', 'GI Krapyak', 'GI Pandeanlamper', 'GI Simpanglima',
  'GI Tambaklorok', 'GI Srondol', 'GI Mangkang', 'GI Ungaran',
  'GI Bawen', 'GI Salatiga', 'GI Demak', 'GI Kudus',
  'GI Pati', 'GI Rembang', 'GI Welahan',
];

const FEEDER_TYPES = [
  'Feeder Kaliwungu 1', 'Feeder Kaliwungu 2', 'Feeder Kaliwungu 3',
  'Incoming 150kV', 'Trafo 1 150/20kV', 'Trafo 2 150/20kV',
  'Kopel 20kV', 'Feeder Gondoriyo', 'Feeder Banjardowo',
  'Feeder Tambakaji', 'Feeder Mijen', 'Feeder Ngaliyan',
  'Feeder Tugu', 'Feeder Genuk', 'Feeder Pedurungan',
  'Feeder Tembalang', 'Feeder Banyumanik', 'Feeder Gajah Mungkur',
];

const JENIS = ['PICKUP', 'RNR', 'TCS'];
const STATUS = ['ACTIVE', 'CLEARED'];

const POINT_NAMES = [
  '87T - Differensial Trafo', '51N - Ground Fault', '50/51 - Overcurrent',
  '21 - Distance Protection', '79 - Auto Reclose', 'CB Fail Protection',
  'Under Voltage', 'Over Voltage', 'Frequency Relay', 'Buchholz Relay',
  'Temperatur Winding High', 'Oil Level Low', 'Fire Detection',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTimestamp(hoursAgo) {
  const d = new Date();
  d.setHours(d.getHours() - hoursAgo);
  d.setMinutes(Math.floor(Math.random() * 60));
  d.setSeconds(Math.floor(Math.random() * 60));
  return d.toISOString();
}

// Generate 120 mock alarms
export const mockAlarms = Array.from({ length: 120 }, (_, i) => {
  const jenis = JENIS[Math.floor(Math.random() * JENIS.length)];
  const hoursAgo = Math.random() * 72; // within last 3 days
  return {
    id: i + 1,
    timestamp: generateTimestamp(hoursAgo),
    jenis,
    gi: randomFrom(GI_LIST),
    feeder: randomFrom(FEEDER_TYPES),
    point_name: randomFrom(POINT_NAMES),
    status: Math.random() > 0.35 ? 'ACTIVE' : 'CLEARED',
  };
}).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

// Active alarms for today
export const activeAlarms = mockAlarms.filter(a => a.status === 'ACTIVE').slice(0, 24);

// Summary counts
export const summaryCounts = {
  PICKUP: activeAlarms.filter(a => a.jenis === 'PICKUP').length,
  RNR: activeAlarms.filter(a => a.jenis === 'RNR').length,
  TCS: activeAlarms.filter(a => a.jenis === 'TCS').length,
  TOTAL: activeAlarms.length,
};

// GI bermasalah - aggregate by GI
const giMap = {};
activeAlarms.forEach(alarm => {
  if (!giMap[alarm.gi]) giMap[alarm.gi] = { gi: alarm.gi, PICKUP: 0, RNR: 0, TCS: 0, total: 0 };
  giMap[alarm.gi][alarm.jenis]++;
  giMap[alarm.gi].total++;
});
export const giBermasalah = Object.values(giMap)
  .sort((a, b) => b.total - a.total)
  .slice(0, 8);

// 24h trend data (hourly, grouped every 2h)
export function generate24hTrend() {
  const now = new Date();
  const result = [];
  for (let i = 23; i >= 0; i -= 2) {
    const hour = new Date(now);
    hour.setHours(now.getHours() - i, 0, 0, 0);
    const label = hour.getHours().toString().padStart(2, '0') + ':00';
    result.push({
      time: label,
      PICKUP: Math.floor(Math.random() * 6) + 1,
      RNR: Math.floor(Math.random() * 4),
      TCS: Math.floor(Math.random() * 3),
    });
  }
  return result;
}

export const trendData = generate24hTrend();
