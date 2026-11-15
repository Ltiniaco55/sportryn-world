export interface TeamRef { id: number; name: string }
export interface MatchResult {
  home_team_id: number; away_team_id: number;
  home_score: number | null; away_score: number | null;
  report_status: string;
}
export interface StandingRow {
  position: number; team_id: number; team_name: string;
  played: number; won: number; drawn: number; lost: number;
  goals_for: number; goals_against: number; goal_diff: number; points: number;
}

/**
 * Clasificación calculada a partir de resultados. Solo cuentan partidos con acta cerrada.
 * 3 puntos victoria, 1 empate, 0 derrota.
 * Desempate: puntos → diferencia de goles → goles a favor → nombre (alfabético).
 */
export function computeStandings(teams: TeamRef[], matches: MatchResult[]): StandingRow[] {
  const rows = new Map<number, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, {
      position: 0, team_id: t.id, team_name: t.name, played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, goal_diff: 0, points: 0,
    });
  }
  for (const m of matches) {
    if (m.report_status !== 'closed' || m.home_score == null || m.away_score == null) continue;
    const h = rows.get(m.home_team_id), a = rows.get(m.away_team_id);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.goals_for += m.home_score; h.goals_against += m.away_score;
    a.goals_for += m.away_score; a.goals_against += m.home_score;
    if (m.home_score > m.away_score) { h.won++; h.points += 3; a.lost++; }
    else if (m.home_score < m.away_score) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  const list = [...rows.values()];
  for (const r of list) r.goal_diff = r.goals_for - r.goals_against;
  list.sort((x, y) =>
    y.points - x.points || y.goal_diff - x.goal_diff || y.goals_for - x.goals_for ||
    x.team_name.localeCompare(y.team_name, 'es'));
  list.forEach((r, i) => (r.position = i + 1));
  return list;
}
