import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../db';
import { HttpError, invalid, validate } from '../errors';
import { burnPasswordCheck, hashPassword, issueToken, publicUser, revokeToken, verifyPassword } from '../auth';
import { me, publicEvents, shapePublicEvent, matchesQuery, shapeMatch } from '../lib';
import { PUBLIC_STATUSES } from '../domain/lifecycle';

const email = z.string().trim().toLowerCase().email('Email no válido.').max(190);

export default async function (app: FastifyInstance) {
  app.post('/auth/register', {
    config: { public: true, rateLimit: { max: config.rateLimits.register, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    // Solo se aceptan estos tres campos: `role` o `is_referee` en el body se ignoran.
    const data = validate(z.object({
      name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120),
      email,
      password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200),
    }), req.body);
    if (await db('users').where({ email: data.email }).first()) throw invalid('email', 'Ya existe una cuenta con ese email.');
    const [user] = await db('users').insert({ name: data.name, email: data.email, password_hash: hashPassword(data.password) }).returning('*');
    reply.code(201);
    return { user: publicUser(user), token: await issueToken(user.id) };
  });

  app.post('/auth/login', {
    config: { public: true, rateLimit: { max: config.rateLimits.login, timeWindow: '1 minute' } },
  }, async (req) => {
    const data = validate(z.object({ email, password: z.string().min(1).max(200) }), req.body);
    const user = await db('users').where({ email: data.email }).first();
    const ok = user ? verifyPassword(data.password, user.password_hash) : burnPasswordCheck(data.password) && false;
    // Mensaje genérico: no revela si el email existe.
    if (!ok) throw new HttpError(401, 'Credenciales incorrectas.');
    return { user: publicUser(user), token: await issueToken(user.id) };
  });

  app.post('/auth/logout', async (req, reply) => {
    await revokeToken(req);
    reply.code(204);
  });

  app.get('/me', async (req) => ({ user: publicUser(me(req)) }));

  /** Eventos que organizo (todos los estados, con importe y plazo). */
  app.get('/me/events', async (req) => {
    const rows = await db('events as e').join('cities as c', 'c.id', 'e.city_id')
      .where('e.organizer_id', me(req).id).orderBy('e.created_at', 'desc')
      .select('e.*', 'c.name as city_name', 'c.slug as city_slug',
        db.raw('(select count(*) from registrations r where r.event_id = e.id)::int as teams_count'));
    return { events: rows };
  });

  /** Equipos de los que soy capitán. */
  app.get('/me/teams', async (req) => {
    const teams = await db('teams as t').where('t.captain_id', me(req).id).orderBy('t.name')
      .select('t.*', db.raw('(select count(*) from players p where p.team_id = t.id)::int as players_count'));
    return { teams };
  });

  /** Partidos que tengo asignados como árbitro. */
  app.get('/me/matches', async (req) => {
    const rows = await matchesQuery().join('match_referees as mr', 'mr.match_id', 'm.id')
      .join('events as e', 'e.id', 'm.event_id')
      .where('mr.user_id', me(req).id).where('e.status', 'active')
      .select('e.name as event_name').orderBy('m.scheduled_at');
    return { matches: rows.map((r: any) => ({ ...shapeMatch(r), event_name: r.event_name })) };
  });

  app.get('/me/following', async (req) => {
    const rows = await publicEvents().join('follows as f', 'f.event_id', 'e.id')
      .where('f.user_id', me(req).id).whereIn('e.status', PUBLIC_STATUSES);
    return { events: rows.map(shapePublicEvent) };
  });
}
