import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAll, db, del, f, get, patch, post, reset, scenario } from './helpers';

beforeEach(reset);
afterAll(closeAll);
const at = '2026-12-01T10:00:00+01:00';

describe('sedes', () => {
  it('un organizador crea una sede; un usuario normal → 403', async () => {
    const o = await f.organizer(); const city = await f.city();
    const body = { name: 'Campo Sur', lat: 40.4, lng: -3.7, city_id: city.id, created_by: 999 };
    expect((await post('/venues', { as: await f.user(), body })).status).toBe(403);
    expect((await post('/venues', { as: o, body })).status).toBe(201);
    expect(await db('venues').first()).toMatchObject({ name: 'Campo Sur', created_by: o.id });
  });
  it('coordenadas fuera de rango → 422', async () => {
    const o = await f.organizer(); const city = await f.city();
    for (const c of [{ lat: 91, lng: 0 }, { lat: -91, lng: 0 }, { lat: 0, lng: 181 }, { lat: 0, lng: -181 }, { lat: 'x', lng: 0 }]) {
      expect((await post('/venues', { as: o, body: { name: 'Campo', city_id: city.id, ...c } })).status).toBe(422);
    }
    expect(await db('venues').first()).toBeUndefined();
  });
  it('editar: solo quien la creó; coordenadas validadas', async () => {
    const o = await f.organizer(); const v = await f.venue(o);
    expect((await patch(`/venues/${v.id}`, { as: await f.organizer(), body: { name: 'Otra' } })).status).toBe(403);
    expect((await patch(`/venues/${v.id}`, { as: o, body: { lat: 200 } })).status).toBe(422);
    expect((await patch(`/venues/${v.id}`, { as: o, body: { name: 'Campo Norte' } })).status).toBe(200);
    expect((await patch('/venues/9999', { as: o, body: { name: 'Nada' } })).status).toBe(404);
    expect((await get('/venues', { as: o })).json.venues).toHaveLength(1);
    expect((await get('/venues', { as: await f.user() })).status).toBe(403);
  });
});

describe('POST /events/{id}/matches', () => {
  it('crea el partido en un evento activo', async () => {
    const { event, organizer, home, away } = await scenario();
    const venue = await f.venue(organizer);
    const r = await post(`/events/${event.id}/matches`, {
      as: organizer, body: { home_team_id: home.id, away_team_id: away.id, venue_id: venue.id, scheduled_at: at, round: 2, home_score: 9, report_status: 'closed' },
    });
    expect(r.status).toBe(201);
    expect(await db('matches').where({ id: r.json.match.id }).first()).toMatchObject({ round: 2, report_status: 'draft', home_score: null });
  });
  it('solo con el evento Activo → 409 (la infraestructura se desbloquea al pagar)', async () => {
    for (const s of ['registration', 'pending_payment', 'cancelled']) {
      const { event, organizer, home, away } = await scenario(s);
      const r = await post(`/events/${event.id}/matches`, { as: organizer, body: { home_team_id: home.id, away_team_id: away.id, scheduled_at: at } });
      expect(r.status, s).toBe(409);
    }
  });
  it('local y visitante deben estar inscritos en ESE evento y ser distintos', async () => {
    const { event, organizer, home, away, captain } = await scenario();
    const outsider = await f.team(captain);
    const send = (body: object) => post(`/events/${event.id}/matches`, { as: organizer, body: { scheduled_at: at, ...body } });
    expect((await send({ home_team_id: home.id, away_team_id: home.id })).status).toBe(422);
    expect((await send({ home_team_id: home.id, away_team_id: outsider.id })).status).toBe(422);
    expect((await send({ home_team_id: outsider.id, away_team_id: away.id })).status).toBe(422);
    expect((await send({ home_team_id: home.id, away_team_id: away.id, venue_id: 9999 })).status).toBe(422);
    expect((await send({ home_team_id: home.id, away_team_id: away.id, scheduled_at: 'mañana' })).status).toBe(422);
  });
  it('otro organizador → 403', async () => {
    const { event, home, away } = await scenario();
    const r = await post(`/events/${event.id}/matches`, { as: await f.organizer(), body: { home_team_id: home.id, away_team_id: away.id, scheduled_at: at } });
    expect(r.status).toBe(403);
  });
});

describe('PATCH/DELETE /matches/{id}', () => {
  it('el dueño reprograma; no puede tocar marcador ni estado del acta', async () => {
    const { match, organizer } = await scenario();
    const r = await patch(`/matches/${match.id}`, { as: organizer, body: { scheduled_at: at, round: 5, home_score: 7, report_status: 'closed' } });
    expect(r.status).toBe(200);
    expect(await db('matches').where({ id: match.id }).first()).toMatchObject({ round: 5, home_score: null, report_status: 'draft' });
  });
  it('otro organizador y árbitro → 403', async () => {
    const { match, referee } = await scenario();
    expect((await patch(`/matches/${match.id}`, { as: await f.organizer(), body: { round: 3 } })).status).toBe(403);
    expect((await del(`/matches/${match.id}`, { as: referee })).status).toBe(403);
    expect((await del(`/matches/${match.id}`, { as: await f.organizer() })).status).toBe(403);
  });
  it('un partido con acta cerrada no se edita ni se borra → 409', async () => {
    const { match, organizer } = await scenario();
    await db('matches').where({ id: match.id }).update({ report_status: 'closed', home_score: 0, away_score: 0 });
    expect((await patch(`/matches/${match.id}`, { as: organizer, body: { round: 3 } })).status).toBe(409);
    expect((await del(`/matches/${match.id}`, { as: organizer })).status).toBe(409);
    expect(await db('matches').where({ id: match.id }).first()).toBeTruthy();
  });
  it('borra un partido en borrador con sus incidencias', async () => {
    const { match, organizer, home } = await scenario();
    await f.incident(match, home.players[0]);
    expect((await del(`/matches/${match.id}`, { as: organizer })).status).toBe(204);
    expect(await db('matches').first()).toBeUndefined();
    expect(await db('match_events').first()).toBeUndefined();
  });
});

describe('árbitros', () => {
  it('el organizador da de alta un árbitro por email', async () => {
    const o = await f.organizer(); const u = await f.user();
    expect((await post('/referees', { as: await f.user(), body: { email: u.email } })).status).toBe(403);
    expect((await post('/referees', { as: o, body: { email: 'nadie@test.dev' } })).status).toBe(422);
    expect((await post('/referees', { as: o, body: { email: u.email.toUpperCase() } })).status).toBe(201);
    expect((await db('users').where({ id: u.id }).first()).is_referee).toBe(true);
    expect((await get('/referees', { as: o })).json.referees.map((r: any) => r.id)).toEqual([u.id]);
    expect((await get('/referees', { as: await f.organizer() })).json.referees).toEqual([]);
  });
  it('dar de alta un árbitro no cambia su rol ni le quita permisos de organizador', async () => {
    const o = await f.organizer(), other = await f.organizer();
    await post('/referees', { as: o, body: { email: other.email } });
    expect(await db('users').where({ id: other.id }).first()).toMatchObject({ role: 'organizer', is_referee: true });
  });
  it('asignar: el usuario debe tener rol árbitro; asignar dos veces no duplica', async () => {
    const { match, organizer } = await scenario();
    const ref = await f.referee(), plain = await f.user();
    expect((await post(`/matches/${match.id}/referees`, { as: organizer, body: { user_id: plain.id } })).status).toBe(422);
    expect((await post(`/matches/${match.id}/referees`, { as: organizer, body: { user_id: 99999 } })).status).toBe(422);
    expect((await post(`/matches/${match.id}/referees`, { as: organizer, body: { user_id: ref.id } })).status).toBe(201);
    expect((await post(`/matches/${match.id}/referees`, { as: organizer, body: { user_id: ref.id } })).status).toBe(201);
    expect(await db('match_referees').where({ user_id: ref.id })).toHaveLength(1);
  });
  it('solo el dueño asigna y solo con el evento Activo', async () => {
    const { match, referee } = await scenario();
    const ref = await f.referee();
    expect((await post(`/matches/${match.id}/referees`, { as: await f.organizer(), body: { user_id: ref.id } })).status).toBe(403);
    expect((await post(`/matches/${match.id}/referees`, { as: referee, body: { user_id: ref.id } })).status).toBe(403);
    const s = await scenario('cancelled');
    expect((await post(`/matches/${s.match.id}/referees`, { as: s.organizer, body: { user_id: ref.id } })).status).toBe(409);
  });
  it('tras quitar la asignación, el árbitro deja de poder ver y editar el acta', async () => {
    const { match, organizer, referee, home } = await scenario();
    const body = { type: 'goal', player_id: home.players[0].id, minute: 5 };
    expect((await post(`/matches/${match.id}/events`, { as: referee, body })).status).toBe(201);
    expect((await del(`/matches/${match.id}/referees/${referee.id}`, { as: await f.organizer() })).status).toBe(403);
    expect((await del(`/matches/${match.id}/referees/${referee.id}`, { as: organizer })).status).toBe(204);
    expect((await post(`/matches/${match.id}/events`, { as: referee, body })).status).toBe(403);
    expect((await get(`/matches/${match.id}/report`, { as: referee })).status).toBe(403);
    expect((await post(`/matches/${match.id}/report/close`, { as: referee })).status).toBe(403);
  });
});
