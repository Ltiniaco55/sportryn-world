import type { FastifyRequest } from 'fastify';
import { db } from './db';
import { notFound } from './errors';
import { PUBLIC_STATUSES } from './domain/lifecycle';
import type { AuthUser } from './auth';

export const me = (req: FastifyRequest): AuthUser => req.user!;

export async function findEvent(id: number) {
  const e = await db('events').where({ id }).first();
  if (!e) throw notFound('Evento no encontrado.');
  return e;
}

/** Evento visible para el público. Pendiente de pago y Cancelado responden 404. */
export async function findPublicEvent(id: number) {
  const e = await findEvent(id);
  if (!PUBLIC_STATUSES.includes(e.status)) throw notFound('Evento no encontrado.');
  return e;
}

export async function findTeam(id: number) {
  const t = await db('teams').where({ id }).first();
  if (!t) throw notFound('Equipo no encontrado.');
  return t;
}

export async function findMatchWithEvent(id: number) {
  const match = await db('matches').where({ id }).first();
  if (!match) throw notFound('Partido no encontrado.');
  const event = await db('events').where({ id: match.event_id }).first();
  return { match, event };
}

/** Consulta base de eventos SOLO con campos públicos (sin importe, pago ni datos de contacto). */
export function publicEvents() {
  return db('events as e').join('cities as c', 'c.id', 'e.city_id').join('users as u', 'u.id', 'e.organizer_id')
    .select('e.id', 'e.name', 'e.type', 'e.format', 'e.description', 'e.status', 'e.starts_on',
      'c.id as city_id', 'c.name as city_name', 'c.slug as city_slug', 'u.name as organizer_name',
      db.raw('(select count(*) from registrations r where r.event_id = e.id)::int as teams_count'));
}

export const shapePublicEvent = (r: any) => ({
  id: r.id, name: r.name, type: r.type, format: r.format, description: r.description,
  status: r.status, starts_on: r.starts_on, teams_count: r.teams_count,
  city: { id: r.city_id, name: r.city_name, slug: r.city_slug },
  organizer_name: r.organizer_name,
});

/** Partidos con nombres de equipos y sede. El marcador solo se muestra con acta cerrada. */
export function matchesQuery() {
  return db('matches as m')
    .join('teams as h', 'h.id', 'm.home_team_id').join('teams as a', 'a.id', 'm.away_team_id')
    .leftJoin('venues as v', 'v.id', 'm.venue_id')
    .select('m.id', 'm.event_id', 'm.scheduled_at', 'm.round', 'm.report_status', 'm.home_score', 'm.away_score',
      'm.home_team_id', 'm.away_team_id', 'm.venue_id',
      'h.name as home_name', 'h.color as home_color', 'a.name as away_name', 'a.color as away_color',
      'v.name as venue_name', 'v.address as venue_address', 'v.lat as venue_lat', 'v.lng as venue_lng');
}

export const shapeMatch = (r: any) => ({
  id: r.id, event_id: r.event_id, scheduled_at: r.scheduled_at, round: r.round,
  report_status: r.report_status,
  home_score: r.report_status === 'closed' ? r.home_score : null,
  away_score: r.report_status === 'closed' ? r.away_score : null,
  home: { id: r.home_team_id, name: r.home_name, color: r.home_color },
  away: { id: r.away_team_id, name: r.away_name, color: r.away_color },
  venue: r.venue_id ? { id: r.venue_id, name: r.venue_name, address: r.venue_address, lat: r.venue_lat, lng: r.venue_lng } : null,
});
