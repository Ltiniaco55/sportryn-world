import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { conflict, idParam, invalid, notFound, validate } from '../errors';
import { findEvent, findMatchWithEvent, matchesQuery, me, shapeMatch } from '../lib';
import { authorize, policies } from '../policies';
import { canClose, canEdit, canReopen, MATCH_EVENT_TYPES, MAX_MINUTE, scoreFromEvents } from '../domain/report';

const venueFields = {
  name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120),
  address: z.string().trim().max(200).nullable(),
  lat: z.number().min(-90, 'Latitud fuera de rango.').max(90, 'Latitud fuera de rango.'),
  lng: z.number().min(-180, 'Longitud fuera de rango.').max(180, 'Longitud fuera de rango.'),
};
const when = z.string().datetime({ offset: true, message: 'Fecha y hora en formato ISO 8601.' });

export default async function (app: FastifyInstance) {
  // ── Sedes ──────────────────────────────────────────────────────────────────
  app.get('/venues', async (req: any) => {
    authorize(policies.actAsOrganizer(me(req)));
    const q = validate(z.object({ city_id: z.coerce.number().int().positive().optional() }), req.query);
    const query = db('venues').orderBy('name').limit(500);
    if (q.city_id) query.where({ city_id: q.city_id });
    return { venues: await query };
  });

  app.post('/venues', async (req, reply) => {
    authorize(policies.actAsOrganizer(me(req)));
    const data = validate(z.object({ ...venueFields, address: venueFields.address.optional(), city_id: z.number().int().positive() }), req.body);
    if (!(await db('cities').where({ id: data.city_id, is_active: true }).first())) throw invalid('city_id', 'Ciudad no disponible.');
    const [venue] = await db('venues').insert({ ...data, created_by: me(req).id }).returning('*');
    reply.code(201);
    return { venue };
  });

  app.patch('/venues/:id', async (req: any) => {
    const venue = await db('venues').where({ id: idParam(req.params.id) }).first();
    if (!venue) throw notFound('Sede no encontrada.');
    authorize(policies.manageVenue(me(req), venue));
    const data = validate(z.object(venueFields).partial(), req.body);
    if (!Object.keys(data).length) return { venue };
    const [updated] = await db('venues').where({ id: venue.id }).update(data).returning('*');
    return { venue: updated };
  });

  // ── Calendario ─────────────────────────────────────────────────────────────
  app.post('/events/:id/matches', async (req: any, reply) => {
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (event.status !== 'active') throw conflict('El calendario se desbloquea cuando el evento está activo (pagado).');
    const data = validate(z.object({
      home_team_id: z.number().int().positive(), away_team_id: z.number().int().positive(),
      venue_id: z.number().int().positive().nullable().optional(),
      scheduled_at: when, round: z.number().int().min(1).max(999).nullable().optional(),
    }), req.body);
    if (data.home_team_id === data.away_team_id) throw invalid('away_team_id', 'Local y visitante deben ser equipos distintos.');
    const registered = await db('registrations').where({ event_id: event.id }).whereIn('team_id', [data.home_team_id, data.away_team_id]).pluck('team_id');
    if (!registered.includes(data.home_team_id)) throw invalid('home_team_id', 'El equipo local no está inscrito en este evento.');
    if (!registered.includes(data.away_team_id)) throw invalid('away_team_id', 'El equipo visitante no está inscrito en este evento.');
    if (data.venue_id && !(await db('venues').where({ id: data.venue_id }).first())) throw invalid('venue_id', 'Sede no encontrada.');
    const [match] = await db('matches').insert({ ...data, event_id: event.id }).returning('*');
    reply.code(201);
    return { match };
  });

  app.patch('/matches/:id', async (req: any) => {
    const { match, event } = await findMatchWithEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (match.report_status === 'closed') throw conflict('El partido tiene el acta cerrada.');
    const data = validate(z.object({
      venue_id: z.number().int().positive().nullable(), scheduled_at: when, round: z.number().int().min(1).max(999).nullable(),
    }).partial(), req.body);
    if (data.venue_id && !(await db('venues').where({ id: data.venue_id }).first())) throw invalid('venue_id', 'Sede no encontrada.');
    if (!Object.keys(data).length) return { match };
    const [updated] = await db('matches').where({ id: match.id }).update(data).returning('*');
    return { match: updated };
  });

  app.delete('/matches/:id', async (req: any, reply) => {
    const { match, event } = await findMatchWithEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (match.report_status === 'closed') throw conflict('Un partido con acta cerrada no se puede borrar.');
    await db('matches').where({ id: match.id }).delete();
    reply.code(204);
  });

  // ── Árbitros ───────────────────────────────────────────────────────────────
  /** Árbitros que este organizador ha dado de alta. */
  app.get('/referees', async (req) => {
    authorize(policies.actAsOrganizer(me(req)));
    const referees = await db('organizer_referees as o').join('users as u', 'u.id', 'o.user_id')
      .where('o.organizer_id', me(req).id).orderBy('u.name').select('u.id', 'u.name', 'u.email');
    return { referees };
  });

  /** Da el rol de árbitro a un usuario ya registrado (por email) y lo añade a mi lista. */
  app.post('/referees', async (req, reply) => {
    authorize(policies.actAsOrganizer(me(req)));
    const data = validate(z.object({ email: z.string().trim().toLowerCase().email('Email no válido.') }), req.body);
    const user = await db('users').where({ email: data.email }).first();
    if (!user) throw invalid('email', 'No hay ninguna cuenta con ese email. Pídele que se registre primero.');
    await db('users').where({ id: user.id }).update({ is_referee: true });
    await db('organizer_referees').insert({ organizer_id: me(req).id, user_id: user.id }).onConflict(['organizer_id', 'user_id']).ignore();
    reply.code(201);
    return { referee: { id: user.id, name: user.name, email: user.email } };
  });

  app.post('/matches/:id/referees', async (req: any, reply) => {
    const { match, event } = await findMatchWithEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (event.status !== 'active') throw conflict('El evento no está activo.');
    const data = validate(z.object({ user_id: z.number().int().positive() }), req.body);
    const user = await db('users').where({ id: data.user_id }).first();
    if (!user || !user.is_referee) throw invalid('user_id', 'Ese usuario no tiene rol de árbitro.');
    await db('match_referees').insert({ match_id: match.id, user_id: user.id }).onConflict(['match_id', 'user_id']).ignore();
    reply.code(201);
    return { referee: { id: user.id, name: user.name } };
  });

  app.delete('/matches/:id/referees/:refId', async (req: any, reply) => {
    const { match, event } = await findMatchWithEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    await db('match_referees').where({ match_id: match.id, user_id: idParam(req.params.refId) }).delete();
    reply.code(204);
  });

  // ── Acta ───────────────────────────────────────────────────────────────────
  const loadReportContext = async (req: any) => {
    const { match, event } = await findMatchWithEvent(idParam(req.params.id));
    authorize(await policies.editReport(me(req), match, event));
    return { match, event };
  };

  app.get('/matches/:id/report', async (req: any) => {
    const { match, event } = await loadReportContext(req);
    const row = await matchesQuery().where('m.id', match.id).first();
    const [players, events, referees, audits] = await Promise.all([
      db('players').whereIn('team_id', [match.home_team_id, match.away_team_id]).orderBy('number').orderBy('last_name')
        .select('id', 'team_id', 'first_name', 'last_name', 'number'),
      db('match_events as e').join('players as p', 'p.id', 'e.player_id').where('e.match_id', match.id).orderBy('e.minute').orderBy('e.id')
        .select('e.id', 'e.type', 'e.minute', 'e.team_id', 'e.player_id', 'p.first_name', 'p.last_name'),
      db('match_referees as r').join('users as u', 'u.id', 'r.user_id').where('r.match_id', match.id).select('u.id', 'u.name'),
      db('report_audits as a').join('users as u', 'u.id', 'a.user_id').where('a.match_id', match.id).orderBy('a.id', 'desc')
        .select('a.id', 'a.action', 'a.reason', 'a.snapshot', 'a.created_at', 'u.name as user_name'),
    ]);
    const live = scoreFromEvents(events, match.home_team_id, match.away_team_id);
    return {
      // En el acta sí se ve el marcador provisional (calculado de los goles apuntados).
      match: { ...shapeMatch(row), home_score: live.home, away_score: live.away, event_name: event.name },
      players, events, referees, audits,
      can_reopen: policies.reopenReport(me(req), event),
    };
  });

  app.post('/matches/:id/events', async (req: any, reply) => {
    const { match, event } = await loadReportContext(req);
    if (event.status !== 'active') throw conflict('El evento no está activo.');
    if (!canEdit(match.report_status)) throw conflict('El acta está cerrada.');
    const data = validate(z.object({
      type: z.enum(MATCH_EVENT_TYPES, { message: 'Tipo no válido (goal, yellow, red).' }),
      player_id: z.number().int().positive(),
      minute: z.number().int().min(0, 'Minuto fuera de rango.').max(MAX_MINUTE, 'Minuto fuera de rango.'),
    }), req.body);
    // El jugador tiene que pertenecer a uno de los dos equipos del partido. El equipo se deduce de él.
    const player = await db('players').where({ id: data.player_id }).whereIn('team_id', [match.home_team_id, match.away_team_id]).first();
    if (!player) throw invalid('player_id', 'El jugador no pertenece a ninguno de los dos equipos.');
    const [created] = await db('match_events').insert({ ...data, match_id: match.id, team_id: player.team_id }).returning('*');
    reply.code(201);
    return { event: created };
  });

  app.delete('/matches/:id/events/:eventId', async (req: any, reply) => {
    const { match } = await loadReportContext(req);
    // Se busca por (id, match_id): no se puede borrar una incidencia de OTRO partido usando este id.
    const row = await db('match_events').where({ id: idParam(req.params.eventId), match_id: match.id }).first();
    if (!row) throw notFound('Incidencia no encontrada en este partido.');
    if (!canEdit(match.report_status)) throw conflict('El acta está cerrada.');
    await db('match_events').where({ id: row.id }).delete();
    reply.code(204);
  });

  app.post('/matches/:id/report/close', async (req: any) => {
    const { match, event } = await loadReportContext(req);
    if (event.status !== 'active') throw conflict('El evento no está activo.');
    return db.transaction(async (trx) => {
      const locked = await trx('matches').where({ id: match.id }).forUpdate().first();
      if (!canClose(locked.report_status)) throw conflict('El acta ya está cerrada.');
      const events = await trx('match_events').where({ match_id: match.id });
      const score = scoreFromEvents(events, match.home_team_id, match.away_team_id);
      const [updated] = await trx('matches').where({ id: match.id }).update({
        report_status: 'closed', home_score: score.home, away_score: score.away, closed_at: trx.fn.now(), closed_by: me(req).id,
      }).returning('*');
      await trx('report_audits').insert({ match_id: match.id, user_id: me(req).id, action: 'closed', snapshot: JSON.stringify(score) });
      // La clasificación y los stickers se calculan al vuelo a partir de las actas cerradas.
      return { match: updated };
    });
  });

  app.post('/matches/:id/report/reopen', async (req: any) => {
    const { match, event } = await findMatchWithEvent(idParam(req.params.id));
    authorize(policies.reopenReport(me(req), event));
    if (!canReopen(match.report_status)) throw conflict('El acta no está cerrada.');
    const data = validate(z.object({ reason: z.string().trim().min(5, 'Explica el motivo (mínimo 5 caracteres).').max(500) }), req.body);
    return db.transaction(async (trx) => {
      await trx('report_audits').insert({
        match_id: match.id, user_id: me(req).id, action: 'reopened', reason: data.reason,
        snapshot: JSON.stringify({ home: match.home_score, away: match.away_score, closed_by: match.closed_by, closed_at: match.closed_at }),
      });
      const [updated] = await trx('matches').where({ id: match.id }).update({
        report_status: 'draft', home_score: null, away_score: null, closed_at: null, closed_by: null,
      }).returning('*');
      return { match: updated };
    });
  });
}
