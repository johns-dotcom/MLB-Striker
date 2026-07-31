import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';

/**
 * Minimal bearer-token gate. Every route except /health requires
 * `Authorization: Bearer <API_AUTH_TOKEN>`. Single shared secret for now;
 * swap for per-user auth when the app grows past a single trader.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !timingSafeEqual(token, config.apiAuthToken)) {
    reply.code(401).send({ error: 'unauthorized' });
  }
}

// Constant-time comparison to avoid leaking the token via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
