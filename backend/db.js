const mysql = require('mysql2/promise');
const sql   = require('mssql');
require('dotenv').config();

// ── MySQL — dashboard OMC ────────────────────────────────────────
const mysqlPool = mysql.createPool({
  host:               process.env.MYSQL_HOST || '127.0.0.1',
  port:               Number(process.env.MYSQL_PORT) || 3306,
  user:               process.env.MYSQL_USER || 'root',
  password:           process.env.MYSQL_PASS || '',
  database:           process.env.MYSQL_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  connectTimeout:     10000,
});

// ── SQL Server — sumber data SCADA/OMC ───────────────────────────
const mssqlConfig = {
  server:   process.env.MSSQL_HOST || '127.0.0.1',
  port:     Number(process.env.MSSQL_PORT) || 1433,
  user:     process.env.MSSQL_USER,
  password: process.env.MSSQL_PASS,
  database: process.env.MSSQL_NAME,
  options: {
    instanceName:        process.env.MSSQL_INSTANCE || undefined,
    encrypt:             false,   // lokal tidak perlu enkripsi
    trustServerCertificate: true,
  },
  pool: {
    max: 10, min: 0, idleTimeoutMillis: 30000,
  },
};

let mssqlPool = null;

async function getMssql() {
  if (!mssqlPool) {
    mssqlPool = await sql.connect(mssqlConfig);
  }
  return mssqlPool;
}

// ── Export ───────────────────────────────────────────────────────
module.exports = {
  // MySQL — pakai seperti sebelumnya: db.mysql.query(...)
  mysql: mysqlPool,

  // SQL Server — pakai: const pool = await db.getMssql(); await pool.request().query(...)
  getMssql,
  sql,   // expose mssql library untuk Request, types, dll
};
