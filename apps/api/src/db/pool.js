import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    const parsed = new URL(databaseUrl);
    const sslMode = parsed.searchParams.get('ssl') || parsed.searchParams.get('sslmode') || '';
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      database: decodeURIComponent((parsed.pathname || '').replace(/^\//, '')),
      ssl: sslMode && sslMode !== 'false' ? { rejectUnauthorized: false } : undefined,
    };
  } catch {
    return null;
  }
}

const fromUrl = parseDatabaseUrl(env.databaseUrl);
const dbConfig = fromUrl || {
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
};

export const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

export async function pingDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
