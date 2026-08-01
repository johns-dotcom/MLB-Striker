import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { changeAppPassword, verifyAppPassword } from '../authService.js';

const loginSchema = z.object({ password: z.string().min(1).max(200) }).strict();

/**
 * Public login route. Posts the shared password and receives the API bearer
 * token. Password is checked against the DB-stored hash (set in the app's
 * Settings screen), falling back to the APP_PASSWORD env var.
 */
export async function sessionRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_request' };
    }
    if (!(await verifyAppPassword(parsed.data.password))) {
      reply.code(401);
      return { error: 'invalid_password' };
    }
    return { token: config.apiAuthToken };
  });
}

const changeSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) })
  .strict();

/** Authenticated: change the login password (stored hashed in the DB). */
export async function sessionAuthedRoutes(app: FastifyInstance) {
  app.post('/auth/change-password', async (req, reply) => {
    const parsed = changeSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_request' };
    }
    const result = await changeAppPassword(parsed.data.currentPassword, parsed.data.newPassword);
    if (result.ok) return { ok: true };

    const map = {
      db_required: [503, 'Password changes require the database, which is not configured.'],
      wrong_current: [401, 'Current password is incorrect.'],
      weak_new: [422, 'New password must be at least 6 characters.'],
    } as const;
    const [code, message] = map[result.code];
    reply.code(code);
    return { error: result.code, message };
  });
}
