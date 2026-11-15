/** Desfase (ms) de una zona horaria respecto a UTC en un instante dado. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Fecha límite de pago: las 23:59:59 (hora local de la zona) del día que resulta
 * de sumar `days` días naturales a la fecha de cierre. Tiene en cuenta el cambio de hora.
 */
export function paymentDueAt(closedAt: Date, days: number, timeZone = 'Europe/Madrid'): Date {
  const local = new Date(closedAt.getTime() + tzOffsetMs(closedAt, timeZone));
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate() + days;
  const guess = new Date(Date.UTC(y, m, d, 23, 59, 59));
  return new Date(guess.getTime() - tzOffsetMs(guess, timeZone));
}

export const isOverdue = (dueAt: Date | string | null, now = new Date()) =>
  dueAt != null && new Date(dueAt).getTime() < now.getTime();
