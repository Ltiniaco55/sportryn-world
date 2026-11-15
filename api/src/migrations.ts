import type { Knex } from 'knex';

/**
 * Migraciones en código. Para cambiar el esquema, AÑADE una entrada nueva al final
 * (nunca edites una ya aplicada) y ejecuta `npm run migrate`.
 */
const migrations: { name: string; up: (k: Knex) => Promise<void> }[] = [
  {
    name: '001_init',
    async up(k) {
      await k.schema.createTable('users', (t) => {
        t.increments('id');
        t.string('name', 120).notNullable();
        t.string('email', 190).notNullable().unique();
        t.string('password_hash', 255).notNullable();
        t.string('role', 20).notNullable().defaultTo('user'); // user | organizer | admin
        t.boolean('is_referee').notNullable().defaultTo(false);
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
      });
      await k.schema.createTable('tokens', (t) => {
        t.increments('id');
        t.integer('user_id').notNullable().references('users.id').onDelete('CASCADE');
        t.string('token_hash', 64).notNullable().unique();
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
      });
      await k.schema.createTable('cities', (t) => {
        t.increments('id');
        t.string('name', 80).notNullable();
        t.string('slug', 80).notNullable().unique();
        t.string('country', 2).notNullable().defaultTo('ES');
        t.double('lat').notNullable();
        t.double('lng').notNullable();
        t.integer('team_fee_cents').notNullable().defaultTo(500);
        t.string('currency', 3).notNullable().defaultTo('eur');
        t.integer('payment_days').notNullable().defaultTo(7);
        t.boolean('is_active').notNullable().defaultTo(true);
      });
      await k.schema.createTable('events', (t) => {
        t.increments('id');
        t.integer('city_id').notNullable().references('cities.id');
        t.integer('organizer_id').notNullable().references('users.id');
        t.string('name', 120).notNullable();
        t.string('type', 20).notNullable(); // league | tournament
        t.string('format', 10).notNullable().defaultTo('f7'); // f5 | f7 | f11 | futsal
        t.text('description');
        t.string('status', 20).notNullable().defaultTo('registration').index();
        t.integer('team_fee_cents').notNullable();
        t.string('currency', 3).notNullable();
        t.integer('payment_days').notNullable();
        t.integer('amount_cents');
        t.timestamp('registration_closed_at', { useTz: true });
        t.timestamp('payment_due_at', { useTz: true });
        t.timestamp('paid_at', { useTz: true });
        t.string('checkout_ref', 255);
        t.date('starts_on');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
      });
      await k.schema.createTable('teams', (t) => {
        t.increments('id');
        t.string('name', 80).notNullable();
        t.string('short_name', 4);
        t.string('color', 7).notNullable().defaultTo('#C6F432');
        t.integer('captain_id').notNullable().references('users.id');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
      });
      await k.schema.createTable('players', (t) => {
        t.increments('id');
        t.integer('team_id').notNullable().references('teams.id').onDelete('CASCADE').index();
        t.string('first_name', 60).notNullable();
        t.string('last_name', 60).notNullable();
        t.integer('number');
      });
      await k.schema.createTable('registrations', (t) => {
        t.increments('id');
        t.integer('event_id').notNullable().references('events.id').onDelete('CASCADE');
        t.integer('team_id').notNullable().references('teams.id');
        t.boolean('paid_to_organizer').notNullable().defaultTo(false);
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
        t.unique(['event_id', 'team_id']);
      });
      await k.schema.createTable('venues', (t) => {
        t.increments('id');
        t.integer('city_id').notNullable().references('cities.id');
        t.integer('created_by').notNullable().references('users.id');
        t.string('name', 120).notNullable();
        t.string('address', 200);
        t.double('lat').notNullable();
        t.double('lng').notNullable();
        t.index(['lat', 'lng']);
      });
      await k.schema.createTable('matches', (t) => {
        t.increments('id');
        t.integer('event_id').notNullable().references('events.id').onDelete('CASCADE').index();
        t.integer('home_team_id').notNullable().references('teams.id');
        t.integer('away_team_id').notNullable().references('teams.id');
        t.integer('venue_id').references('venues.id');
        t.timestamp('scheduled_at', { useTz: true }).notNullable();
        t.integer('round');
        t.string('report_status', 10).notNullable().defaultTo('draft'); // draft | closed
        t.integer('home_score');
        t.integer('away_score');
        t.timestamp('closed_at', { useTz: true });
        t.integer('closed_by').references('users.id');
      });
      await k.schema.createTable('match_referees', (t) => {
        t.integer('match_id').notNullable().references('matches.id').onDelete('CASCADE');
        t.integer('user_id').notNullable().references('users.id');
        t.primary(['match_id', 'user_id']);
      });
      await k.schema.createTable('organizer_referees', (t) => {
        t.integer('organizer_id').notNullable().references('users.id');
        t.integer('user_id').notNullable().references('users.id');
        t.primary(['organizer_id', 'user_id']);
      });
      await k.schema.createTable('match_events', (t) => {
        t.increments('id');
        t.integer('match_id').notNullable().references('matches.id').onDelete('CASCADE').index();
        t.integer('team_id').notNullable().references('teams.id');
        t.integer('player_id').notNullable().references('players.id');
        t.string('type', 10).notNullable(); // goal | yellow | red
        t.integer('minute').notNullable();
      });
      await k.schema.createTable('report_audits', (t) => {
        t.increments('id');
        t.integer('match_id').notNullable().references('matches.id').onDelete('CASCADE');
        t.integer('user_id').notNullable().references('users.id');
        t.string('action', 20).notNullable(); // closed | reopened
        t.text('reason');
        t.jsonb('snapshot');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
      });
      await k.schema.createTable('posts', (t) => {
        t.increments('id');
        t.integer('event_id').notNullable().references('events.id').onDelete('CASCADE').index();
        t.integer('user_id').notNullable().references('users.id');
        t.text('body');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
      });
      await k.schema.createTable('media', (t) => {
        t.increments('id');
        t.integer('post_id').notNullable().references('posts.id').onDelete('CASCADE');
        t.string('filename', 80).notNullable();
        t.integer('width');
        t.integer('height');
      });
      await k.schema.createTable('follows', (t) => {
        t.integer('user_id').notNullable().references('users.id').onDelete('CASCADE');
        t.integer('event_id').notNullable().references('events.id').onDelete('CASCADE');
        t.primary(['user_id', 'event_id']);
      });
      await k.schema.createTable('stripe_events', (t) => {
        t.string('id', 255).primary();
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
      });
      await k.schema.createTable('waitlist', (t) => {
        t.increments('id');
        t.string('name', 120).notNullable();
        t.string('email', 190).notNullable().unique();
        t.string('league_name', 120);
        t.string('city', 80);
        t.integer('teams_count');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(k.fn.now());
      });
    },
  },
];

export async function migrate(k: Knex) {
  await k.migrate.latest({
    migrationSource: {
      getMigrations: async () => migrations,
      getMigrationName: (m: any) => m.name,
      getMigration: async (m: any) => ({ up: m.up, down: async () => {} }),
    },
  });
}
