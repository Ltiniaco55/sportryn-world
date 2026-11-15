/** Ciclo de vida del evento: Inscripción → Pendiente de pago → Activo | Cancelado. */
export type EventStatus = 'registration' | 'pending_payment' | 'active' | 'cancelled';

const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  registration: ['pending_payment', 'cancelled'],
  pending_payment: ['active', 'cancelled'],
  active: [],
  cancelled: [],
};

export const canTransition = (from: EventStatus, to: EventStatus) => TRANSITIONS[from]?.includes(to) ?? false;

/** Estados visibles para el público. Pendiente de pago y Cancelado nunca se exponen. */
export const PUBLIC_STATUSES: EventStatus[] = ['registration', 'active'];

/** Mínimo de equipos para poder cerrar la inscripción. */
export const MIN_TEAMS = 2;
