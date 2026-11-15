import { db } from '../src/db';
import { cancelExpiredEvents } from '../src/services/payments';

console.log(`Eventos cancelados por impago: ${await cancelExpiredEvents()}`);
await db.destroy();
