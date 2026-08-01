import { dbEnabled, query } from './pool.js';

/** The stored password hash, or null when unset / DB disabled. */
export async function getStoredPasswordHash(): Promise<string | null> {
  if (!dbEnabled) return null;
  const r = await query<{ password_hash: string }>(
    'SELECT password_hash FROM app_auth WHERE id = 1',
  );
  return r.rows[0]?.password_hash ?? null;
}

export async function storePasswordHash(hash: string): Promise<void> {
  await query(
    `INSERT INTO app_auth (id, password_hash, updated_at)
     VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`,
    [hash],
  );
}
