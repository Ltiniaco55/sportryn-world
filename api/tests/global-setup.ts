import knex from 'knex';
import { migrate } from '../src/migrations';

export default async function () {
  const db = knex({ client: 'pg', connection: process.env.DATABASE_URL });
  await db.raw('drop schema public cascade; create schema public;');
  await migrate(db);
  await db.destroy();
}
