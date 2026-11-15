import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAll, db, del, f, get, post, reset, scenario } from './helpers';

beforeEach(reset);
afterAll(closeAll);
const goal = (player: any, minute = 10) => ({ type: 'goal', player_id: player.id, minute });

describe('GET /matches/{id}/report', () => {
  it('lo ven el árbitro asignado y el organizador', async () => {
    const { match, referee, organizer, home } = await scenario();
    await f.incident(match, home.players[0]);
    const r = await get(`/matches/${match.id}/report`, { as: referee });
    expect(r.status).toBe(200);
    expect(r.json.players).toHaveLength(4);
    expect(r.json.match).toMatchObject({ home_score: 1, away_score: 0, report_status: 'draft' });
    expect(r.json.can_reopen).toBe(false);
    expect((await get(`/matches/${match.id}/report`, { as: organizer })).json.can_reopen).toBe(true);
  });
  it('árbitro NO asignado, capitán, otro organizador y usuario → 403', async () => {
    const { match, captain } = await scenario();
    for (const u of [await f.referee(), captain, await f.organizer(), await f.user()]) {
      expect((await get(`/matches/${match.id}/report`, { as: u })).status).toBe(403);
    }
  });
  it('un árbitro asignado a OTRO partido del mismo evento no ve este', async () => {
    const { event, home, away, match } = await scenario();
    const other = await f.match(event, away, home); const ref2 = await f.referee();
    await f.assign(other, ref2);
    expect((await get(`/matches/${other.id}/report`, { as: ref2 })).status).toBe(200);
    expect((await get(`/matches/${match.id}/report`, { as: ref2 })).status).toBe(403);
  });
  it('quien pierde el rol de árbitro deja de acceder aunque siga asignado', async () => {
    const { match, referee } = await scenario();
    await db('users').where({ id: referee.id }).update({ is_referee: false });
    expect((await get(`/matches/${match.id}/report`, { as: referee })).status).toBe(403);
  });
});

describe('POST /matches/{id}/events', () => {
  it('el árbitro asignado apunta un gol; el equipo se deduce del jugador', async () => {
    const { match, referee, home, away } = await scenario();
    const r = await post(`/matches/${match.id}/events`, { as: referee, body: { ...goal(away.players[0], 33), team_id: home.id, match_id: 999 } });
    expect(r.status).toBe(201);
    expect(await db('match_events').first()).toMatchObject({ match_id: match.id, team_id: away.id, type: 'goal', minute: 33 });
  });
  it('árbitro no asignado → 403 y no se guarda nada', async () => {
    const { match, home } = await scenario();
    expect((await post(`/matches/${match.id}/events`, { as: await f.referee(), body: goal(home.players[0]) })).status).toBe(403);
    expect((await post(`/matches/${match.id}/events`, { as: await f.user(), body: goal(home.players[0]) })).status).toBe(403);
    expect(await db('match_events').first()).toBeUndefined();
  });
  it('acta cerrada → 409', async () => {
    const { match, referee, home } = await scenario();
    await post(`/matches/${match.id}/report/close`, { as: referee });
    expect((await post(`/matches/${match.id}/events`, { as: referee, body: goal(home.players[0]) })).status).toBe(409);
  });
  it('el jugador debe estar en la plantilla de uno de los dos equipos', async () => {
    const { match, referee, captain } = await scenario();
    const outsider = await f.team(captain);
    expect((await post(`/matches/${match.id}/events`, { as: referee, body: goal(outsider.players[0]) })).status).toBe(422);
    expect((await post(`/matches/${match.id}/events`, { as: referee, body: goal({ id: 99999 }) })).status).toBe(422);
  });
  it('tipo de incidencia y minuto validados', async () => {
    const { match, referee, home } = await scenario();
    const p = home.players[0];
    for (const body of [{ type: 'penalti', player_id: p.id, minute: 5 }, { type: 'goal', player_id: p.id, minute: -1 },
      { type: 'goal', player_id: p.id, minute: 131 }, { type: 'goal', player_id: p.id, minute: 1.5 }, { type: 'goal', player_id: p.id }, {}]) {
      expect((await post(`/matches/${match.id}/events`, { as: referee, body })).status).toBe(422);
    }
    for (const type of ['yellow', 'red']) {
      expect((await post(`/matches/${match.id}/events`, { as: referee, body: { type, player_id: p.id, minute: 130 } })).status).toBe(201);
    }
  });
  it('evento no activo → 409', async () => {
    const { match, referee, home, event } = await scenario();
    await db('events').where({ id: event.id }).update({ status: 'cancelled' });
    expect((await post(`/matches/${match.id}/events`, { as: referee, body: goal(home.players[0]) })).status).toBe(409);
  });
});

describe('DELETE /matches/{id}/events/{eventId}', () => {
  it('el árbitro borra una incidencia de su partido', async () => {
    const { match, referee, home } = await scenario();
    const inc = await f.incident(match, home.players[0]);
    expect((await del(`/matches/${match.id}/events/${inc.id}`, { as: referee })).status).toBe(204);
    expect(await db('match_events').first()).toBeUndefined();
  });
  it('IDOR: no se puede borrar una incidencia de OTRO partido usando el id de este', async () => {
    const a = await scenario(), b = await scenario();
    const foreign = await f.incident(b.match, b.home.players[0]);
    expect((await del(`/matches/${a.match.id}/events/${foreign.id}`, { as: a.referee })).status).toBe(404);
    expect((await del(`/matches/${b.match.id}/events/${foreign.id}`, { as: a.referee })).status).toBe(403);
    expect(await db('match_events').where({ id: foreign.id }).first()).toBeTruthy();
  });
  it('acta cerrada → 409', async () => {
    const { match, referee, home } = await scenario();
    const inc = await f.incident(match, home.players[0]);
    await post(`/matches/${match.id}/report/close`, { as: referee });
    expect((await del(`/matches/${match.id}/events/${inc.id}`, { as: referee })).status).toBe(409);
    expect(await db('match_events').first()).toBeTruthy();
  });
});

describe('POST /matches/{id}/report/close', () => {
  it('cierra el acta: el resultado sale de los goles y queda auditado', async () => {
    const { match, referee, home, away } = await scenario();
    await f.incident(match, home.players[0]); await f.incident(match, home.players[1]);
    await f.incident(match, away.players[0]); await f.incident(match, away.players[1], 'yellow');
    const r = await post(`/matches/${match.id}/report/close`, { as: referee, body: { home_score: 9, away_score: 9 } });
    expect(r.status).toBe(200);
    expect(await db('matches').where({ id: match.id }).first()).toMatchObject({ report_status: 'closed', home_score: 2, away_score: 1, closed_by: referee.id });
    expect(await db('report_audits').first()).toMatchObject({ action: 'closed', user_id: referee.id });
  });
  it('solo una vez: el segundo cierre → 409', async () => {
    const { match, referee } = await scenario();
    expect((await post(`/matches/${match.id}/report/close`, { as: referee })).status).toBe(200);
    expect((await post(`/matches/${match.id}/report/close`, { as: referee })).status).toBe(409);
    expect(await db('report_audits')).toHaveLength(1);
  });
  it('al cerrar se actualiza la clasificación y aparecen los stickers', async () => {
    const { match, referee, event, home } = await scenario();
    const inc = await f.incident(match, home.players[0]);
    expect((await get(`/events/${event.id}/standings`)).json.standings[0].played).toBe(0);
    expect((await get(`/matches/${match.id}/sticker`)).status).toBe(404);
    await post(`/matches/${match.id}/report/close`, { as: referee });
    const top = (await get(`/events/${event.id}/standings`)).json.standings[0];
    expect(top).toMatchObject({ team_id: home.id, points: 3, played: 1 });
    expect((await get(`/matches/${match.id}/sticker`)).status).toBe(200);
    expect((await get(`/match-events/${inc.id}/sticker`)).status).toBe(200);
  });
  it('DECISIÓN: el organizador del evento también puede cerrar y corregir el acta', async () => {
    const { match, organizer, home } = await scenario();
    expect((await post(`/matches/${match.id}/events`, { as: organizer, body: goal(home.players[0]) })).status).toBe(201);
    expect((await post(`/matches/${match.id}/report/close`, { as: organizer })).status).toBe(200);
  });
  it('árbitro no asignado, otro organizador y capitán → 403', async () => {
    const { match, captain } = await scenario();
    for (const u of [await f.referee(), await f.organizer(), captain]) {
      expect((await post(`/matches/${match.id}/report/close`, { as: u })).status).toBe(403);
    }
    expect((await db('matches').where({ id: match.id }).first()).report_status).toBe('draft');
  });
});

describe('POST /matches/{id}/report/reopen', () => {
  it('DECISIÓN: solo el organizador reabre, con motivo obligatorio y registro de auditoría', async () => {
    const { match, organizer, referee, home, event } = await scenario();
    await f.incident(match, home.players[0]);
    await post(`/matches/${match.id}/report/close`, { as: referee });
    expect((await post(`/matches/${match.id}/report/reopen`, { as: referee, body: { reason: 'Me equivoqué' } })).status).toBe(403);
    expect((await post(`/matches/${match.id}/report/reopen`, { as: await f.organizer(), body: { reason: 'Porque sí' } })).status).toBe(403);
    expect((await post(`/matches/${match.id}/report/reopen`, { as: organizer, body: {} })).status).toBe(422);
    expect((await post(`/matches/${match.id}/report/reopen`, { as: organizer, body: { reason: 'abc' } })).status).toBe(422);
    expect((await db('matches').where({ id: match.id }).first()).report_status).toBe('closed');

    expect((await post(`/matches/${match.id}/report/reopen`, { as: organizer, body: { reason: 'Gol mal asignado' } })).status).toBe(200);
    expect(await db('matches').where({ id: match.id }).first()).toMatchObject({ report_status: 'draft', home_score: null, closed_at: null });
    const audit = await db('report_audits').where({ action: 'reopened' }).first();
    expect(audit).toMatchObject({ user_id: organizer.id, reason: 'Gol mal asignado' });
    expect(audit.snapshot).toMatchObject({ home: 1, away: 0, closed_by: referee.id });
    // La clasificación deja de contar el partido y el sticker desaparece hasta que se vuelva a cerrar.
    expect((await get(`/events/${event.id}/standings`)).json.standings[0].played).toBe(0);
    expect((await get(`/matches/${match.id}/sticker`)).status).toBe(404);
    // Vuelve a ser editable y cerrable.
    expect((await post(`/matches/${match.id}/events`, { as: referee, body: goal(home.players[1]) })).status).toBe(201);
    expect((await post(`/matches/${match.id}/report/close`, { as: referee })).status).toBe(200);
    expect((await db('matches').where({ id: match.id }).first()).home_score).toBe(2);
    expect((await get(`/matches/${match.id}/report`, { as: organizer })).json.audits).toHaveLength(3);
  });
  it('un acta en borrador no se puede reabrir → 409', async () => {
    const { match, organizer } = await scenario();
    expect((await post(`/matches/${match.id}/report/reopen`, { as: organizer, body: { reason: 'Motivo válido' } })).status).toBe(409);
  });
});
