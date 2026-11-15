import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import { config } from './config';
import { HttpError, unauthenticated } from './errors';
import { userFromRequest } from './auth';
import authRoutes from './routes/auth';
import discoveryRoutes from './routes/discovery';
import eventRoutes from './routes/events';
import teamRoutes from './routes/teams';
import matchRoutes from './routes/matches';
import feedRoutes from './routes/feed';
import adminRoutes from './routes/admin';

export interface RouteInfo { method: string; url: string; public: boolean; rateLimited: boolean }
declare module 'fastify' { interface FastifyInstance { apiRoutes: RouteInfo[] } }

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.log, trustProxy: true, bodyLimit: 1024 * 1024 });
  fs.mkdirSync(config.mediaDir, { recursive: true });

  // CORS_ORIGINS=* admite cualquier origen (cómodo en local; la API usa tokens Bearer, no cookies).
  await app.register(cors, { origin: config.corsOrigins.includes('*') ? true : config.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1 } });
  await app.register(fastifyStatic, { root: config.mediaDir, prefix: '/media/', index: false });

  // Guardamos el cuerpo en crudo: el webhook de Stripe firma el texto exacto recibido.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body as string;
    try { done(null, body ? JSON.parse(body as string) : {}); }
    catch { done(new HttpError(400, 'JSON no válido.')); }
  });

  // Registro de rutas para el test global de seguridad.
  app.decorate('apiRoutes', [] as RouteInfo[]);
  app.addHook('onRoute', (r) => {
    if (!r.url.startsWith('/api')) return;
    for (const method of [r.method].flat()) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      app.apiRoutes.push({ method, url: r.url, public: r.config?.public === true, rateLimited: !!(r.config as any)?.rateLimit });
    }
  });

  /**
   * DENEGAR POR DEFECTO: toda ruta /api exige token salvo que se declare
   * explícitamente `config: { public: true }`. Olvidarse de proteger una ruta nueva es imposible.
   */
  app.addHook('preHandler', async (req) => {
    if (req.is404 || !req.routeOptions.url?.startsWith('/api')) return;
    const user = await userFromRequest(req);
    if (user) req.user = user;
    else if (req.routeOptions.config?.public !== true) throw unauthenticated();
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ message: err.message, ...(err.errors ? { errors: err.errors } : {}) });
    if (err.statusCode === 429) return reply.code(429).send({ message: 'Demasiados intentos. Espera un momento.' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ message: err.message });
    req.log.error(err);
    return reply.code(500).send({ message: 'Error interno.' });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ message: 'No encontrado.' }));

  app.get('/health', async () => ({ ok: true }));
  await app.register(async (api) => {
    for (const routes of [authRoutes, discoveryRoutes, eventRoutes, teamRoutes, matchRoutes, feedRoutes, adminRoutes]) await api.register(routes);
  }, { prefix: '/api' });

  return app;
}
