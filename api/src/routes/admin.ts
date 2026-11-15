import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../db';
import { idParam, notFound, validate } from '../errors';
import { me } from '../lib';
import { authorize, policies } from '../policies';
import { publicUser } from '../auth';

export default async function (app: FastifyInstance) {
  /** Lista de espera de la landing (público, con límite de peticiones). */
  app.post('/waitlist', {
    config: { public: true, rateLimit: { max: config.rateLimits.waitlist, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const data = validate(z.object({
      name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120),
      email: z.string().trim().toLowerCase().email('Email no válido.').max(190),
      league_name: z.string().trim().max(120).nullable().optional(),
      city: z.string().trim().max(80).nullable().optional(),
      teams_count: z.number().int().min(0).max(10000).nullable().optional(),
    }), req.body);
    // Idempotente: no revela si el email ya estaba apuntado.
    await db('waitlist').insert(data).onConflict('email').ignore();
    reply.code(201);
    return { ok: true };
  });

  app.get('/admin/waitlist', async (req) => {
    authorize(policies.admin(me(req)));
    return { waitlist: await db('waitlist').orderBy('created_at', 'desc') };
  });

  app.get('/admin/users', async (req: any) => {
    authorize(policies.admin(me(req)));
    const q = String(req.query?.q ?? '').replace(/[%_]/g, '').slice(0, 80);
    const query = db('users').orderBy('created_at', 'desc').limit(100);
    if (q) query.where((w) => w.whereILike('email', `%${q}%`).orWhereILike('name', `%${q}%`));
    return { users: (await query).map(publicUser) };
  });

  /** Único sitio donde se cambia el rol de un usuario (p. ej. aprobar a un organizador). */
  app.patch('/admin/users/:id', async (req: any) => {
    authorize(policies.admin(me(req)));
    const data = validate(z.object({ role: z.enum(['user', 'organizer']), is_referee: z.boolean() }).partial(), req.body);
    const user = await db('users').where({ id: idParam(req.params.id) }).first();
    if (!user) throw notFound('Usuario no encontrado.');
    if (!Object.keys(data).length) return { user: publicUser(user) };
    const [updated] = await db('users').where({ id: user.id }).update(data).returning('*');
    return { user: publicUser(updated) };
  });
}
