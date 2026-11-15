import crypto from 'node:crypto';
import { config } from '../config';
import { db } from '../db';
import { HttpError } from '../errors';

export interface CheckoutResult { url: string; ref: string }

/**
 * Crea la sesión de pago del organizador. El importe SIEMPRE sale de la BD
 * (equipos × tarifa calculado al cerrar la inscripción), nunca del cliente.
 */
export async function createCheckout(event: any, teams: number): Promise<CheckoutResult> {
  if (config.paymentsDriver === 'fake') {
    return { url: `${config.appUrl}/pago-simulado?event=${event.id}`, ref: `fake_${event.id}_${Date.now()}` };
  }
  if (!config.stripeSecretKey) throw new HttpError(500, 'Stripe no está configurado (falta STRIPE_SECRET_KEY).');
  const body = new URLSearchParams({
    mode: 'payment',
    success_url: `${config.appUrl}/organizador/eventos/${event.id}?pago=ok`,
    cancel_url: `${config.appUrl}/organizador/eventos/${event.id}?pago=cancelado`,
    client_reference_id: String(event.id),
    'metadata[event_id]': String(event.id),
    'line_items[0][quantity]': String(teams),
    'line_items[0][price_data][currency]': event.currency,
    'line_items[0][price_data][unit_amount]': String(event.team_fee_cents),
    'line_items[0][price_data][product_data][name]': `Sportryn · ${event.name} · equipo inscrito`,
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json: any = await res.json();
  if (!res.ok) throw new HttpError(502, `Stripe rechazó la petición: ${json?.error?.message ?? res.status}`);
  return { url: json.url, ref: json.id };
}

/** Verifica la cabecera Stripe-Signature (HMAC-SHA256 de "timestamp.payload"). */
export function verifyStripeSignature(rawBody: string, header: string | undefined, secret: string, toleranceSec = 300, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || !/^\d+$/.test(t)) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export function signStripePayload(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`;
}

/** Pendiente de pago → Activo. Idempotente: si ya no está pendiente, no hace nada. */
export async function activateEvent(eventId: number): Promise<boolean> {
  const n = await db('events').where({ id: eventId, status: 'pending_payment' })
    .update({ status: 'active', paid_at: db.fn.now() });
  return n > 0;
}

/** Job: cancela los eventos cuyo plazo de pago ha vencido. Devuelve cuántos canceló. */
export async function cancelExpiredEvents(now = new Date()): Promise<number> {
  return db('events').where('status', 'pending_payment').where('payment_due_at', '<', now).update({ status: 'cancelled' });
}
