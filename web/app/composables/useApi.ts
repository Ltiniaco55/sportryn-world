export class ApiError extends Error {
  constructor(message: string, public status = 0, public errors: Record<string, string[]> = {}) { super(message); }
}

/** Cliente de la API: añade el token y convierte los errores en mensajes legibles. */
export function useApi() {
  const base = useRuntimeConfig().public.apiBase;
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

export const apiUrl = (path: string) => `${useRuntimeConfig().public.apiBase}/api${path}`;
