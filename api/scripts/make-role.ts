/**
 * Cambia el rol de un usuario desde la terminal.
 *   npm run make-role -- ana@ejemplo.com organizer
 *   npm run make-role -- yo@ejemplo.com admin
 *   npm run make-role -- luis@ejemplo.com referee
 */
import { db } from '../src/db';

const [email, role] = process.argv.slice(2);
if (!email || !['user', 'organizer', 'admin', 'referee'].includes(role)) {
  console.error('Uso: npm run make-role -- <email> <user|organizer|admin|referee>');
  process.exit(1);
}
const patch = role === 'referee' ? { is_referee: true } : { role };
const n = await db('users').where({ email: email.toLowerCase() }).update(patch);
console.log(n ? `OK: ${email} → ${role}` : `No existe ningún usuario con el email ${email}`);
await db.destroy();
process.exit(n ? 0 : 1);
