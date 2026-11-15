import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { hashPassword, issueToken } from '../src/auth';

export { db };
let app: FastifyInstance | undefined;
let seq = 0;

export async function getApp() {
  if (!app) { app = await buildApp(); await app.ready(); }
  return app;
}

const TABLES = ['report_audits', 'match_events', 'match_referees', 'organizer_referees', 'matches', 'media', 'posts', 'follows',
  'registrations', 'players', 'teams', 'venues', 'events', 'cities', 'tokens', 'users', 'stripe_events', 'waitlist'];

export async function reset() {
  await db.raw(`truncate table ${TABLES.join(', ')} restart identity cascade`);
}
export async function closeAll() {
  await app?.close(); app = undefined;
  await db.destroy();
}

const PASSWORD_HASH = hashPassword('Password123');

/** Factories: una por entidad. */
export const f = {
  async user(extra: object = {}) {
    const n = ++seq;
    return (await db('users').insert({ name: `User ${n}`, email: `user${n}@test.dev`, password_hash: PASSWORD_HASH, ...extra }).returning('*'))[0];
  },
  organizer: (extra: object = {}) => f.user({ role: 'organizer', ...extra }),
  referee: (extra: object = {}) => f.user({ is_referee: true, ...extra }),
  admin: () => f.user({ role: 'admin' }),
  async city(extra: object = {}) {
    const n = ++seq;
    return (await db('cities').insert({ name: `City ${n}`, slug: `city-${n}`, lat: 40.4, lng: -3.7, team_fee_cents: 500, payment_days: 7, ...extra }).returning('*'))[0];
  },
  async event(organizer: any, status = 'registration', extra: any = {}) {
    const city = extra.city_id ? { id: extra.city_id, team_fee_cents: 500, currency: 'eur', payment_days: 7 } : await f.city();
    const pending = status === 'pending_payment'
      ? { amount_cents: 1000, payment_due_at: new Date(Date.now() + 86400000), registration_closed_at: new Date() } : {};
    return (await db('events').insert({
      name: `Event ${++seq}`, type: 'league', format: 'f7', status, city_id: city.id, organizer_id: organizer.id,
      team_fee_cents: city.team_fee_cents, currency: city.currency, payment_days: city.payment_days, ...pending, ...extra,
    }).returning('*'))[0];
  },
  async team(captain: any, players = 2, extra: object = {}) {
    const [team] = await db('teams').insert({ name: `Team ${++seq}`, captain_id: captain.id, ...extra }).returning('*');
    team.players = players
      ? await db('players').insert(Array.from({ length: players }, (_, i) => ({ team_id: team.id, first_name: `P${i}`, last_name: `T${team.id}`, number: i + 1 }))).returning('*')
      : [];
    return team;
  },
  async register(event: any, team: any) {
    return (await db('registrations').insert({ event_id: event.id, team_id: team.id }).returning('*'))[0];
  },
  async venue(creator: any, extra: any = {}) {
    const city_id = extra.city_id ?? (await f.city()).id;
    return (await db('venues').insert({ name: `Venue ${++seq}`, lat: 40.41, lng: -3.70, created_by: creator.id, ...extra, city_id }).returning('*'))[0];
  },
  async match(event: any, home: any, away: any, extra: object = {}) {
    return (await db('matches').insert({ event_id: event.id, home_team_id: home.id, away_team_id: away.id, scheduled_at: new Date(), ...extra }).returning('*'))[0];
  },
  async assign(match: any, referee: any) {
    await db('match_referees').insert({ match_id: match.id, user_id: referee.id });
  },
  async incident(match: any, player: any, type = 'goal', minute = 10) {
    return (await db('match_events').insert({ match_id: match.id, team_id: player.team_id, player_id: player.id, type, minute }).returning('*'))[0];
  },
  async post(event: any, user: any) {
    return (await db('posts').insert({ event_id: event.id, user_id: user.id, body: 'hola' }).returning('*'))[0];
  },
};

/** Escenario habitual: evento activo con dos equipos inscritos, un partido y un árbitro asignado. */
export async function scenario(status = 'active') {
  const organizer = await f.organizer();
  const captain = await f.user();
  const referee = await f.referee();
  const event = await f.event(organizer, status);
  const home = await f.team(captain);
  const away = await f.team(captain);
  await f.register(event, home); await f.register(event, away);
  const match = await f.match(event, home, away);
  await f.assign(match, referee);
  return { organizer, captain, referee, event, home, away, match };
}

interface CallOpts { as?: any; body?: any; headers?: Record<string, string>; payload?: any }
export async function call(method: string, url: string, opts: CallOpts = {}) {
  const a = await getApp();
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.as) headers.authorization = `Bearer ${await issueToken(opts.as.id)}`;
  const res = await a.inject({
    method: method as any, url: `/api${url}`, headers,
    ...(opts.payload !== undefined ? { payload: opts.payload } : opts.body !== undefined ? { payload: opts.body } : {}),
  });
  let json: any = null;
  try { json = res.json(); } catch { /* respuesta sin JSON */ }
  return { status: res.statusCode, json, res };
}
export const get = (url: string, o?: CallOpts) => call('GET', url, o);
export const post = (url: string, o?: CallOpts) => call('POST', url, o);
export const patch = (url: string, o?: CallOpts) => call('PATCH', url, o);
export const del = (url: string, o?: CallOpts) => call('DELETE', url, o);

/** Cuerpo multipart con un único archivo en el campo "file". */
export function multipart(buffer: Buffer, filename = 'foto.jpg', type = 'image/jpeg') {
  const boundary = '----sportryntest';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`);
  return { payload: Buffer.concat([head, buffer, Buffer.from(`\r\n--${boundary}--\r\n`)]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

/** JPEG real con metadatos EXIF (para comprobar que se eliminan). */
export const jpegWithExif = () => sharp({ create: { width: 64, height: 48, channels: 3, background: '#c6f432' } })
  .withExif({ IFD0: { Copyright: 'secreto-exif', Make: 'CamaraDePrueba' } }).jpeg().toBuffer();
