import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../db';
import { conflict, HttpError, idParam, invalid, notFound, validate } from '../errors';
import { findEvent, me } from '../lib';
import { authorize, policies } from '../policies';
import { calcAmountCents } from '../domain/amount';
import { isOverdue, paymentDueAt } from '../domain/deadline';
import { canTransition, MIN_TEAMS } from '../domain/lifecycle';
import { activateEvent, createCheckout, verifyStripeSignature } from '../services/payments';

const fields = {
  name: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(120),
  type: z.enum(['league', 'tournament']),
  format: z.enum(['f5', 'f7', 'f11', 'futsal']),
  description: z.string().trim().max(2000).nullable(),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD.').nullable(),
};

const teamsCount = async (eventId: number) =>
  (await db('registrations').where({ event_id: eventId }).count<{ count: number }[]>('* as count'))[0].count;

export default async function (app: FastifyInstance) {
  app.post('/events', async (req, reply) => {
    authorize(policies.actAsOrganizer(me(req)));
    const data = validate(z.object({
      name: fields.name, type: fields.type, format: fields.format.default('f7'),
      description: fields.description.optional(), starts_on: fields.starts_on.optional(),
      city_id: z.number().int().positive(),
    }), req.body);
    const city = await db('cities').where({ id: data.city_id, is_active: true }).first();
    if (!city) throw invalid('city_id', 'Ciudad no disponible.');
    // status, organizer_id y tarifa los fija el servidor: nunca se leen del body.
    const [event] = await db('events').insert({
      ...data, organizer_id: me(req).id, status: 'registration',
      team_fee_cents: city.team_fee_cents, currency: city.currency, payment_days: city.payment_days,
    }).returning('*');
    reply.code(201);
    return { event };
  });

  /** Vista completa del evento para su organizador (importe, plazo, estado de pago). */
  app.get('/events/:id/manage', async (req: any) => {
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    return { event: { ...event, teams_count: await teamsCount(event.id) }, payments_driver: config.paymentsDriver };
  });

  app.patch('/events/:id', async (req: any) => {
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (event.status === 'cancelled') throw conflict('El evento está cancelado.');
    // Lista blanca: status, tarifa, importe u organizador NO se pueden cambiar por aquí.
    const data = validate(z.object({
      name: fields.name, type: fields.type, format: fields.format, description: fields.description, starts_on: fields.starts_on,
    }).partial(), req.body);
    if (!Object.keys(data).length) return { event };
    const [updated] = await db('events').where({ id: event.id }).update(data).returning('*');
    return { event: updated };
  });

  app.post('/events/:id/close-registration', async (req: any) => {
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (!canTransition(event.status, 'pending_payment')) throw conflict('La inscripción ya está cerrada.');
    const teams = await teamsCount(event.id);
    if (teams < MIN_TEAMS) throw invalid('teams', `Necesitas al menos ${MIN_TEAMS} equipos inscritos para cerrar. Sin equipos no hay cobro.`);
    const now = new Date();
    const [updated] = await db('events').where({ id: event.id, status: 'registration' }).update({
      status: 'pending_payment',
      amount_cents: calcAmountCents(teams, event.team_fee_cents),
      registration_closed_at: now,
      payment_due_at: paymentDueAt(now, event.payment_days, config.timezone),
    }).returning('*');
    if (!updated) throw conflict('La inscripción ya está cerrada.');
    return { event: { ...updated, teams_count: teams } };
  });

  const assertPayable = async (event: any) => {
    if (event.status !== 'pending_payment') throw conflict('El evento no está pendiente de pago.');
    if (isOverdue(event.payment_due_at)) {
      await db('events').where({ id: event.id, status: 'pending_payment' }).update({ status: 'cancelled' });
      throw conflict('El plazo de pago ha vencido y el evento se ha cancelado.');
    }
  };

  app.post('/events/:id/checkout', async (req: any) => {
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    await assertPayable(event);
    // El importe sale de la BD. Cualquier `amount` que mande el cliente se ignora.
    const checkout = await createCheckout(event, await teamsCount(event.id));
    await db('events').where({ id: event.id }).update({ checkout_ref: checkout.ref });
    return { checkout_url: checkout.url, amount_cents: event.amount_cents, currency: event.currency };
  });

  /** Solo existe con PAYMENTS_DRIVER=fake (desarrollo local). En producción responde 404. */
  app.post('/events/:id/simulate-payment', async (req: any) => {
    if (config.paymentsDriver !== 'fake') throw notFound();
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    await assertPayable(event);
    await activateEvent(event.id);
    return { event: await findEvent(event.id) };
  });

  app.post('/events/:id/cancel', async (req: any) => {
    const event = await findEvent(idParam(req.params.id));
    authorize(policies.manageEvent(me(req), event));
    if (!canTransition(event.status, 'cancelled')) throw conflict('Este evento ya no se puede cancelar.');
    const [updated] = await db('events').where({ id: event.id }).update({ status: 'cancelled' }).returning('*');
    return { event: updated };
  });

  app.post('/webhooks/stripe', { config: { public: true } }, async (req: any) => {
    if (!verifyStripeSignature(req.rawBody ?? '', req.headers['stripe-signature'], config.stripeWebhookSecret)) {
      throw new HttpError(400, 'Firma no válida.');
    }
    const evt = req.body;
    if (!evt?.id || !evt?.type) throw new HttpError(400, 'Evento no válido.');
    return db.transaction(async (trx) => {
      // Idempotencia: cada evento de Stripe se procesa una sola vez.
      const fresh = await trx('stripe_events').insert({ id: evt.id }).onConflict('id').ignore().returning('id');
      if (!fresh.length) return { received: true, duplicate: true };
      const session = evt.data?.object;
      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(evt.type) && session?.payment_status === 'paid') {
        // Solo activa el evento cuya sesión de pago coincide Y cuyo importe cuadra.
        const event = await trx('events').where({ checkout_ref: session.id }).first();
        if (event && Number(session.metadata?.event_id) === event.id && session.amount_total === event.amount_cents) {
          await trx('events').where({ id: event.id, status: 'pending_payment' }).update({ status: 'active', paid_at: trx.fn.now() });
        }
      }
      return { received: true };
    });
  });
}
