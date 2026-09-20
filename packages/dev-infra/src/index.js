'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');

const INFRA_ROOT = path.resolve(__dirname, '../../../.infra');
const PG_DIR = path.join(INFRA_ROOT, 'pg');
const PID_FILE = path.join(INFRA_ROOT, 'pids.json');
const PG_PORT = Number(process.env.PG_PORT || 5432);
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);

const PG_USER = process.env.PG_USER || 'campusflow';
const PG_PASSWORD = process.env.PG_PASSWORD || 'campusflow';
const PG_DB = process.env.PG_DB || 'campusflow';

const CONNECTION = {
  databaseUrl:
    process.env.DATABASE_URL ||
    `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}`,
  redisUrl: process.env.REDIS_URL || `redis://localhost:${REDIS_PORT}`,
};

function ensureDirs() {
  fs.mkdirSync(INFRA_ROOT, { recursive: true });
  fs.mkdirSync(PG_DIR, { recursive: true });
}

function readPids() {
  try {
    return JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writePids(pids) {
  fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
}

function isPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: host || '127.0.0.1' });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function startPostgres() {
  const existing = readPids();
  if (existing.pg && !(await isPortOpen(PG_PORT))) delete existing.pg;

  let EmbeddedPostgres;
  try {
    ({ default: EmbeddedPostgres } = await import('embedded-postgres'));
  } catch (e) {
    EmbeddedPostgres = require('embedded-postgres');
  }

  const pg = new EmbeddedPostgres({
    databaseDir: PG_DIR,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DB,
    defaultPort: PG_PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    // pg_ctl akan punya waktu cukup untuk bind port di Windows
    pgCtlTimeout: 30000,
  });

  const initialized = fs.existsSync(path.join(PG_DIR, 'PG_VERSION'));
  if (!initialized) {
    await pg.initialise();
  } else {
    console.log('[infra] Cluster PostgreSQL sudah ter-initialize (skip initdb).');
  }
  await pg.start();
  await pg
    .createDatabase(PG_DB)
    .catch((e) => console.log('[infra] DB ' + PG_DB + ' sudah ada:', e.message));
  writePids({ ...readPids(), pg: true, port: PG_PORT });
  console.log(`[infra] PostgreSQL 16 tersedia di ${CONNECTION.databaseUrl}`);
}

async function startRedis() {
  const existing = readPids();
  if (existing.redis && !(await isPortOpen(REDIS_PORT))) delete existing.redis;

  const { RedisMemoryServer } = require('redis-memory-server');
  const server = new RedisMemoryServer({
    instance: { port: REDIS_PORT, ip: '127.0.0.1' },
    autoStart: false,
  });
  process.env.REDISMS_DISABLE_POSTINSTALL = 'true';
  await server.start(true);

  writePids({ ...readPids(), redis: server, port: REDIS_PORT });
  console.log(`[infra] Redis (Memurai) tersedia di ${CONNECTION.redisUrl}`);
}

async function stopAll() {
  console.log('[infra] Menghentikan layanan...');
  const existing = readPids();
  if (existing.redis && typeof existing.redis.stop === 'function') {
    await existing.redis.stop().catch(() => {});
  }
  const { execFileSync } = require('child_process');
  try {
    // hentikan postgres data cluster yang masih jalan
    execFileSync(path.join(PG_DIR, 'bin', 'pg_ctl'), [
      '-D',
      PG_DIR,
      'stop',
      '-m',
      'fast',
    ], { stdio: 'ignore' });
  } catch {
    // sudah berhenti
  }
  writePids({});
  console.log('[infra] Dihentikan.');
}

async function status() {
  const pg = await isPortOpen(PG_PORT);
  const redis = await isPortOpen(REDIS_PORT);
  console.log(`[infra] PostgreSQL :${PG_PORT} -> ${pg ? 'UP' : 'DOWN'}`);
  console.log(`[infra] Redis      :${REDIS_PORT} -> ${redis ? 'UP' : 'DOWN'}`);
  console.log(`DATABASE_URL=${CONNECTION.databaseUrl}`);
  console.log(`REDIS_URL=${CONNECTION.redisUrl}`);
}

async function main() {
  const cmd = process.argv[2] || 'start';
  ensureDirs();

  if (cmd === 'start') {
    if (await isPortOpen(PG_PORT)) {
      console.log('[infra] PostgreSQL sudah jalan di ' + PG_PORT);
    } else {
      await startPostgres();
    }
    if (await isPortOpen(REDIS_PORT)) {
      console.log('[infra] Redis sudah jalan di ' + REDIS_PORT);
    } else {
      await startRedis();
    }
    await status();
    console.log('[infra] Tekan Ctrl+C untuk menghentikan.');
    process.on('SIGINT', async () => {
      await stopAll();
      process.exit(0);
    });
    // jaga proses tetap hidup
    setInterval(() => {}, 1000);
  } else if (cmd === 'stop') {
    await stopAll();
  } else if (cmd === 'status') {
    await status();
  } else {
    console.log('Usage: node index.js <start|stop|status>');
  }
}

main().catch((err) => {
  console.error('[infra] Gagal:', err.message);
  process.exit(1);
});