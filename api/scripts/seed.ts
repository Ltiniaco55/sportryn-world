/**
 * Datos de demostración. Es idempotente: si ya hay usuarios, no hace nada.
 * Todas las cuentas demo usan la contraseña: Sportryn123
 */
import { db } from '../src/db';
import { migrate } from '../src/migrations';
import { hashPassword } from '../src/auth';
import { scoreFromEvents } from '../src/domain/report';

await migrate(db);

if (!(await db('cities').first())) {
  await db('cities').insert([
    { name: 'Madrid', slug: 'madrid', country: 'ES', lat: 40.4168, lng: -3.7038, is_active: true },
    { name: 'Barcelona', slug: 'barcelona', country: 'ES', lat: 41.3874, lng: 2.1686, is_active: false },
    { name: 'Atlanta', slug: 'atlanta', country: 'US', lat: 33.749, lng: -84.388, currency: 'usd', is_active: false },
    { name: 'Orlando', slug: 'orlando', country: 'US', lat: 28.5384, lng: -81.3789, currency: 'usd', is_active: false },
  ]);
  console.log('Ciudades creadas (solo Madrid activa).');
}

if (await db('users').first()) {
  console.log('Ya hay usuarios: no se cargan datos demo.');
  await db.destroy();
  process.exit(0);
}

const password_hash = hashPassword('Sportryn123');
const mk = async (name: string, email: string, extra: object = {}) =>
  (await db('users').insert({ name, email, password_hash, ...extra }).returning('*'))[0];

await mk('Admin Sportryn', 'admin@sportryn.test', { role: 'admin' });
const organizer = await mk('Olga Organizadora', 'organizador@sportryn.test', { role: 'organizer' });
const referee = await mk('Álex Árbitro', 'arbitro@sportryn.test', { is_referee: true });
const captain = await mk('Carla Capitana', 'capitan@sportryn.test');
await mk('Pablo Público', 'usuario@sportryn.test');
await db('organizer_referees').insert({ organizer_id: organizer.id, user_id: referee.id });

const madrid = await db('cities').where({ slug: 'madrid' }).first();
const base = { city_id: madrid.id, organizer_id: organizer.id, team_fee_cents: madrid.team_fee_cents, currency: madrid.currency, payment_days: madrid.payment_days };

const teamDefs: [string, string, string][] = [
  ['Leones de Lavapiés', 'LEO', '#F4B400'], ['Chamberí United', 'CHU', '#4F8DF7'], ['Vallekas Norte', 'VKN', '#E5484D'],
  ['Retiro FC', 'RET', '#30A46C'], ['Arganzuela 09', 'ARG', '#C6F432'], ['Tetuán Calle', 'TET', '#B07CF7'],
];
const firstNames = ['Hugo', 'Mateo', 'Leo', 'Dani', 'Iker', 'Álvaro', 'Nico', 'Sergio', 'Javi', 'Marcos'];
const lastNames = ['García', 'Ruiz', 'Moreno', 'Navarro', 'Torres', 'Gil', 'Serrano', 'Molina', 'Castro', 'Ortega', 'Rubio', 'Marín'];
const teams: any[] = [];
for (const [i, [name, short_name, color]] of teamDefs.entries()) {
  const [team] = await db('teams').insert({ name, short_name, color, captain_id: captain.id }).returning('*');
  team.players = await db('players').insert(
    Array.from({ length: 8 }, (_, n) => ({ team_id: team.id, first_name: firstNames[(i * 3 + n) % 10], last_name: lastNames[(i * 5 + n) % 12], number: n + 1 })),
  ).returning('*');
  teams.push(team);
}

const venues = await db('venues').insert([
  { city_id: madrid.id, created_by: organizer.id, name: 'Campo Demo Arganzuela', address: 'Zona Madrid Río (dato de ejemplo)', lat: 40.3985, lng: -3.7102 },
  { city_id: madrid.id, created_by: organizer.id, name: 'Campo Demo Retiro Sur', address: 'Junto al Retiro (dato de ejemplo)', lat: 40.4068, lng: -3.6769 },
  { city_id: madrid.id, created_by: organizer.id, name: 'Campo Demo Chamartín', address: 'Zona norte (dato de ejemplo)', lat: 40.4612, lng: -3.6823 },
]).returning('*');

// 1) Liga ACTIVA con calendario, actas cerradas y partidos pendientes.
const [league] = await db('events').insert({
  ...base, name: 'Liga Fundadora Madrid Río', type: 'league', format: 'f7', status: 'active',
  description: 'Liga de fútbol 7 de demostración. Jornadas los domingos por la mañana.',
  amount_cents: teams.length * madrid.team_fee_cents, paid_at: new Date(), registration_closed_at: new Date(), starts_on: new Date().toISOString().slice(0, 10),
}).returning('*');
await db('registrations').insert(teams.map((t) => ({ event_id: league.id, team_id: t.id, paid_to_organizer: true })));

const day = 24 * 3600 * 1000;
const pairs = [[0, 1], [2, 3], [4, 5], [0, 2], [1, 4], [3, 5], [0, 3], [1, 5], [2, 4]];
const results = [[3, 1], [2, 2], [0, 1], [1, 0], [4, 2], [2, 3]]; // las 6 primeras ya jugadas
for (const [i, [h, a]] of pairs.entries()) {
  const round = Math.floor(i / 3) + 1;
  const played = i < results.length;
  const scheduled_at = new Date(Date.now() + (played ? -(14 - (round - 1) * 7) : 7) * day);
  scheduled_at.setUTCHours(9 + (i % 3), 0, 0, 0); // 10:00, 11:00 y 12:00 en Madrid (invierno)
  const [match] = await db('matches').insert({
    event_id: league.id, home_team_id: teams[h].id, away_team_id: teams[a].id, venue_id: venues[i % 3].id, scheduled_at, round,
  }).returning('*');
  await db('match_referees').insert({ match_id: match.id, user_id: referee.id });
  if (!played) continue;
  const evs: any[] = [];
  const add = (team: any, goals: number) => {
    for (let g = 0; g < goals; g++) evs.push({ match_id: match.id, team_id: team.id, player_id: team.players[(g * 2 + i) % 8].id, type: 'goal', minute: 5 + ((g * 17 + i * 7) % 45) });
  };
  add(teams[h], results[i][0]); add(teams[a], results[i][1]);
  evs.push({ match_id: match.id, team_id: teams[a].id, player_id: teams[a].players[3].id, type: 'yellow', minute: 30 });
  await db('match_events').insert(evs);
  const s = scoreFromEvents(evs, teams[h].id, teams[a].id);
  await db('matches').where({ id: match.id }).update({ report_status: 'closed', home_score: s.home, away_score: s.away, closed_at: new Date(), closed_by: referee.id });
  await db('report_audits').insert({ match_id: match.id, user_id: referee.id, action: 'closed', snapshot: JSON.stringify(s) });
}
await db('posts').insert({ event_id: league.id, user_id: organizer.id, body: '¡Arranca la Liga Fundadora! Jornada 1 este domingo en Madrid Río.' });

// 2) Torneo con INSCRIPCIÓN ABIERTA.
const [cup] = await db('events').insert({
  ...base, name: 'Torneo Relámpago Chamartín', type: 'tournament', format: 'f5', status: 'registration',
  description: 'Torneo de un día. Inscripción abierta para equipos.',
}).returning('*');
await db('registrations').insert(teams.slice(0, 2).map((t) => ({ event_id: cup.id, team_id: t.id })));

// 3) Liga PENDIENTE DE PAGO (para probar el pago simulado).
const [pending] = await db('events').insert({
  ...base, name: 'Liga de Invierno Vallecas', type: 'league', format: 'f7', status: 'pending_payment',
  amount_cents: 4 * madrid.team_fee_cents, registration_closed_at: new Date(), payment_due_at: new Date(Date.now() + 7 * day),
}).returning('*');
await db('registrations').insert(teams.slice(2, 6).map((t) => ({ event_id: pending.id, team_id: t.id })));

console.log('Datos demo cargados. Cuentas (contraseña Sportryn123):');
console.log('  admin@sportryn.test · organizador@sportryn.test · arbitro@sportryn.test · capitan@sportryn.test · usuario@sportryn.test');
await db.destroy();
