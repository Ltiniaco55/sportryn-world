// Al abrir la app: recupera la sesión guardada y el idioma.
export default defineNuxtPlugin(async () => {
  const auth = useAuth();
  const { locale } = useT();
  try { locale.value = localStorage.getItem('sportryn_locale') ?? 'es'; } catch { /* sin almacenamiento */ }
  const saved = auth.stored();
  if (!saved) return;
  auth.token.value = saved;
  try {
    auth.user.value = (await useApi()('/me')).user;
  } catch (e: any) {
    if (e?.status === 401) auth.clear(); // sin conexión se conserva el token
  }
});
