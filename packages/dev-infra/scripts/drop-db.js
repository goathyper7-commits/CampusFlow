'use strict';

const { Client } = require('pg');

async function main() {
  const url =
    process.env.DATABASE_URL ||
    'postgresql://campusflow:campusflow@localhost:5432/campusflow';
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');
  await client.end();
  console.log('[drop-db] public schema sudah di-reset.');
}

main().catch((err) => {
  console.error('[drop-db] Gagal:', err.message);
  process.exit(1);
});