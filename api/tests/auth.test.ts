import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAll, db, f, get, post, reset } from './helpers';

beforeEach(reset);
afterAll(closeAll);
const valid = { name: 'Ana Pérez', email: 'ana@test.dev', password: 'Password123' };

describe('POST /auth/register', () => {
  it('crea la cuenta y devuelve token', async () => {
    const r = await post('/auth/register', { body: valid });
    expect(r.status).toBe(201);
    expect(r.json.user).toMatchObject({ email: 'ana@test.dev', role: 'user', is_referee: false });
    expect(r.json.token).toBeTruthy();
    const row = await db('users').where({ email: 'ana@test.dev' }).first();
    expect(row.password_hash).not.toContain('Password123');
  });
  it('no permite auto-asignarse rol de organizador, admin ni árbitro', async () => {
    const r = await post('/auth/register', { body: { ...valid, role: 'organizer', is_referee: true, id: 999 } });
    expect(r.status).toBe(201);
    expect(await db('users').where({ email: 'ana@test.dev' }).first()).toMatchObject({ role: 'user', is_referee: false });
    const admin = await post('/auth/register', { body: { ...valid, email: 'b@test.dev', role: 'admin' } });
    expect(admin.json.user.role).toBe('user');
  });
  it('email duplicado → 422 (sin distinguir mayúsculas)', async () => {
    await post('/auth/register', { body: valid });
    const r = await post('/auth/register', { body: { ...valid, email: 'ANA@test.dev' } });
    expect(r.status).toBe(422);
    expect(r.json.errors.email).toBeTruthy();
  });
  it('valida contraseña mínima, email y nombre', async () => {
    expect((await post('/auth/register', { body: { ...valid, password: 'corta' } })).status).toBe(422);
    expect((await post('/auth/register', { body: { ...valid, email: 'no-es-email' } })).status).toBe(422);
    expect((await post('/auth/register', { body: {} })).status).toBe(422);
    expect(await db('users').first()).toBeUndefined();
  });
});

describe('POST /auth/login', () => {
  it('con credenciales correctas devuelve token utilizable', async () => {
    await post('/auth/register', { body: valid });
    const r = await post('/auth/login', { body: { email: valid.email, password: valid.password } });
    expect(r.status).toBe(200);
    const me = await get('/me', { headers: { authorization: `Bearer ${r.json.token}` } });
    expect(me.json.user.email).toBe(valid.email);
  });
  it('credenciales malas → 401 con el mismo mensaje exista o no el email', async () => {
    await post('/auth/register', { body: valid });
    const wrongPass = await post('/auth/login', { body: { email: valid.email, password: 'Incorrecta1' } });
    const noUser = await post('/auth/login', { body: { email: 'nadie@test.dev', password: 'Incorrecta1' } });
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPass.json).toEqual(noUser.json);
  });
});

describe('POST /auth/logout y GET /me', () => {
  it('el token queda revocado tras cerrar sesión', async () => {
    const reg = await post('/auth/register', { body: valid });
    const headers = { authorization: `Bearer ${reg.json.token}` };
    expect((await get('/me', { headers })).status).toBe(200);
    expect((await post('/auth/logout', { headers })).status).toBe(204);
    expect((await get('/me', { headers })).status).toBe(401);
  });
  it('cerrar sesión solo revoca ese token, no los de otros dispositivos', async () => {
    const a = await post('/auth/register', { body: valid });
    const b = await post('/auth/login', { body: { email: valid.email, password: valid.password } });
    await post('/auth/logout', { headers: { authorization: `Bearer ${a.json.token}` } });
    expect((await get('/me', { headers: { authorization: `Bearer ${b.json.token}` } })).status).toBe(200);
  });
  it('/me no devuelve campos sensibles', async () => {
    const u = await f.user();
    const r = await get('/me', { as: u });
    expect(Object.keys(r.json.user).sort()).toEqual(['email', 'id', 'is_referee', 'name', 'role']);
    expect(JSON.stringify(r.json)).not.toMatch(/password|hash|token/i);
  });
  it('los tokens se guardan hasheados en la BD', async () => {
    const reg = await post('/auth/register', { body: valid });
    const row = await db('tokens').first();
    expect(row.token_hash).not.toBe(reg.json.token);
    expect(row.token_hash).toHaveLength(64);
  });
});

describe('listados propios', () => {
  it('/me/events solo devuelve mis eventos', async () => {
    const a = await f.organizer(), b = await f.organizer();
    await f.event(a); await f.event(b, 'pending_payment');
    const r = await get('/me/events', { as: b });
    expect(r.json.events).toHaveLength(1);
    expect(r.json.events[0]).toMatchObject({ organizer_id: b.id, status: 'pending_payment', amount_cents: 1000 });
  });
  it('/me/teams, /me/matches y /me/following están acotados al usuario', async () => {
    const o = await f.organizer(), cap = await f.user(), other = await f.user(), ref = await f.referee(), ref2 = await f.referee();
    const ev = await f.event(o, 'active');
    const t1 = await f.team(cap), t2 = await f.team(other);
    const m = await f.match(ev, t1, t2);
    await f.assign(m, ref);
    await db('follows').insert({ user_id: cap.id, event_id: ev.id });
    expect((await get('/me/teams', { as: cap })).json.teams.map((t: any) => t.id)).toEqual([t1.id]);
    expect((await get('/me/matches', { as: ref })).json.matches).toHaveLength(1);
    expect((await get('/me/matches', { as: ref2 })).json.matches).toHaveLength(0);
    expect((await get('/me/following', { as: cap })).json.events).toHaveLength(1);
    expect((await get('/me/following', { as: other })).json.events).toHaveLength(0);
  });
});
