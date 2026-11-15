import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeAll, f, post, reset } from './helpers';

beforeEach(reset);
afterAll(closeAll);

/** Lanza n peticiones y devuelve los códigos de estado. */
const burst = async (n: number, fn: (i: number) => Promise<{ status: number }>) => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((await fn(i)).status);
  return out;
};

describe('rate limiting', () => {
  it('login → 429 tras N intentos (N=5 en test)', async () => {
    const s = await burst(7, () => post('/auth/login', { body: { email: 'x@test.dev', password: 'Incorrecta1' } }));
    expect(s.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(s.slice(5)).toEqual([429, 429]);
  });
  it('registro → 429 tras N intentos (N=25 en test)', async () => {
    const s = await burst(27, (i) => post('/auth/register', { body: { name: 'Ana', email: `a${i}@test.dev`, password: 'Password123' } }));
    expect(s.filter((x) => x === 201)).toHaveLength(25);
    expect(s.slice(25)).toEqual([429, 429]);
  });
  it('inscripciones → 429 tras N intentos (N=12 en test)', async () => {
    const o = await f.organizer(), cap = await f.user();
    const ev = await f.event(o);
    const s = await burst(14, () => post(`/events/${ev.id}/registrations`, { as: cap, body: { team_id: 999999 } }));
    expect(s.slice(0, 12).every((x) => x === 422)).toBe(true);
    expect(s.slice(12)).toEqual([429, 429]);
  });
  it('lista de espera → 429 tras N intentos (N=3 en test)', async () => {
    const s = await burst(4, (i) => post('/waitlist', { body: { name: 'Liga', email: `w${i}@test.dev` } }));
    expect(s).toEqual([201, 201, 201, 429]);
  });
});
