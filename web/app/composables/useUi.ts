/** Aviso breve en pantalla. */
export function useToast() {
  const toast = useState<{ text: string; err: boolean } | null>('ui.toast', () => null);
  let timer: any;
  return {
    toast,
    show(text: string, err = false) {
      toast.value = { text, err };
      clearTimeout(timer);
      timer = setTimeout(() => (toast.value = null), 3200);
    },
  };
}

/** Ejecuta una acción mostrando estado de carga y el error si falla. */
export function useAction() {
  const busy = ref(false);
  const error = ref('');
  const { show } = useToast();
  async function run<T>(fn: () => Promise<T>, okMessage?: string): Promise<T | undefined> {
    if (busy.value) return;
    busy.value = true; error.value = '';
    try {
      const r = await fn();
      if (okMessage) show(okMessage);
      return r;
    } catch (e: any) {
      error.value = e?.message ?? 'Algo ha fallado.';
    } finally { busy.value = false; }
  }
  return { busy, error, run };
}

const TZ = 'Europe/Madrid';
export const fmtDay = (iso: string) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
export const fmtTime = (iso: string) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const fmtDateTime = (iso: string) => `${fmtDay(iso)} · ${fmtTime(iso)}`;
export const fmtLong = (iso: string) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const money = (cents: number, currency = 'eur') => new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency.toUpperCase() }).format((cents ?? 0) / 100);
