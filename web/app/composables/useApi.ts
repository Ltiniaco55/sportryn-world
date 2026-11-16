export class ApiError extends Error {
  constructor(message: string, public status = 0, public errors: Record<string, string[]> = {}) { super(message); }
}

/** Cliente de la API: añade el token y convierte los errores en mensajes legibles. */
export function useApi() {
  const base = apiBase();
  const auth = useAuth();
  return async function api<T = any>(path: string, opts: Record<string, any> = {}): Promise<T> {
    try {
      return await $fetch<T>(`${base}/api${path}`, {
        ...opts,
        headers: { ...(auth.token.value ? { Authorization: `Bearer ${auth.token.value}` } : {}), ...(opts.headers ?? {}) },
      });
    } catch (e: any) {
      const status = e?.response?.status ?? 0;
      if (status === 401 && auth.token.value && !path.startsWith('/auth/')) auth.clear();
      const errors = e?.data?.errors ?? {};
      const first = Object.values(errors)[0] as string[] | undefined;
      throw new ApiError(first?.[0] ?? e?.data?.message ?? 'No se pudo conectar con el servidor.', status, errors);
    }
  };
}

const LOCAL = /\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/;

/**
 * En desarrollo la API está en "localhost". Si abres la app desde otro dispositivo de la
 * misma red (http://IP-del-PC:3005), "localhost" sería el móvil: se sustituye por la IP del PC.
 */
export function localToHost(url: string): string {
  if (!import.meta.client || !url || ['localhost', '127.0.0.1'].includes(location.hostname)) return url;
  return url.replace(LOCAL, `//${location.hostname}`);
}
export const apiBase = () => localToHost(String(useRuntimeConfig().public.apiBase));
export const apiUrl = (path: string) => `${apiBase()}/api${path}`;
