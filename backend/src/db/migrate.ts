import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, dbEnabled } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!dbEnabled || !pool) {
    console.error('DATABASE_URL is not set — nothing to migrate.');
    process.exit(1);
  }
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ Schema applied.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
