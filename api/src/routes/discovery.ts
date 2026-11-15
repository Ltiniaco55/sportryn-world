import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { idParam, invalid, validate } from '../errors';
import { findPublicEvent, findTeam, matchesQuery, me, publicEvents, shapeMatch, shapePublicEvent } from '../lib';
import { PUBLIC_STATUSES } from '../domain/lifecycle';
import { computeStandings } from '../domain/standings';
import { mediaUrl } from '../services/media';

const pub = { config: { public: true } };
const MAX_BBOX_SPAN = 5; // grados

export default async function (app: FastifyInstance) {
  app.get('/cities', pub, async () => ({
    cities: await db('cities').where({ is_active: true }).orderBy('name').select('id', 'name', 'slug', 'country', 'lat', 'lng'),
  }));

  app.get('/events', pub, async (req) => {
    const q = validate(z.object({ city: z.string().max(80).optional(), q: z.string().max(80).optional() }), req.query);
    const query = publicEvents().whereIn('e.status', PUBLIC_STATUSES).where('c.is_active', true);
    if (q.city) query.where('c.slug', q.city);
    if (q.q) query.whereILike('e.name', `%${q.q.replace(/[%_]/g, '')}%`);
    const rows = await query.orderByRaw("case e.status when 'active' then 0 else 1 end").orderBy('e.created_at', 'desc').limit(100);
    return { events: rows.map(shapePublicEvent) };
  });

  app.get('/events/:id', pub, async (req: any) => {
    const event = await findPublicEvent(idParam(req.params.id));
    const row = await publicEvents().where('e.id', event.id).first();
    const following = req.user ? !!(await db('follows').where({ user_id: req.user.id, event_id: event.id }).first()) : false;
    return { event: { ...shapePublicEvent(row), following } };
  });

  app.get('/events/:id/teams', pub, async (req: any) => {
    const event = await findPublicEvent(idParam(req.params.id));
    const teams = await db('registrations as r').join('teams as t', 't.id', 'r.team_id')
      .where('r.event_id', event.id).orderBy('t.name').select('t.id', 't.name', 't.short_name', 't.color');
    return { teams };
  });

  app.get('/events/:id/matches', pub, async (req: any) => {
    const event = await findPublicEvent(idParam(req.params.id));
    const rows = await matchesQuery().where('m.event_id', event.id).orderBy('m.scheduled_at');
    return { matches: rows.map(shapeMatch) };
  });

  app.get('/events/:id/standings', pub, async (req: any) => {
    const event = await findPublicEvent(idParam(req.params.id));
    const teams = await db('registrations as r').join('teams as t', 't.id', 'r.team_id').where('r.event_id', event.id).select('t.id', 't.name');
    const matches = await db('matches').where({ event_id: event.id, report_status: 'closed' });
    return { standings: computeStandings(teams, matches) };
  });

  app.get('/events/:id/scorers', pub, async (req: any) => {
    const event = await findPublicEvent(idParam(req.params.id));
    const scorers = await db('match_events as me').join('matches as m', 'm.id', 'me.match_id')
      .join('players as p', 'p.id', 'me.player_id').join('teams as t', 't.id', 'me.team_id')
      .where({ 'm.event_id': event.id, 'm.report_status': 'closed', 'me.type': 'goal' })
      .groupBy('p.id', 'p.first_name', 'p.last_name', 't.name')
      .select('p.id as player_id', 'p.first_name', 'p.last_name', 't.name as team_name', db.raw('count(*)::int as goals'))
      .orderBy('goals', 'desc').orderBy('p.last_name').limit(20);
    return { scorers };
  });

  app.get('/events/:id/posts', pub, async (req: any) => {
    const event = await findPublicEvent(idParam(req.params.id));
    const posts = await db('posts').where({ event_id: event.id }).orderBy('created_at', 'desc').limit(50).select('id', 'body', 'created_at');
    const media = posts.length ? await db('media').whereIn('post_id', posts.map((p) => p.id)).orderBy('id') : [];
    return {
      posts: posts.map((p) => ({
        ...p,
        media: media.filter((m) => m.post_id === p.id).map((m) => ({ id: m.id, url: mediaUrl(m.filename), width: m.width, height: m.height })),
      })),
    };
  });

  app.get('/matches/:id', pub, async (req: any) => {
    const row = await matchesQuery().where('m.id', idParam(req.params.id)).first();
    const event = await findPublicEvent(row?.event_id ?? 0);
    const closed = row.report_status === 'closed';
    const events = closed
      ? await db('match_events as me').join('players as p', 'p.id', 'me.player_id').where('me.match_id', row.id)
        .orderBy('me.minute').select('me.id', 'me.type', 'me.minute', 'me.team_id', 'p.first_name', 'p.last_name')
      : [];
    return { match: { ...shapeMatch(row), event_name: event.name, events } };
  });

  app.get('/teams/:id', pub, async (req: any) => {
    const team = await findTeam(idParam(req.params.id));
    const players = await db('players').where({ team_id: team.id }).orderBy('number').orderBy('last_name')
      .select('id', 'first_name', 'last_name', 'number');
    return { team: { id: team.id, name: team.name, short_name: team.short_name, color: team.color, captain_id: team.captain_id, players } };
  });

  /** Sedes con partidos de eventos ACTIVOS dentro del recuadro visible del mapa. */
  app.get('/map/venues', pub, async (req: any) => {
    const parts = String(req.query?.bbox ?? '').split(',').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) throw invalid('bbox', 'bbox debe ser minLng,minLat,maxLng,maxLat.');
    const [minLng, minLat, maxLng, maxLat] = parts;
    if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90 || minLng >= maxLng || minLat >= maxLat) throw invalid('bbox', 'bbox fuera de rango.');
    if (maxLng - minLng > MAX_BBOX_SPAN || maxLat - minLat > MAX_BBOX_SPAN) throw invalid('bbox', 'Zona demasiado grande: acerca el mapa.');
    const rows = await db('venues as v').join('matches as m', 'm.venue_id', 'v.id').join('events as e', 'e.id', 'm.event_id')
      .where('e.status', 'active').whereBetween('v.lat', [minLat, maxLat]).whereBetween('v.lng', [minLng, maxLng])
      .groupBy('v.id', 'e.id').orderBy('v.id').limit(500)
      .select('v.id', 'v.name', 'v.address', 'v.lat', 'v.lng', 'e.id as event_id', 'e.name as event_name', 'e.format as event_format',
        db.raw('count(m.id)::int as matches_count'),
        db.raw("min(m.scheduled_at) filter (where m.report_status = 'draft') as next_match_at"));
    const venues = new Map<number, any>();
    for (const r of rows) {
      const v = venues.get(r.id) ?? { id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, events: [] };
      v.events.push({ id: r.event_id, name: r.event_name, format: r.event_format, matches_count: r.matches_count, next_match_at: r.next_match_at });
      venues.set(r.id, v);
    }
    return { venues: [...venues.values()] };
  });

  // Seguir / dejar de seguir (idempotentes).
  app.post('/events/:id/follow', async (req: any, reply) => {
    const event = await findPublicEvent(idParam(req.params.id));
    await db('follows').insert({ user_id: me(req).id, event_id: event.id }).onConflict(['user_id', 'event_id']).ignore();
    reply.code(204);
  });
  app.delete('/events/:id/follow', async (req: any, reply) => {
    const event = await findPublicEvent(idParam(req.params.id));
    await db('follows').where({ user_id: me(req).id, event_id: event.id }).delete();
    reply.code(204);
  });
}
