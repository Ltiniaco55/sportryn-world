import { describe, expect, it } from 'vitest';
import { calcAmountCents, requiresPayment } from '../src/domain/amount';
import { isOverdue, paymentDueAt } from '../src/domain/deadline';
import { canTransition } from '../src/domain/lifecycle';
import { canClose, canEdit, canReopen, scoreFromEvents } from '../src/domain/report';
import { computeStandings } from '../src/domain/standings';
import { signStripePayload, verifyStripeSignature } from '../src/services/payments';
import { hashPassword, verifyPassword } from '../src/auth';

const closed = (h: number, a: number, hs: number, as: number) => ({ home_team_id: h, away_team_id: a, home_score: hs, away_score: as, report_status: 'closed' });
const teams = [{ id: 1, name: 'Alfa' }, { id: 2, name: 'Beta' }, { id: 3, name: 'Gamma' }];

describe('clasificación', () => {
  it('reparte 3/1/0 puntos', () => {
    const s = computeStandings(teams, [closed(1, 2, 2, 0), closed(2, 3, 1, 1)]);
    const by = Object.fromEntries(s.map((r) => [r.team_id, r]));
    expect(by[1]).toMatchObject({ points: 3, won: 1, played: 1, goals_for: 2, goal_diff: 2 });
    expect(by[2]).toMatchObject({ points: 1, lost: 1, drawn: 1, played: 2, goal_diff: -2 });
    expect(by[3]).toMatchObject({ points: 1, drawn: 1 });
  });
  it('los partidos sin acta cerrada no cuentan', () => {
    const s = computeStandings(teams, [{ ...closed(1, 2, 5, 0), report_status: 'draft' }, { ...closed(1, 3, 1, 0), home_score: null }]);
    expect(s.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });
  it('desempata por diferencia de goles, luego goles a favor, luego nombre', () => {
    // Alfa y Beta ganan un partido cada uno; Beta con mejor diferencia.
    let s = computeStandings([...teams, { id: 4, name: 'Delta' }], [closed(1, 3, 1, 0), closed(2, 4, 4, 0)]);
    expect(s.map((r) => r.team_name).slice(0, 2)).toEqual(['Beta', 'Alfa']);
    // Misma diferencia (+1): gana quien marca más.
    s = computeStandings([...teams, { id: 4, name: 'Delta' }], [closed(1, 3, 1, 0), closed(2, 4, 3, 2)]);
    expect(s[0].team_name).toBe('Beta');
    // Todo igual: orden alfabético.
    s = computeStandings(teams, []);
    expect(s.map((r) => r.team_name)).toEqual(['Alfa', 'Beta', 'Gamma']);
    expect(s.map((r) => r.position)).toEqual([1, 2, 3]);
  });
  it('ignora partidos de equipos que no están en el evento', () => {
    expect(computeStandings(teams, [closed(1, 99, 3, 0)])[0].played).toBe(0);
  });
});

describe('importe', () => {
  it('es nº de equipos × tarifa', () => expect(calcAmountCents(8, 500)).toBe(4000));
  it('con 0 equipos es 0 y no hay cobro', () => {
    expect(calcAmountCents(0, 500)).toBe(0);
    expect(requiresPayment(0, 500)).toBe(false);
    expect(requiresPayment(1, 500)).toBe(true);
  });
  it('rechaza valores inválidos', () => {
    expect(() => calcAmountCents(-1, 500)).toThrow();
    expect(() => calcAmountCents(2.5, 500)).toThrow();
    expect(() => calcAmountCents(2, -1)).toThrow();
  });
});

describe('ciclo de vida del evento', () => {
  it('permite las transiciones válidas', () => {
    expect(canTransition('registration', 'pending_payment')).toBe(true);
    expect(canTransition('pending_payment', 'active')).toBe(true);
    expect(canTransition('pending_payment', 'cancelled')).toBe(true);
    expect(canTransition('registration', 'cancelled')).toBe(true);
  });
  it('rechaza las inválidas', () => {
    expect(canTransition('cancelled', 'active')).toBe(false);
    expect(canTransition('registration', 'active')).toBe(false); // no se puede saltar el pago
    expect(canTransition('active', 'registration')).toBe(false);
    expect(canTransition('active', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'registration')).toBe(false);
  });
});

describe('acta', () => {
  it('borrador → cerrada, nunca al revés salvo reapertura', () => {
    expect(canClose('draft')).toBe(true);
    expect(canClose('closed')).toBe(false);
    expect(canEdit('closed')).toBe(false);
    expect(canReopen('closed')).toBe(true);
    expect(canReopen('draft')).toBe(false);
  });
  it('el resultado se deriva de los goles registrados', () => {
    const ev = [{ type: 'goal', team_id: 1 }, { type: 'goal', team_id: 1 }, { type: 'goal', team_id: 2 }, { type: 'yellow', team_id: 2 }, { type: 'goal', team_id: 9 }];
    expect(scoreFromEvents(ev, 1, 2)).toEqual({ home: 2, away: 1 });
    expect(scoreFromEvents([], 1, 2)).toEqual({ home: 0, away: 0 });
  });
});

describe('plazo de pago (Europe/Madrid)', () => {
  it('vence a las 23:59:59 de Madrid del día N', () => {
    // 10 ene 2026 12:00 UTC (invierno, UTC+1) + 7 días → 17 ene 23:59:59 Madrid = 22:59:59 UTC
    expect(paymentDueAt(new Date('2026-01-10T12:00:00Z'), 7).toISOString()).toBe('2026-01-17T22:59:59.000Z');
  });
  it('en verano Madrid es UTC+2', () => {
    expect(paymentDueAt(new Date('2026-07-01T10:00:00Z'), 7).toISOString()).toBe('2026-07-08T21:59:59.000Z');
  });
  it('usa el día de Madrid, no el de UTC, cerca de medianoche', () => {
    // 23:30 UTC del día 10 ya es día 11 en Madrid.
    expect(paymentDueAt(new Date('2026-01-10T23:30:00Z'), 1).toISOString()).toBe('2026-01-12T22:59:59.000Z');
  });
  it('atraviesa el cambio de hora correctamente', () => {
    // Cierre el 24 mar 2026 (UTC+1); el plazo cae el 31 mar, ya en horario de verano (UTC+2).
    expect(paymentDueAt(new Date('2026-03-24T12:00:00Z'), 7).toISOString()).toBe('2026-03-31T21:59:59.000Z');
  });
  it('detecta plazos vencidos', () => {
    expect(isOverdue(new Date(Date.now() - 1000))).toBe(true);
    expect(isOverdue(new Date(Date.now() + 60000))).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });
});

describe('seguridad básica', () => {
  it('firma de Stripe: acepta la correcta y rechaza manipulada, caducada o ausente', () => {
    const body = '{"id":"evt_1"}';
    const sig = signStripePayload(body, 'whsec_x');
    expect(verifyStripeSignature(body, sig, 'whsec_x')).toBe(true);
    expect(verifyStripeSignature(body + ' ', sig, 'whsec_x')).toBe(false);
    expect(verifyStripeSignature(body, sig, 'otro_secreto')).toBe(false);
    expect(verifyStripeSignature(body, undefined, 'whsec_x')).toBe(false);
    expect(verifyStripeSignature(body, 'basura', 'whsec_x')).toBe(false);
    expect(verifyStripeSignature(body, signStripePayload(body, 'whsec_x', 1000), 'whsec_x')).toBe(false);
    expect(verifyStripeSignature(body, sig, '')).toBe(false);
  });
  it('contraseñas: hash con sal, verificación correcta', () => {
    const h = hashPassword('Secreta123');
    expect(h).not.toContain('Secreta123');
    expect(hashPassword('Secreta123')).not.toBe(h);
    expect(verifyPassword('Secreta123', h)).toBe(true);
    expect(verifyPassword('secreta123', h)).toBe(false);
    expect(verifyPassword('x', 'formato-raro')).toBe(false);
  });
});
