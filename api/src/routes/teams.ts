import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../db';
import { conflict, idParam, invalid, notFound, validate } from '../errors';
import { findEvent, findTeam, me } from '../lib';
import { authorize, policies } from '../policies';

const teamFields = {
  name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(80),
  short_name: z.string().trim().min(2).max(4).toUpperCase().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal, p. ej. #C6F432.'),
};

export default async function (app: FastifyInstance) {
  app.post('/teams', async (req, reply) => {
    const data = validate(z.object({ name: teamFields.name, short_name: teamFields.short_name.optional(), color: teamFields.color.optional() }), req.body);
    // Quien crea el equipo queda como capitán; captain_id nunca se lee del body.
    const [team] = await db('teams').insert({ ...data, captain_id: me(req).id }).returning('*');
    reply.code(201);
    return { team };
  });

  app.patch('/teams/:id', async (req: any) => {
    const team = await findTeam(idParam(req.params.id));
    authorize(policies.manageTeam(me(req), team));
    const data = validate(z.object(teamFields).partial(), req.body);
    if (!Object.keys(data).length) return { team };
    const [updated] = await db('teams').where({ id: team.id }).update(data).returning('*');
    return { team: updated };
  });

  app.post('/teams/:id/players', async (req: any, reply) => {
    const team = await findTeam(idParam(req.params.id));
    authorize(policies.manageTeam(me(req), team));
    const data = validate(z.object({
      first_name: z.string().trim().min(1, 'Obligatorio.').max(60),
      last_name: z.string().trim().min(1, 'Obligatorio.').max(60),
      number: z.number().int().min(0).max(99).nullable().optional(),
    }), req.body);
    const dup = await db('players').where({ team_id: team.id })
      .whereRaw('lower(first_name) = ? and lower(last_name) = ?', [data.first_name.toLowerCase(), data.last_name.toLowerCase()]).first();
    if (dup) throw invalid('last_name', 'Ese jugador ya está en la plantilla.');
    const [player] = await db('players').insert({ ...data, team_id: team.id }).returning('*');
    reply.code(201);
    return { player };
  });

  app.delete('/teams/:id/players/:playerId', async (req: any, reply) => {
    const team = await findTeam(idParam(req.params.id));
    authorize(policies.manageTeam(me(req), team));
    const player = await db('players').where({ id: idParam(req.params.playerId), team_id: team.id }).first();
    if (!player) throw notFound('Jugador no encontrado en este equipo.');
    if (await db('match_events').where({ player_id: player.id }).first()) {
      throw conflict('Este jugador aparece en actas de partidos y no se puede eliminar.');
    }
    await db('players').where({ id: player.id }).delete();
    reply.code(204);
  });

  // ── Inscripciones ──────────────────────────────────────────────────────────
  app.post('/events/:id/registrations', {
    config: { rateLimit: { max: config.rateLimits.registrations, timeWindow: '1 minute' } },
  }, async (req: any, reply) => {
    const event = await findEvent(idParam(req.params.id));
    if (event.status === 'cancelled' || event.status === 'pending_payment') throw notFound('Evento no encontrado.');
    const data = validate(z.object({ team_id: z.number().int().positive() }), req.body);
    const team = await db('teams').where({ id: data.team_id }).first();
    if (!team) throw invalid('team_id', 'Equipo no encontrado.');
    authorize(policies.manageTeam(me(req), team)); // solo el capitán inscribe a su equipo
    if (event.status !== 'registration') throw conflict('La inscripción de este evento está cerrada.');
    if (await db('registrations').where({ event_id: event.id, team_id: team.id }).first()) {
      throw invalid('team_id', 'Este equipo ya está inscrito.');
    }
    const [registration] = await db('registrations').insert({ event_id: event.id, team_id: team.id }).returning('*');
    reply.code(201);
    return { registration };
  });

  app.get('/events/:id/registrations', async (req: any) => {
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    const registrations = await db('registrations as r').join('teams as t', 't.id', 'r.team_id').join('users as u', 'u.id', 't.captain_id')
      .where('r.event_id', event.id).orderBy('r.created_at')
      .select('r.id', 'r.team_id', 'r.paid_to_organizer', 'r.created_at', 't.name as team_name', 't.color as team_color',
        'u.name as captain_name', 'u.email as captain_email',
        db.raw('(select count(*) from players p where p.team_id = t.id)::int as players_count'));
    return { registrations };
  });

  const loadRegistration = async (id: number) => {
    const registration = await db('registrations').where({ id }).first();
    if (!registration) throw notFound('Inscripción no encontrada.');
    const [event, team] = await Promise.all([findEvent(registration.event_id), findTeam(registration.team_id)]);
    return { registration, event, team };
  };

  /** El organizador marca si el equipo le ha pagado (el cobro a equipos es fuera de la app). */
  app.patch('/registrations/:id', async (req: any) => {
    const { registration, event } = await loadRegistration(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    const data = validate(z.object({ paid_to_organizer: z.boolean() }), req.body);
    const [updated] = await db('registrations').where({ id: registration.id }).update(data).returning('*');
    return { registration: updated };
  });

  app.delete('/registrations/:id', async (req: any, reply) => {
    const { registration, event, team } = await loadRegistration(idParam(req.params.id));
    authorize(policies.deleteRegistration(me(req), event, team));
    if (event.status !== 'registration') throw conflict('La inscripción ya está cerrada: no se pueden retirar equipos.');
    await db('registrations').where({ id: registration.id }).delete();
    reply.code(204);
  });
}
