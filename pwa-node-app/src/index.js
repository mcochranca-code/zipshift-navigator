require('dotenv').config();

const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT || 3000);

if (!databaseUrl) {
  console.error('Missing DATABASE_URL. Copy .env.example to .env and set the CockroachDB Cloud connection string.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: true }
});

const app = express();
app.disable('x-powered-by');

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'pwa_prototype' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

app.get('/api/prototypes', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, slug, description, status, version, created_at, updated_at
      FROM public.pwa_prototypes
      ORDER BY created_at DESC, name ASC;
    `);

    res.json({ data: rows, count: rows.length });
  } catch (error) {
    console.error('Failed to fetch prototypes:', error.message);
    res.status(500).json({ error: 'Unable to fetch PWA prototypes' });
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(port, () => {
  console.log(`PWA prototype dashboard listening at http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; closing server and database pool.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
