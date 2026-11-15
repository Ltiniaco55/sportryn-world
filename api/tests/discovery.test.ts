import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAll, db, del, f, get, post, reset, scenario } from './helpers';

beforeEach(reset);
afterAll(closeAll);

describe('GET /cities', () => {
  it('solo devuelve ciudades activas y sin datos de tarifa', async () => {
    const a = await f.city({ name: 'Madrid' });
    await f.city({ name: 'Oculta', is_active: false });
    const r = await get('/cities');
    expect(r.status).toBe(200);
    expect(r.json.cities.map((c: any) => c.id)).toEqual([a.id]);
    expect(r.json.cities[0]).not.toHaveProperty('team_fee_cents');
  });
});

describe('GET /events', () => {
  it('solo muestra eventos en Inscripción o Activos', async () => {
    const o = await f.organizer();
    const reg = await f.event(o, 'registration'), act = await f.event(o, 'active');
    await f.event(o, 'pending_payment'); await f.event(o, 'cancelled');
    const r = await get('/events');
    expect(r.json.events.map((e: any) => e.id).sort()).toEqual([reg.id, act.id].sort());
  });
  it('filtra por ciudad', async () => {
    const o = await f.organizer();
    const madrid = await f.city({ slug: 'madrid' });
    const ev = await f.event(o, 'active', { city_id: madrid.id });
    await f.event(o, 'active');
    const r = await get('/events?city=madrid');
    expect(r.json.events.map((e: any) => e.id)).toEqual([ev.id]);
  });
  it('no expone email del organizador, importe ni estado de pago', async () => {
    const o = await f.organizer({ email: 'privado@organizador.dev' });
    await f.event(o, 'active', { amount_cents: 4000, checkout_ref: 'cs_secret' });
    const raw = JSON.stringify((await get('/events')).json);
    expect(raw).not.toContain('privado@organizador.dev');
    expect(raw).not.toMatch(/amount_cents|payment_due_at|paid_at|checkout_ref|team_fee_cents|organizer_id/);
  });
  it('no muestra eventos de ciudades desactivadas', async () => {
    const o = await f.organizer();
    const off = await f.city({ is_active: false });
    await f.event(o, 'active', { city_id: off.id });
    expect((await get('/events')).json.events).toHaveLength(0);
  });
});

describe('GET /events/{id}', () => {
  it('devuelve el evento público con nº de equipos', async () => {
    const { event } = await scenario('active');
    const r = await get(`/events/${event.id}`);
    expect(r.status).toBe(200);
    expect(r.json.event).toMatchObject({ id: event.id, teams_count: 2, following: false });
    expect(JSON.stringify(r.json)).not.toMatch(/amount_cents|payment_due_at|paid_at|checkout_ref/);
  });
  it('cancelado o pendiente de pago → 404, también en sus sub-recursos', async () => {
    const o = await f.organizer();
    for (const status of ['cancelled', 'pending_payment']) {
      const ev = await f.event(o, status);
      for (const path of ['', '/teams', '/matches', '/standings', '/scorers', '/posts']) {
        expect((await get(`/events/${ev.id}${path}`)).status, `${status} ${path}`).toBe(404);
      }
    }
  });
  it('inexistente → 404', async () => expect((await get('/events/99999')).status).toBe(404));
});

describe('GET /map/venues', () => {
  it('solo devuelve sedes con partidos de eventos activos dentro del recuadro', async () => {
    const o = await f.organizer(), cap = await f.user();
    const active = await f.event(o, 'active'), cancelled = await f.event(o, 'cancelled');
    const t1 = await f.team(cap), t2 = await f.team(cap);
    const vIn = await f.venue(o, { lat: 40.41, lng: -3.70 });
    const vCancelled = await f.venue(o, { lat: 40.42, lng: -3.71 });
    const vFar = await f.venue(o, { lat: 41.38, lng: 2.17 });
    await f.venue(o, { lat: 40.43, lng: -3.69 }); // sin partidos
    await f.match(active, t1, t2, { venue_id: vIn.id });
    await f.match(active, t1, t2, { venue_id: vFar.id });
    await f.match(cancelled, t1, t2, { venue_id: vCancelled.id });
    const r = await get('/map/venues?bbox=-3.9,40.3,-3.5,40.6');
    expect(r.status).toBe(200);
    expect(r.json.venues.map((v: any) => v.id)).toEqual([vIn.id]);
    expect(r.json.venues[0].events[0]).toMatchObject({ id: active.id, matches_count: 1 });
  });
  it('bbox inválido o demasiado grande → 422', async () => {
    for (const bbox of ['', 'a,b,c,d', '1,2,3', '-3.5,40.3,-3.9,40.6', '-200,40,-190,41', '-10,35,5,45']) {
      expect((await get(`/map/venues?bbox=${bbox}`)).status, bbox).toBe(422);
    }
  });
});

describe('seguir un evento', () => {
  it('seguir dos veces no duplica', async () => {
    const { event } = await scenario(); const u = await f.user();
    expect((await post(`/events/${event.id}/follow`, { as: u })).status).toBe(204);
    expect((await post(`/events/${event.id}/follow`, { as: u })).status).toBe(204);
    expect(await db('follows').where({ user_id: u.id })).toHaveLength(1);
    expect((await get(`/events/${event.id}`, { as: u })).json.event.following).toBe(true);
  });
  it('dejar de seguir es idempotente y no afecta a otros usuarios', async () => {
    const { event } = await scenario(); const u = await f.user(), other = await f.user();
    await post(`/events/${event.id}/follow`, { as: other });
    expect((await del(`/events/${event.id}/follow`, { as: u })).status).toBe(204);
    await post(`/events/${event.id}/follow`, { as: u });
    expect((await del(`/events/${event.id}/follow`, { as: u })).status).toBe(204);
    expect(await db('follows').pluck('user_id')).toEqual([other.id]);
  });
  it('sin autenticar → 401; evento cancelado → 404', async () => {
    const o = await f.organizer(); const u = await f.user();
    const ev = await f.event(o, 'cancelled');
    expect((await post(`/events/${ev.id}/follow`)).status).toBe(401);
    expect((await post(`/events/${ev.id}/follow`, { as: u })).status).toBe(404);
  });
});

describe('datos públicos del evento', () => {
  it('equipos, calendario y detalle de partido: el marcador solo aparece con acta cerrada', async () => {
    const { event, match, home } = await scenario();
    await f.incident(match, home.players[0]);
    expect((await get(`/events/${event.id}/teams`)).json.teams).toHaveLength(2);
    let m = (await get(`/events/${event.id}/matches`)).json.matches[0];
    expect(m).toMatchObject({ report_status: 'draft', home_score: null, away_score: null });
    expect((await get(`/matches/${match.id}`)).json.match.events).toEqual([]); // el borrador no se filtra
    await db('matches').where({ id: match.id }).update({ report_status: 'closed', home_score: 1, away_score: 0 });
    m = (await get(`/matches/${match.id}`)).json.match;
    expect(m).toMatchObject({ home_score: 1, away_score: 0 });
    expect(m.events).toHaveLength(1);
  });
  it('partido de evento no público → 404', async () => {
    const { event, match } = await scenario();
    await db('events').where({ id: event.id }).update({ status: 'cancelled' });
    expect((await get(`/matches/${match.id}`)).status).toBe(404);
    expect((await get('/matches/99999')).status).toBe(404);
  });
  it('equipo público no expone email del capitán', async () => {
    const cap = await f.user({ email: 'capi@privado.dev' });
    const team = await f.team(cap, 3);
    const r = await get(`/teams/${team.id}`);
    expect(r.json.team.players).toHaveLength(3);
    expect(JSON.stringify(r.json)).not.toContain('capi@privado.dev');
  });
});

describe('POST /waitlist', () => {
  it('apunta a la lista y es idempotente por email', async () => {
    const body = { name: 'Liga Sur', email: 'Liga@Sur.dev', league_name: 'Liga Sur', city: 'Madrid', teams_count: 12 };
    expect((await post('/waitlist', { body })).status).toBe(201);
    expect((await post('/waitlist', { body })).status).toBe(201);
    const rows = await db('waitlist');
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('liga@sur.dev');
  });
  it('valida los datos', async () => {
    expect((await post('/waitlist', { body: { name: 'x', email: 'mal' } })).status).toBe(422);
  });
});
