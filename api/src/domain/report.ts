export type ReportStatus = 'draft' | 'closed';
export const MATCH_EVENT_TYPES = ['goal', 'yellow', 'red'] as const;
export const MAX_MINUTE = 130;

/** El resultado NO se escribe a mano: se deriva de los goles registrados en el acta. */
export function scoreFromEvents(
  events: { type: string; team_id: number }[], homeTeamId: number, awayTeamId: number,
): { home: number; away: number } {
  let home = 0, away = 0;
  for (const e of events) {
    if (e.type !== 'goal') continue;
    if (e.team_id === homeTeamId) home++;
    else if (e.team_id === awayTeamId) away++;
  }
  return { home, away };
}

/** borrador → cerrada (cualquiera con permiso). cerrada → borrador solo vía reapertura auditada. */
export const canClose = (status: ReportStatus) => status === 'draft';
export const canEdit = (status: ReportStatus) => status === 'draft';
export const canReopen = (status: ReportStatus) => status === 'closed';
