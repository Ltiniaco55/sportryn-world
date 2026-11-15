import { db } from '../src/db';
import { migrate } from '../src/migrations';

await migrate(db);
console.log('Base de datos al día.');
await db.destroy();
