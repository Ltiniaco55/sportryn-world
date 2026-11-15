/** Importe que paga el organizador: nº de equipos × tarifa. Sin equipos no hay cobro. */
export function calcAmountCents(teams: number, feeCents: number): number {
  if (!Number.isInteger(teams) || teams < 0) throw new Error('Número de equipos inválido');
  if (!Number.isInteger(feeCents) || feeCents < 0) throw new Error('Tarifa inválida');
  return teams * feeCents;
}
export const requiresPayment = (teams: number, feeCents: number) => calcAmountCents(teams, feeCents) > 0;
