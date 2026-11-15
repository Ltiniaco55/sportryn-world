import { db } from './db';
import type { AuthUser } from './auth';
import { forbidden } from './errors';

/**
 * AUTORIZACIÓN CENTRALIZADA. Toda regla de "quién puede hacer qué" vive aquí.
 * Los controladores nunca comparan ids por su cuenta: llaman a authorize().
 */
export const policies = {
  /** Crear eventos, sedes y dar de alta árbitros: solo organizadores (o admin). */
  actAsOrganizer: (u: AuthUser) => u.role === 'organizer' || u.role === 'admin',

  /** Gestionar un evento: solo su organizador (o admin). */
  manageEvent: (u: AuthUser, event: { organizer_id: number }) => u.role === 'admin' || event.organizer_id === u.id,

  /** Gestionar un equipo y su plantilla: solo su capitán. */
  manageTeam: (u: AuthUser, team: { captain_id: number }) => team.captain_id === u.id,

  /** Editar una sede: quien la creó (o admin). */
  manageVenue: (u: AuthUser, venue: { created_by: number }) => u.role === 'admin' || venue.created_by === u.id,

  /** Borrar una inscripción: el organizador del evento o el capitán del equipo. */
  deleteRegistration: (u: AuthUser, event: { organizer_id: number }, team: { captain_id: number }) =>
    policies.manageEvent(u, event) || policies.manageTeam(u, team),

  /** Ver y editar el acta: árbitro ASIGNADO a ese partido, o el organizador del evento. */
  async editReport(u: AuthUser, match: { id: number }, event: { organizer_id: number }) {
    if (policies.manageEvent(u, event)) return true;
    return policies.isAssignedReferee(u, match);
  },

  async isAssignedReferee(u: AuthUser, match: { id: number }) {
    if (!u.is_referee) return false;
    return !!(await db('match_referees').where({ match_id: match.id, user_id: u.id }).first());
  },

  /** Reabrir un acta cerrada: solo el organizador del evento. Nunca el árbitro. */
  reopenReport: (u: AuthUser, event: { organizer_id: number }) => policies.manageEvent(u, event),

  admin: (u: AuthUser) => u.role === 'admin',
};

export function authorize(allowed: boolean) {
  if (!allowed) throw forbidden();
}
