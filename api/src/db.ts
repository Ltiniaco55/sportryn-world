import knex from 'knex';
import pg from 'pg';
import { config } from './config';

// DATE como texto 'YYYY-MM-DD' (sin conversiones de zona horaria) y COUNT como número.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export const db = knex({ client: 'pg', connection: config.databaseUrl, pool: { min: 0, max: 10 } });
