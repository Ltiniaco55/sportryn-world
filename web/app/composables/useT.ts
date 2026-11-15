/**
 * Traducciones ES/EN. Para traducir un texto nuevo: añádelo a ambos diccionarios y usa t('clave').
 * Los textos que aún no pasan por t() están en español.
 */
const dict: Record<string, Record<string, string>> = {
  es: {
    'nav.discover': 'Descubrir', 'nav.organize': 'Organizar', 'nav.referee': 'Arbitrar', 'nav.account': 'Cuenta',
    'status.registration': 'Inscripción abierta', 'status.pending_payment': 'Pendiente de pago', 'status.active': 'En juego', 'status.cancelled': 'Cancelado',
    'type.league': 'Liga', 'type.tournament': 'Torneo',
    'format.f5': 'Fútbol 5', 'format.f7': 'Fútbol 7', 'format.f11': 'Fútbol 11', 'format.futsal': 'Fútbol sala',
    'common.teams': 'equipos', 'common.login': 'Entrar', 'common.logout': 'Cerrar sesión', 'common.save': 'Guardar',
    'tab.summary': 'Resumen', 'tab.calendar': 'Calendario', 'tab.standings': 'Clasificación', 'tab.scorers': 'Goleadores', 'tab.photos': 'Fotos',
  },
  en: {
    'nav.discover': 'Discover', 'nav.organize': 'Organize', 'nav.referee': 'Referee', 'nav.account': 'Account',
    'status.registration': 'Registration open', 'status.pending_payment': 'Payment pending', 'status.active': 'Live', 'status.cancelled': 'Cancelled',
    'type.league': 'League', 'type.tournament': 'Tournament',
    'format.f5': '5-a-side', 'format.f7': '7-a-side', 'format.f11': '11-a-side', 'format.futsal': 'Futsal',
    'common.teams': 'teams', 'common.login': 'Log in', 'common.logout': 'Log out', 'common.save': 'Save',
    'tab.summary': 'Overview', 'tab.calendar': 'Fixtures', 'tab.standings': 'Standings', 'tab.scorers': 'Top scorers', 'tab.photos': 'Photos',
  },
};

export function useT() {
  const locale = useState('ui.locale', () => 'es');
  const t = (key: string) => dict[locale.value]?.[key] ?? dict.es?.[key] ?? key;
  function setLocale(l: string) {
    locale.value = l;
    try { localStorage.setItem('sportryn_locale', l); } catch { /* sin almacenamiento */ }
  }
  return { t, locale, setLocale };
}
