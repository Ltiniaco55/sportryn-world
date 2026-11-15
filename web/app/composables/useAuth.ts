const KEY = 'sportryn_token';

/** Sesión del usuario. El token se guarda en el dispositivo y se envía como Bearer. */
export function useAuth() {
  const token = useState<string | null>('auth.token', () => null);
  const user = useState<any | null>('auth.user', () => null);

  function set(t: string, u: any) {
    token.value = t; user.value = u;
    try { localStorage.setItem(KEY, t); } catch { /* almacenamiento no disponible */ }
  }
  function clear() {
    token.value = null; user.value = null;
    try { localStorage.removeItem(KEY); } catch { /* almacenamiento no disponible */ }
  }
  function stored(): string | null {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
  return {
    token, user, set, clear, stored,
    isOrganizer: computed(() => ['organizer', 'admin'].includes(user.value?.role)),
    isReferee: computed(() => !!user.value?.is_referee),
    isAdmin: computed(() => user.value?.role === 'admin'),
  };
}
