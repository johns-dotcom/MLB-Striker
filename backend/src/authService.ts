import crypto from 'node:crypto';
import { config } from './config.js';
import { dbEnabled } from './db/pool.js';
import { getStoredPasswordHash, storePasswordHash } from './db/appAuth.js';

// scrypt password hashing — no external deps. Format: scrypt$<saltHex>$<hashHex>.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyHash(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a login password. Prefers the DB-stored hash (set via the app's
 * Settings screen); falls back to the APP_PASSWORD env var when none is stored
 * yet (bootstrap). Passwords are trimmed — mobile keyboards add whitespace.
 */
export async function verifyAppPassword(password: string): Promise<boolean> {
  const pw = password.trim();
  const stored = await getStoredPasswordHash().catch(() => null);
  if (stored) return verifyHash(pw, stored);
  return !!config.appPassword && safeEqual(pw, config.appPassword.trim());
}

export type ChangeResult =
  | { ok: true }
  | { ok: false; code: 'db_required' | 'wrong_current' | 'weak_new' };

/** Change the login password after verifying the current one. Requires the DB. */
export async function changeAppPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangeResult> {
  if (!dbEnabled) return { ok: false, code: 'db_required' };
  if (!(await verifyAppPassword(currentPassword))) return { ok: false, code: 'wrong_current' };
  const next = newPassword.trim();
  if (next.length < 6) return { ok: false, code: 'weak_new' };
  await storePasswordHash(hashPassword(next));
  return { ok: true };
}
