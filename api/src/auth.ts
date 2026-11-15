import crypto from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { db } from './db';

export interface AuthUser { id: number; name: string; email: string; role: 'user' | 'organizer' | 'admin'; is_referee: boolean }

declare module 'fastify' {
  interface FastifyRequest { user?: AuthUser; rawBody?: string }
  interface FastifyContextConfig { public?: boolean }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** Hash de relleno para que el login tarde lo mismo exista o no el email. */
const DUMMY_HASH = hashPassword('sportryn-dummy-password');
export const burnPasswordCheck = (password: string) => verifyPassword(password, DUMMY_HASH);

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Tokens opacos: el cliente recibe el valor una vez; en BD solo se guarda su hash. */
export async function issueToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db('tokens').insert({ user_id: userId, token_hash: sha256(token) });
  return token;
}

export function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7).trim() || null : null;
}

export async function userFromRequest(req: FastifyRequest): Promise<AuthUser | null> {
  const token = bearer(req);
  if (!token) return null;
  const row = await db('tokens').join('users', 'users.id', 'tokens.user_id')
    .where('tokens.token_hash', sha256(token))
    .first('users.id', 'users.name', 'users.email', 'users.role', 'users.is_referee');
  return row ?? null;
}

export async function revokeToken(req: FastifyRequest) {
  const token = bearer(req);
  if (token) await db('tokens').where('token_hash', sha256(token)).delete();
}

export const publicUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, is_referee: !!u.is_referee });
