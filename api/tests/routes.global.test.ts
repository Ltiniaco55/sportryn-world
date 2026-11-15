import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeAll, getApp, reset } from './helpers';

/**
 * LISTA BLANCA de endpoints públicos. Si añades una ruta pública nueva, este test
 * falla hasta que la apuntes aquí: así ninguna ruta queda abierta por descuido.
 */
const PUBLIC = [
  'POST /api/auth/register', 'POST /api/auth/login',
  'GET /api/cities', 'GET /api/events', 'GET /api/events/:id',
  'GET /api/events/:id/teams', 'GET /api/events/:id/matches', 'GET /api/events/:id/standings',
  'GET /api/events/:id/scorers', 'GET /api/events/:id/posts',
  'GET /api/matches/:id', 'GET /api/teams/:id', 'GET /api/map/venues',
  'GET /api/matches/:id/sticker', 'GET /api/match-events/:id/sticker',
  'POST /api/webhooks/stripe', 'POST /api/waitlist',
].sort();

beforeAll(reset);
afterAll(closeAll);

describe('test global de rutas', () => {
  it('las únicas rutas públicas son las de la lista blanca', async () => {
    const app = await getApp();
    const actual = app.apiRoutes.filter((r) => r.public).map((r) => `${r.method} ${r.url}`).sort();
    expect(actual).toEqual(PUBLIC);
  });

  it('toda ruta no pública responde 401 sin token (y con token inventado)', async () => {
    const app = await getApp();
    const priv = app.apiRoutes.filter((r) => !r.public);
    expect(priv.length).toBeGreaterThan(30);
    for (const r of priv) {
      const url = r.url.replace(/:\w+/g, '1');
      const anon = await app.inject({ method: r.method as any, url });
      expect(anon.statusCode, `${r.method} ${r.url} sin token`).toBe(401);
      const fake = await app.inject({ method: r.method as any, url, headers: { authorization: 'Bearer token-inventado' } });
      expect(fake.statusCode, `${r.method} ${r.url} con token falso`).toBe(401);
    }
  });

  it('login, registro, inscripciones y lista de espera tienen rate limit', async () => {
    const app = await getApp();
    const limited = app.apiRoutes.filter((r) => r.rateLimited).map((r) => `${r.method} ${r.url}`).sort();
    expect(limited).toEqual(['POST /api/auth/login', 'POST /api/auth/register', 'POST /api/events/:id/registrations', 'POST /api/waitlist']);
  });

  it('una ruta inexistente responde 404 y no 500', async () => {
    const app = await getApp();
    expect((await app.inject({ method: 'GET', url: '/api/no-existe' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/events/abc' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: '{mal json', headers: { 'content-type': 'application/json' } })).statusCode).toBe(400);
  });
});
