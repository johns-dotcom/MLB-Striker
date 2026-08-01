import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';

const loginSchema = z.object({ password: z.string().min(1).max(200) }).strict();

// Constant-time string comparison (avoids leaking the password via timing).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Public login route. The web app posts the shared password and receives the
 * API bearer token, which it then sends on every subsequent request. Keeps the
 * trade-capable token out of the public web bundle.
 */
export async function sessionRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    if (!config.appPassword) {
      reply.code(503);
      return { error: 'login_not_configured' };
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_request' };
    }
    // Trim both sides — mobile keyboards/autofill often add a trailing space.
    if (!safeEqual(parsed.data.password.trim(), config.appPassword.trim())) {
      reply.code(401);
      return { error: 'invalid_password' };
    }
    return { token: config.apiAuthToken };
  });
}
