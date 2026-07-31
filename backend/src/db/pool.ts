import pg from 'pg';
import { config } from '../config.js';

/**
 * A single shared pool, or null when DATABASE_URL is unset (persistence off).
 * Neon requires TLS; `pg` enables it automatically for neon.tech hosts, but we
 * set it explicitly to be safe.
 */
export const pool: pg.Pool | null = config.databaseUrl
  ? new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
      max: 5,
    })
  : null;

export const dbEnabled = pool !== null;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  if (!pool) throw new Error('Database is not configured (DATABASE_URL is empty).');
  return pool.query<T>(text, params as any[]);
}
