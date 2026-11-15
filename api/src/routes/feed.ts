import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../db';
import { conflict, idParam, invalid, notFound, validate } from '../errors';
import { findEvent, findPublicEvent, me } from '../lib';
import { authorize, policies } from '../policies';
import { deleteImage, mediaUrl, storeImage } from '../services/media';
import { goalSticker, matchSticker } from '../services/stickers';

const pub = { config: { public: true } };

async function loadPost(id: number) {
  const post = await db('posts').where({ id }).first();
  if (!post) throw notFound('Publicación no encontrada.');
  return { post, event: await findEvent(post.event_id) };
}

export default async function (app: FastifyInstance) {
  app.post('/events/:id/posts', async (req: any, reply) => {
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (event.status !== 'active') throw conflict('El feed se desbloquea cuando el evento está activo.');
    const data = validate(z.object({ body: z.string().trim().max(1000).nullable().optional() }), req.body);
    const [post] = await db('posts').insert({ event_id: event.id, user_id: me(req).id, body: data.body ?? null }).returning('*');
    reply.code(201);
    return { post };
  });

  app.post('/posts/:id/media', async (req: any, reply) => {
    const { post, event } = await loadPost(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (event.status !== 'active') throw conflict('El evento no está activo.');
    if (!req.isMultipart()) throw invalid('file', 'Envía la foto como multipart/form-data en el campo "file".');
    const file = await req.file();
    if (!file) throw invalid('file', 'Falta la foto.');
    let buffer: Buffer;
    try { buffer = await file.toBuffer(); } catch { throw invalid('file', `La foto supera el máximo de ${config.maxUploadBytes / 1024 / 1024} MB.`); }
    const count = (await db('media').where({ post_id: post.id }).count<{ count: number }[]>('* as count'))[0].count;
    if (count >= 10) throw invalid('file', 'Máximo 10 fotos por publicación.');
    const stored = await storeImage(buffer); // valida el tipo real y elimina EXIF
    const [media] = await db('media').insert({ post_id: post.id, ...stored }).returning('*');
    reply.code(201);
    return { media: { id: media.id, url: mediaUrl(media.filename), width: media.width, height: media.height } };
  });

  app.delete('/posts/:id', async (req: any, reply) => {
    const { post, event } = await loadPost(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    const files = await db('media').where({ post_id: post.id }).pluck('filename');
    await db('posts').where({ id: post.id }).delete();
    await Promise.all(files.map(deleteImage)); // el archivo también se borra del almacenamiento
    reply.code(204);
  });

  app.delete('/media/:id', async (req: any, reply) => {
    const media = await db('media').where({ id: idParam(req.params.id) }).first();
    if (!media) throw notFound('Foto no encontrada.');
    const { event } = await loadPost(media.post_id);
    authorize(policies.manageEvent(me(req), event));
    await db('media').where({ id: media.id }).delete();
    await deleteImage(media.filename);
    reply.code(204);
  });

  // ── Stickers (PNG 1080×1920). Solo existen para actas cerradas. ────────────
  const sendPng = (reply: any, png: Buffer) => reply.header('Content-Type', 'image/png').header('Cache-Control', 'public, max-age=300').send(png);
  const brandOf = async (event: any) => `Sportryn ${(await db('cities').where({ id: event.city_id }).first()).name}`;
  const fmtDate = (d: Date) => new Intl.DateTimeFormat('es-ES', { timeZone: config.timezone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));

  app.get('/matches/:id/sticker', pub, async (req: any, reply) => {
    const match = await db('matches').where({ id: idParam(req.params.id), report_status: 'closed' }).first();
    if (!match) throw notFound('Sticker no disponible.');
    const event = await findPublicEvent(match.event_id);
    const teams = await db('teams').whereIn('id', [match.home_team_id, match.away_team_id]);
    const name = (id: number) => teams.find((t) => t.id === id)?.name ?? '';
    return sendPng(reply, matchSticker({
      eventName: event.name, brand: await brandOf(event), home: name(match.home_team_id), away: name(match.away_team_id),
      homeScore: match.home_score, awayScore: match.away_score, date: fmtDate(match.scheduled_at),
    }, req.query?.bg === 'transparent'));
  });

  app.get('/match-events/:id/sticker', pub, async (req: any, reply) => {
    // Solo goles: las tarjetas no generan sticker.
    const goal = await db('match_events').where({ id: idParam(req.params.id), type: 'goal' }).first();
    if (!goal) throw notFound('Sticker no disponible.');
    const match = await db('matches').where({ id: goal.match_id, report_status: 'closed' }).first();
    if (!match) throw notFound('Sticker no disponible.');
    const event = await findPublicEvent(match.event_id);
    const player = await db('players').where({ id: goal.player_id }).first();
    const teams = await db('teams').whereIn('id', [match.home_team_id, match.away_team_id]);
    const name = (id: number) => teams.find((t) => t.id === id)?.name ?? '';
    return sendPng(reply, goalSticker({
      firstName: player.first_name, lastName: player.last_name, brand: await brandOf(event), minute: goal.minute, eventName: event.name,
      matchLine: `${name(match.home_team_id)} ${match.home_score}–${match.away_score} ${name(match.away_team_id)}`,
    }, req.query?.bg === 'transparent'));
  });
}
