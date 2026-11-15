import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAll, db, del, f, get, jpegWithExif, multipart, patch, post, reset, scenario } from './helpers';
import { config } from '../src/config';

beforeEach(reset);
afterAll(closeAll);
const closeMatch = (m: any, h = 1, a = 0) => db('matches').where({ id: m.id }).update({ report_status: 'closed', home_score: h, away_score: a });

describe('GET /events/{id}/standings y /scorers', () => {
  it('solo cuentan los partidos con acta cerrada', async () => {
    const { event, home, away, match } = await scenario();
    const draft = await f.match(event, away, home);
    await db('matches').where({ id: draft.id }).update({ home_score: 5, away_score: 0 }); // marcador sin cerrar: no cuenta
    await f.incident(draft, away.players[0]);
    await f.incident(match, home.players[0]); await f.incident(match, home.players[0]); await f.incident(match, home.players[1], 'red');
    await closeMatch(match, 2, 0);
    const s = (await get(`/events/${event.id}/standings`)).json.standings;
    expect(s[0]).toMatchObject({ team_id: home.id, points: 3, played: 1, goals_for: 2 });
    expect(s[1]).toMatchObject({ team_id: away.id, points: 0, played: 1 });
    const scorers = (await get(`/events/${event.id}/scorers`)).json.scorers;
    expect(scorers).toHaveLength(1);
    expect(scorers[0]).toMatchObject({ player_id: home.players[0].id, goals: 2 });
  });
});

describe('POST /events/{id}/posts', () => {
  it('el organizador publica en su evento activo', async () => {
    const { event, organizer } = await scenario();
    const r = await post(`/events/${event.id}/posts`, { as: organizer, body: { body: '¡Jornada 1!', user_id: 999, event_id: 999 } });
    expect(r.status).toBe(201);
    expect(await db('posts').first()).toMatchObject({ event_id: event.id, user_id: organizer.id, body: '¡Jornada 1!' });
    expect((await get(`/events/${event.id}/posts`)).json.posts).toHaveLength(1);
  });
  it('otro organizador, árbitro y capitán → 403', async () => {
    const { event, referee, captain } = await scenario();
    for (const u of [await f.organizer(), referee, captain]) {
      expect((await post(`/events/${event.id}/posts`, { as: u, body: { body: 'spam' } })).status).toBe(403);
    }
    expect(await db('posts').first()).toBeUndefined();
  });
  it('solo con el evento Activo → 409', async () => {
    for (const s of ['registration', 'pending_payment', 'cancelled']) {
      const o = await f.organizer(); const ev = await f.event(o, s);
      expect((await post(`/events/${ev.id}/posts`, { as: o, body: { body: 'hola' } })).status, s).toBe(409);
    }
  });
  it('texto demasiado largo → 422', async () => {
    const { event, organizer } = await scenario();
    expect((await post(`/events/${event.id}/posts`, { as: organizer, body: { body: 'x'.repeat(1001) } })).status).toBe(422);
  });
});

describe('POST /posts/{id}/media', () => {
  const setup = async () => { const s = await scenario(); return { ...s, post: await f.post(s.event, s.organizer) }; };
  const upload = (p: any, as: any, buf: Buffer, name = 'foto.jpg', type = 'image/jpeg') => post(`/posts/${p.id}/media`, { as, ...multipart(buf, name, type) });

  it('sube la foto, elimina el EXIF y genera el nombre en el servidor', async () => {
    const { post: p, organizer } = await setup();
    const original = await jpegWithExif();
    expect((await sharp(original).metadata()).exif).toBeTruthy();
    const r = await upload(p, organizer, original, '../../etc/passwd.jpg');
    expect(r.status).toBe(201);
    const row = await db('media').first();
    expect(row.filename).toMatch(/^[a-f0-9]{32}\.jpg$/);
    expect(r.json.media.url).toContain(row.filename);
    const stored = fs.readFileSync(path.join(config.mediaDir, row.filename));
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
    expect(stored.includes('secreto-exif')).toBe(false);
  });
  it('valida el tipo REAL del archivo, no la extensión ni el Content-Type', async () => {
    const { post: p, organizer } = await setup();
    expect((await upload(p, organizer, Buffer.from('<?php echo 1; ?>'), 'foto.jpg', 'image/jpeg')).status).toBe(422);
    expect((await upload(p, organizer, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.png', 'image/png')).status).toBe(422);
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).gif().toBuffer();
    expect((await upload(p, organizer, gif, 'x.jpg')).status).toBe(422);
    expect(await db('media').first()).toBeUndefined();
    // Un PNG real con extensión engañosa sí es una imagen válida.
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
    expect((await upload(p, organizer, png, 'documento.txt', 'text/plain')).status).toBe(201);
  });
  it('tamaño máximo → 422', async () => {
    const { post: p, organizer } = await setup();
    expect((await upload(p, organizer, Buffer.alloc(config.maxUploadBytes + 1024, 1))).status).toBe(422);
    expect((await post(`/posts/${p.id}/media`, { as: organizer, body: {} })).status).toBe(422);
  });
  it('otro organizador → 403; publicación inexistente → 404', async () => {
    const { post: p, organizer } = await setup();
    expect((await upload(p, await f.organizer(), await jpegWithExif())).status).toBe(403);
    expect((await upload({ id: 9999 }, organizer, await jpegWithExif())).status).toBe(404);
  });
});

describe('DELETE /posts/{id} y /media/{id}', () => {
  it('al borrar, el archivo desaparece también del almacenamiento', async () => {
    const { event, organizer } = await scenario();
    const p = await f.post(event, organizer);
    await post(`/posts/${p.id}/media`, { as: organizer, ...multipart(await jpegWithExif()) });
    await post(`/posts/${p.id}/media`, { as: organizer, ...multipart(await jpegWithExif()) });
    const [m1, m2] = await db('media').orderBy('id');
    const file = (m: any) => path.join(config.mediaDir, m.filename);
    expect(fs.existsSync(file(m1))).toBe(true);

    expect((await del(`/media/${m1.id}`, { as: await f.organizer() })).status).toBe(403);
    expect((await del(`/media/${m1.id}`, { as: organizer })).status).toBe(204);
    expect(fs.existsSync(file(m1))).toBe(false);
    expect(fs.existsSync(file(m2))).toBe(true);

    expect((await del(`/posts/${p.id}`, { as: await f.organizer() })).status).toBe(403);
    expect((await del(`/posts/${p.id}`, { as: organizer })).status).toBe(204);
    expect(fs.existsSync(file(m2))).toBe(false);
    expect(await db('posts').first()).toBeUndefined();
    expect((await del(`/posts/${p.id}`, { as: organizer })).status).toBe(404);
    expect((await del('/media/9999', { as: organizer })).status).toBe(404);
  });
});

describe('stickers', () => {
  it('sticker de partido: PNG 1080×1920 solo con acta cerrada', async () => {
    const { match } = await scenario();
    expect((await get(`/matches/${match.id}/sticker`)).status).toBe(404);
    await closeMatch(match, 3, 1);
    const r = await get(`/matches/${match.id}/sticker`);
    expect(r.status).toBe(200);
    expect(r.res.headers['content-type']).toBe('image/png');
    expect(await sharp(r.res.rawPayload).metadata()).toMatchObject({ format: 'png', width: 1080, height: 1920 });
    expect((await get(`/matches/${match.id}/sticker?bg=transparent`)).status).toBe(200);
  });
  it('sticker de gol: solo goles de actas cerradas; las tarjetas no generan sticker', async () => {
    const { match, home } = await scenario();
    const g = await f.incident(match, home.players[0], 'goal'), y = await f.incident(match, home.players[1], 'yellow');
    expect((await get(`/match-events/${g.id}/sticker`)).status).toBe(404);
    await closeMatch(match);
    const r = await get(`/match-events/${g.id}/sticker`);
    expect(r.status).toBe(200);
    expect(await sharp(r.res.rawPayload).metadata()).toMatchObject({ width: 1080, height: 1920 });
    expect((await get(`/match-events/${y.id}/sticker`)).status).toBe(404);
    expect((await get('/match-events/99999/sticker')).status).toBe(404);
  });
  it('no hay stickers de eventos no públicos', async () => {
    const { match, event } = await scenario();
    await closeMatch(match);
    await db('events').where({ id: event.id }).update({ status: 'cancelled' });
    expect((await get(`/matches/${match.id}/sticker`)).status).toBe(404);
  });
});

describe('administración', () => {
  it('solo un admin cambia roles; nadie puede crear admins por la API', async () => {
    const admin = await f.admin(), u = await f.user(), o = await f.organizer();
    expect((await patch(`/admin/users/${u.id}`, { as: o, body: { role: 'organizer' } })).status).toBe(403);
    expect((await patch(`/admin/users/${u.id}`, { as: u, body: { role: 'organizer' } })).status).toBe(403);
    expect((await patch(`/admin/users/${u.id}`, { as: admin, body: { role: 'admin' } })).status).toBe(422);
    expect((await patch(`/admin/users/${u.id}`, { as: admin, body: { role: 'organizer', is_referee: true } })).status).toBe(200);
    expect(await db('users').where({ id: u.id }).first()).toMatchObject({ role: 'organizer', is_referee: true });
    expect((await patch('/admin/users/9999', { as: admin, body: { role: 'user' } })).status).toBe(404);
  });
  it('listados de usuarios y lista de espera solo para admin', async () => {
    const admin = await f.admin(), o = await f.organizer();
    await db('waitlist').insert({ name: 'Liga', email: 'l@test.dev' });
    expect((await get('/admin/users', { as: o })).status).toBe(403);
    expect((await get('/admin/waitlist', { as: o })).status).toBe(403);
    expect((await get('/admin/waitlist', { as: admin })).json.waitlist).toHaveLength(1);
    const users = (await get(`/admin/users?q=${encodeURIComponent(o.email)}`, { as: admin })).json.users;
    expect(users).toHaveLength(1);
    expect(JSON.stringify(users)).not.toMatch(/password/);
  });
});
