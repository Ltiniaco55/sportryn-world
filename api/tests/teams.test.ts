import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAll, db, del, f, get, patch, post, reset, scenario } from './helpers';

beforeEach(reset);
afterAll(closeAll);

describe('POST /teams', () => {
  it('quien crea el equipo queda como capitán (captain_id del body se ignora)', async () => {
    const u = await f.user(), other = await f.user();
    const r = await post('/teams', { as: u, body: { name: 'Los Cracks', captain_id: other.id } });
    expect(r.status).toBe(201);
    expect(await db('teams').first()).toMatchObject({ name: 'Los Cracks', captain_id: u.id });
  });
  it('valida nombre y color', async () => {
    const u = await f.user();
    expect((await post('/teams', { as: u, body: { name: 'x' } })).status).toBe(422);
    expect((await post('/teams', { as: u, body: { name: 'Equipo', color: 'rojo' } })).status).toBe(422);
  });
});

describe('PATCH /teams/{id}', () => {
  it('el capitán edita; otro capitán → 403', async () => {
    const cap = await f.user(), other = await f.user();
    const team = await f.team(cap);
    expect((await patch(`/teams/${team.id}`, { as: other, body: { name: 'Robado' } })).status).toBe(403);
    expect((await patch(`/teams/${team.id}`, { as: cap, body: { name: 'Renombrado', captain_id: other.id } })).status).toBe(200);
    expect(await db('teams').where({ id: team.id }).first()).toMatchObject({ name: 'Renombrado', captain_id: cap.id });
    expect((await patch('/teams/9999', { as: cap, body: { name: 'Nada' } })).status).toBe(404);
  });
});

describe('plantilla: POST/DELETE /teams/{id}/players', () => {
  it('el capitán añade jugadores', async () => {
    const cap = await f.user(); const team = await f.team(cap, 0);
    const r = await post(`/teams/${team.id}/players`, { as: cap, body: { first_name: 'Leo', last_name: 'Ruiz', number: 10, team_id: 999 } });
    expect(r.status).toBe(201);
    expect(await db('players').first()).toMatchObject({ team_id: team.id, first_name: 'Leo', number: 10 });
  });
  it('no se puede añadir un jugador al equipo de otro → 403', async () => {
    const team = await f.team(await f.user(), 0);
    expect((await post(`/teams/${team.id}/players`, { as: await f.user(), body: { first_name: 'Leo', last_name: 'Ruiz' } })).status).toBe(403);
    expect(await db('players').first()).toBeUndefined();
  });
  it('jugador duplicado → 422 (sin distinguir mayúsculas)', async () => {
    const cap = await f.user(); const team = await f.team(cap, 0);
    await post(`/teams/${team.id}/players`, { as: cap, body: { first_name: 'Leo', last_name: 'Ruiz' } });
    expect((await post(`/teams/${team.id}/players`, { as: cap, body: { first_name: 'leo', last_name: 'RUIZ' } })).status).toBe(422);
    expect((await post(`/teams/${team.id}/players`, { as: cap, body: { first_name: '', last_name: 'Ruiz' } })).status).toBe(422);
  });
  it('borrar: solo el capitán y solo jugadores de SU equipo (IDOR)', async () => {
    const cap = await f.user(), other = await f.user();
    const mine = await f.team(cap, 1), theirs = await f.team(other, 1);
    expect((await del(`/teams/${mine.id}/players/${theirs.players[0].id}`, { as: cap })).status).toBe(404);
    expect((await del(`/teams/${theirs.id}/players/${theirs.players[0].id}`, { as: cap })).status).toBe(403);
    expect(await db('players')).toHaveLength(2);
    expect((await del(`/teams/${mine.id}/players/${mine.players[0].id}`, { as: cap })).status).toBe(204);
    expect(await db('players')).toHaveLength(1);
  });
  it('un jugador que aparece en actas no se puede borrar → 409', async () => {
    const { match, home, captain } = await scenario();
    await f.incident(match, home.players[0]);
    expect((await del(`/teams/${home.id}/players/${home.players[0].id}`, { as: captain })).status).toBe(409);
  });
});

describe('POST /events/{id}/registrations', () => {
  it('el capitán inscribe a su equipo', async () => {
    const cap = await f.user(); const ev = await f.event(await f.organizer()); const team = await f.team(cap);
    const r = await post(`/events/${ev.id}/registrations`, { as: cap, body: { team_id: team.id, paid_to_organizer: true } });
    expect(r.status).toBe(201);
    expect(await db('registrations').first()).toMatchObject({ event_id: ev.id, team_id: team.id, paid_to_organizer: false });
  });
  it('no puede inscribir un equipo del que no es capitán → 403', async () => {
    const ev = await f.event(await f.organizer()); const team = await f.team(await f.user());
    expect((await post(`/events/${ev.id}/registrations`, { as: await f.user(), body: { team_id: team.id } })).status).toBe(403);
    expect(await db('registrations').first()).toBeUndefined();
  });
  it('el mismo equipo dos veces → 422', async () => {
    const cap = await f.user(); const ev = await f.event(await f.organizer()); const team = await f.team(cap);
    await post(`/events/${ev.id}/registrations`, { as: cap, body: { team_id: team.id } });
    expect((await post(`/events/${ev.id}/registrations`, { as: cap, body: { team_id: team.id } })).status).toBe(422);
    expect(await db('registrations')).toHaveLength(1);
  });
  it('solo en estado Inscripción: activo → 409, pendiente/cancelado → 404', async () => {
    const cap = await f.user(), o = await f.organizer(); const team = await f.team(cap);
    expect((await post(`/events/${(await f.event(o, 'active')).id}/registrations`, { as: cap, body: { team_id: team.id } })).status).toBe(409);
    for (const s of ['pending_payment', 'cancelled']) {
      expect((await post(`/events/${(await f.event(o, s)).id}/registrations`, { as: cap, body: { team_id: team.id } })).status, s).toBe(404);
    }
    expect(await db('registrations').first()).toBeUndefined();
  });
  it('valida team_id', async () => {
    const cap = await f.user(); const ev = await f.event(await f.organizer());
    expect((await post(`/events/${ev.id}/registrations`, { as: cap, body: {} })).status).toBe(422);
    expect((await post(`/events/${ev.id}/registrations`, { as: cap, body: { team_id: 'abc' } })).status).toBe(422);
  });
});

describe('GET /events/{id}/registrations', () => {
  it('solo el organizador dueño ve las inscripciones (con contacto del capitán)', async () => {
    const { event, organizer, captain } = await scenario('registration');
    const r = await get(`/events/${event.id}/registrations`, { as: organizer });
    expect(r.json.registrations).toHaveLength(2);
    expect(r.json.registrations[0].captain_email).toBe(captain.email);
    expect((await get(`/events/${event.id}/registrations`, { as: await f.organizer() })).status).toBe(403);
    expect((await get(`/events/${event.id}/registrations`, { as: captain })).status).toBe(403);
  });
});

describe('PATCH y DELETE /registrations/{id}', () => {
  it('el organizador marca el pago del equipo; el capitán no puede', async () => {
    const { event, organizer, captain } = await scenario('registration');
    const reg = await db('registrations').where({ event_id: event.id }).first();
    expect((await patch(`/registrations/${reg.id}`, { as: captain, body: { paid_to_organizer: true } })).status).toBe(403);
    expect((await patch(`/registrations/${reg.id}`, { as: organizer, body: { paid_to_organizer: true } })).status).toBe(200);
    expect((await db('registrations').where({ id: reg.id }).first()).paid_to_organizer).toBe(true);
    expect((await patch(`/registrations/${reg.id}`, { as: organizer, body: { paid_to_organizer: 'si' } })).status).toBe(422);
  });
  it('la borran el organizador o el capitán; un tercero → 403', async () => {
    const { event, organizer, captain } = await scenario('registration');
    const [a, b] = await db('registrations').where({ event_id: event.id }).orderBy('id');
    expect((await del(`/registrations/${a.id}`, { as: await f.user() })).status).toBe(403);
    expect((await del(`/registrations/${a.id}`, { as: await f.organizer() })).status).toBe(403);
    expect((await del(`/registrations/${a.id}`, { as: captain })).status).toBe(204);
    expect((await del(`/registrations/${b.id}`, { as: organizer })).status).toBe(204);
    expect(await db('registrations')).toHaveLength(0);
    expect((await del(`/registrations/${b.id}`, { as: organizer })).status).toBe(404);
  });
  it('tras el cierre de inscripción → 409', async () => {
    for (const s of ['pending_payment', 'active']) {
      const { event, organizer } = await scenario(s);
      const reg = await db('registrations').where({ event_id: event.id }).first();
      expect((await del(`/registrations/${reg.id}`, { as: organizer })).status, s).toBe(409);
    }
  });
});
