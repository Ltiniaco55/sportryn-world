import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public errors?: Record<string, string[]>) {
    super(message);
  }
}
export const unauthenticated = () => new HttpError(401, 'No autenticado.');
export const forbidden = (m = 'No tienes permiso para esta acción.') => new HttpError(403, m);
export const notFound = (m = 'No encontrado.') => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);
export const invalid = (field: string, m: string) => new HttpError(422, m, { [field]: [m] });

/** Valida con zod. Los campos no declarados se descartan (protege de mass assignment). */
export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  const errors: Record<string, string[]> = {};
  for (const i of r.error.issues) {
    const k = i.path.join('.') || '_';
    (errors[k] ??= []).push(i.message);
  }
  throw new HttpError(422, 'Los datos enviados no son válidos.', errors);
}

export function idParam(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 2147483647) throw notFound();
  return n;
}
