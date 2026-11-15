import { buildApp } from './app';
import { config } from './config';
import { db } from './db';
import { migrate } from './migrations';
import { cancelExpiredEvents } from './services/payments';

const app = await buildApp();
await migrate(db);

// Job: cancela eventos con el plazo de pago vencido (al arrancar y cada 10 minutos).
const sweep = () => cancelExpiredEvents().then((n) => n && app.log.info(`Eventos cancelados por impago: ${n}`)).catch((e) => app.log.error(e));
sweep();
setInterval(sweep, 10 * 60 * 1000).unref();

await app.listen({ port: config.port, host: '0.0.0.0' });
