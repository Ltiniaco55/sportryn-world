import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAll, db, f, get, getApp, patch, post, reset } from './helpers';
import { cancelExpiredEvents, signStripePayload } from '../src/services/payments';

beforeEach(reset);
afterAll(closeAll);

describe('POST /events', () => {
  it('rol incorrecto → 403', async () => {
    const city = await f.city();
    const body = { name: 'Liga', type: 'league', city_id: city.id };
    expect((await post('/events', { as: await f.user(), body })).status).toBe(403);
    expect((await post('/events', { as: await f.referee(), body })).status).toBe(403);
    expect(await db('events').first()).toBeUndefined();
  });
  it('se crea SIEMPRE en Inscripción, con organizador y tarifa fijados por el servidor', async () => {
    const o = await f.organizer(), other = await f.organizer();
    const city = await f.city({ team_fee_cents: 700, payment_days: 5 });
    const r = await post('/events', {
      as: o,
      body: { name: 'Liga Norte', type: 'league', city_id: city.id, status: 'active', organizer_id: other.id, team_fee_cents: 1, amount_cents: 0, paid_at: '2026-01-01' },
    });
    expect(r.status).toBe(201);
    expect(await db('events').first()).toMatchObject({
      status: 'registration', organizer_id: o.id, team_fee_cents: 700, payment_days: 5, amount_cents: null, paid_at: null,
    });
  });
  it('valida nombre, tipo y ciudad', async () => {
    const o = await f.organizer(); const city = await f.city(); const off = await f.city({ is_active: false });
    expect((await post('/events', { as: o, body: { name: 'x', type: 'league', city_id: city.id } })).status).toBe(422);
    expect((await post('/events', { as: o, body: { name: 'Liga', type: 'copa', city_id: city.id } })).status).toBe(422);
    expect((await post('/events', { as: o, body: { name: 'Liga', type: 'league', city_id: off.id } })).status).toBe(422);
    expect((await post('/events', { as: o, body: { name: 'Liga', type: 'league', city_id: 9999 } })).status).toBe(422);
  });
});

describe('PATCH /events/{id}', () => {
  it('el dueño edita los campos permitidos', async () => {
    const o = await f.organizer(); const ev = await f.event(o);
    const r = await patch(`/events/${ev.id}`, { as: o, body: { name: 'Nuevo nombre', description: 'Hola' } });
    expect(r.status).toBe(200);
    expect(await db('events').where({ id: ev.id }).first()).toMatchObject({ name: 'Nuevo nombre', description: 'Hola' });
  });
  it('otro organizador → 403 y no cambia nada', async () => {
    const o = await f.organizer(), other = await f.organizer(); const ev = await f.event(o);
    expect((await patch(`/events/${ev.id}`, { as: other, body: { name: 'Hackeado' } })).status).toBe(403);
    expect((await db('events').where({ id: ev.id }).first()).name).toBe(ev.name);
  });
  it('no se puede cambiar status, tarifa, importe ni dueño por PATCH', async () => {
    const o = await f.organizer(), other = await f.organizer(); const ev = await f.event(o, 'pending_payment');
    const r = await patch(`/events/${ev.id}`, { as: o, body: { name: 'Vale', status: 'active', team_fee_cents: 0, amount_cents: 0, organizer_id: other.id, paid_at: '2026-01-01' } });
    expect(r.status).toBe(200);
    expect(await db('events').where({ id: ev.id }).first()).toMatchObject({
      name: 'Vale', status: 'pending_payment', team_fee_cents: 500, amount_cents: 1000, organizer_id: o.id, paid_at: null,
    });
  });
  it('en Cancelado → 409; validación → 422; inexistente → 404', async () => {
    const o = await f.organizer();
    const cancelled = await f.event(o, 'cancelled'), ev = await f.event(o);
    expect((await patch(`/events/${cancelled.id}`, { as: o, body: { name: 'Otro' } })).status).toBe(409);
    expect((await patch(`/events/${ev.id}`, { as: o, body: { name: 'x' } })).status).toBe(422);
    expect((await patch('/events/99999', { as: o, body: { name: 'Otro' } })).status).toBe(404);
  });
});

describe('GET /events/{id}/manage', () => {
  it('solo el dueño ve importe y plazo', async () => {
    const o = await f.organizer(), other = await f.organizer(); const ev = await f.event(o, 'pending_payment');
    const r = await get(`/events/${ev.id}/manage`, { as: o });
    expect(r.json.event).toMatchObject({ amount_cents: 1000, status: 'pending_payment' });
    expect((await get(`/events/${ev.id}/manage`, { as: other })).status).toBe(403);
    expect((await get(`/events/${ev.id}/manage`, { as: await f.user() })).status).toBe(403);
  });
});

describe('POST /events/{id}/close-registration', () => {
  const withTeams = async (n: number, fee = 500) => {
    const o = await f.organizer(), cap = await f.user();
    const city = await f.city({ team_fee_cents: fee, payment_days: 7 });
    const ev = await f.event(o, 'registration', { city_id: city.id, team_fee_cents: fee });
    for (let i = 0; i < n; i++) await f.register(ev, await f.team(cap, 0));
    return { o, ev };
  };
  it('calcula importe = nº equipos × tarifa y fija la fecha límite', async () => {
    const { o, ev } = await withTeams(4, 600);
    const r = await post(`/events/${ev.id}/close-registration`, { as: o, body: { amount_cents: 1 } });
    expect(r.status).toBe(200);
    const row = await db('events').where({ id: ev.id }).first();
    expect(row).toMatchObject({ status: 'pending_payment', amount_cents: 2400 });
    const days = (new Date(row.payment_due_at).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(7); expect(days).toBeLessThan(8.1);
  });
  it('con 0 equipos no se genera cobro: 422 y el evento sigue en Inscripción', async () => {
    const { o, ev } = await withTeams(0);
    expect((await post(`/events/${ev.id}/close-registration`, { as: o })).status).toBe(422);
    expect(await db('events').where({ id: ev.id }).first()).toMatchObject({ status: 'registration', amount_cents: null, payment_due_at: null });
  });
  it('solo desde Inscripción → 409 en cualquier otro estado', async () => {
    const o = await f.organizer();
    for (const s of ['pending_payment', 'active', 'cancelled']) {
      const ev = await f.event(o, s);
      expect((await post(`/events/${ev.id}/close-registration`, { as: o })).status, s).toBe(409);
    }
  });
  it('otro organizador → 403', async () => {
    const { ev } = await withTeams(2);
    expect((await post(`/events/${ev.id}/close-registration`, { as: await f.organizer() })).status).toBe(403);
    expect((await db('events').where({ id: ev.id }).first()).status).toBe('registration');
  });
});

describe('POST /events/{id}/checkout', () => {
  it('devuelve la URL de pago con el importe del servidor (ignora el del cliente)', async () => {
    const o = await f.organizer(); const ev = await f.event(o, 'pending_payment');
    const r = await post(`/events/${ev.id}/checkout`, { as: o, body: { amount_cents: 1, amount: 0 } });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ amount_cents: 1000, currency: 'eur' });
    expect(r.json.checkout_url).toContain(`event=${ev.id}`);
    expect((await db('events').where({ id: ev.id }).first()).checkout_ref).toBeTruthy();
  });
  it('solo en Pendiente de pago → 409', async () => {
    const o = await f.organizer();
    for (const s of ['registration', 'active', 'cancelled']) {
      expect((await post(`/events/${(await f.event(o, s)).id}/checkout`, { as: o })).status, s).toBe(409);
    }
  });
  it('plazo vencido → 409 y el evento pasa a Cancelado', async () => {
    const o = await f.organizer();
    const ev = await f.event(o, 'pending_payment', { payment_due_at: new Date(Date.now() - 1000) });
    expect((await post(`/events/${ev.id}/checkout`, { as: o })).status).toBe(409);
    expect((await db('events').where({ id: ev.id }).first()).status).toBe('cancelled');
  });
  it('otro organizador → 403', async () => {
    const ev = await f.event(await f.organizer(), 'pending_payment');
    expect((await post(`/events/${ev.id}/checkout`, { as: await f.organizer() })).status).toBe(403);
  });
});

describe('pago simulado y cancelación', () => {
  it('simulate-payment activa el evento (solo dueño, solo pendiente)', async () => {
    const o = await f.organizer(); const ev = await f.event(o, 'pending_payment');
    expect((await post(`/events/${ev.id}/simulate-payment`, { as: await f.organizer() })).status).toBe(403);
    expect((await post(`/events/${ev.id}/simulate-payment`, { as: o })).status).toBe(200);
    const row = await db('events').where({ id: ev.id }).first();
    expect(row.status).toBe('active'); expect(row.paid_at).toBeTruthy();
    expect((await post(`/events/${ev.id}/simulate-payment`, { as: o })).status).toBe(409);
  });
  it('simulate-payment con plazo vencido → 409', async () => {
    const o = await f.organizer();
    const ev = await f.event(o, 'pending_payment', { payment_due_at: new Date(Date.now() - 1000) });
    expect((await post(`/events/${ev.id}/simulate-payment`, { as: o })).status).toBe(409);
  });
  it('cancelar: dueño desde Inscripción o Pendiente; nunca un evento Activo', async () => {
    const o = await f.organizer();
    const reg = await f.event(o), act = await f.event(o, 'active');
    expect((await post(`/events/${reg.id}/cancel`, { as: await f.organizer() })).status).toBe(403);
    expect((await post(`/events/${reg.id}/cancel`, { as: o })).status).toBe(200);
    expect((await post(`/events/${reg.id}/cancel`, { as: o })).status).toBe(409);
    expect((await post(`/events/${act.id}/cancel`, { as: o })).status).toBe(409);
    expect((await db('events').where({ id: act.id }).first()).status).toBe('active');
  });
});

describe('POST /webhooks/stripe', () => {
  const SECRET = 'whsec_test_secret';
  const send = async (payload: object, sig?: string) => {
    const raw = JSON.stringify(payload);
    const app = await getApp();
    return app.inject({
      method: 'POST', url: '/api/webhooks/stripe', payload: raw,
      headers: { 'content-type': 'application/json', 'stripe-signature': sig ?? signStripePayload(raw, SECRET) },
    });
  };
  const paid = (id: string, ev: any, extra: object = {}) => ({
    id, type: 'checkout.session.completed',
    data: { object: { id: ev.checkout_ref, payment_status: 'paid', amount_total: ev.amount_cents, metadata: { event_id: String(ev.id) }, ...extra } },
  });
  const pendingEvent = async () => f.event(await f.organizer(), 'pending_payment', { checkout_ref: `cs_${Math.random()}` });

  it('pago correcto → evento Activo', async () => {
    const ev = await pendingEvent();
    expect((await send(paid('evt_1', ev))).statusCode).toBe(200);
    const row = await db('events').where({ id: ev.id }).first();
    expect(row.status).toBe('active'); expect(row.paid_at).toBeTruthy();
  });
  it('firma inválida → 400 sin cambios', async () => {
    const ev = await pendingEvent();
    expect((await send(paid('evt_1', ev), 't=1,v1=falsa')).statusCode).toBe(400);
    expect((await send(paid('evt_1', ev), signStripePayload('otro cuerpo', SECRET))).statusCode).toBe(400);
    expect((await db('events').where({ id: ev.id }).first()).status).toBe('pending_payment');
    expect(await db('stripe_events').first()).toBeUndefined();
  });
  it('evento repetido no se procesa dos veces (idempotencia)', async () => {
    const ev = await pendingEvent();
    await send(paid('evt_1', ev));
    const paidAt = (await db('events').where({ id: ev.id }).first()).paid_at;
    const again = await send(paid('evt_1', ev));
    expect(again.statusCode).toBe(200);
    expect(again.json().duplicate).toBe(true);
    expect((await db('events').where({ id: ev.id }).first()).paid_at).toEqual(paidAt);
    expect(await db('stripe_events')).toHaveLength(1);
  });
  it('el pago de otro evento no afecta a este', async () => {
    const a = await pendingEvent(), b = await pendingEvent();
    await send(paid('evt_1', a));
    expect((await db('events').where({ id: b.id }).first()).status).toBe('pending_payment');
    // Sesión de A diciendo ser del evento B: no activa B.
    await send({ ...paid('evt_2', a), data: { object: { id: a.checkout_ref, payment_status: 'paid', amount_total: 1000, metadata: { event_id: String(b.id) } } } });
    expect((await db('events').where({ id: b.id }).first()).status).toBe('pending_payment');
  });
  it('importe que no cuadra o pago no completado → no activa', async () => {
    const ev = await pendingEvent();
    await send(paid('evt_1', ev, { amount_total: 1 }));
    await send(paid('evt_2', ev, { payment_status: 'unpaid' }));
    await send({ id: 'evt_3', type: 'charge.refunded', data: { object: {} } });
    expect((await db('events').where({ id: ev.id }).first()).status).toBe('pending_payment');
  });
  it('un evento ya cancelado no se reactiva aunque llegue el pago', async () => {
    const ev = await f.event(await f.organizer(), 'cancelled', { checkout_ref: 'cs_x', amount_cents: 1000 });
    await send(paid('evt_1', ev));
    expect((await db('events').where({ id: ev.id }).first()).status).toBe('cancelled');
  });
});

describe('job: cancelar eventos vencidos', () => {
  it('cancela los pendientes vencidos y no toca el resto', async () => {
    const o = await f.organizer();
    const expired = await f.event(o, 'pending_payment', { payment_due_at: new Date(Date.now() - 60000) });
    const inTime = await f.event(o, 'pending_payment');
    const paidEv = await f.event(o, 'active', { payment_due_at: new Date(Date.now() - 60000), paid_at: new Date() });
    const reg = await f.event(o, 'registration');
    expect(await cancelExpiredEvents()).toBe(1);
    const status = async (e: any) => (await db('events').where({ id: e.id }).first()).status;
    expect(await status(expired)).toBe('cancelled');
    expect(await status(inTime)).toBe('pending_payment');
    expect(await status(paidEv)).toBe('active');
    expect(await status(reg)).toBe('registration');
    expect(await cancelExpiredEvents()).toBe(0);
  });
});
