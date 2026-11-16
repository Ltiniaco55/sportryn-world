<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const route = useRoute();
const api = useApi();
const { show } = useToast();
const id = route.params.id;

const event = ref<any>(null);
const driver = ref('fake');
const regs = ref<any[]>([]);
const matches = ref<any[]>([]);
const venues = ref<any[]>([]);
const referees = ref<any[]>([]);
const posts = ref<any[]>([]);
const city = ref<any>(null);
const tab = ref('matches');
const denied = ref(false);
const confirmCancel = ref(false);
const { busy, error, run } = useAction();

async function load() {
  try {
    const r = await api(`/events/${id}/manage`);
    event.value = r.event; driver.value = r.payments_driver;
  } catch { denied.value = true; return; }
  regs.value = (await api(`/events/${id}/registrations`)).registrations;
  if (event.value.status !== 'active') return;
  const [m, v, r, p, c] = await Promise.all([
    api(`/events/${id}/matches`), api(`/venues?city_id=${event.value.city_id}`), api('/referees'), api(`/events/${id}/posts`), api('/cities'),
  ]);
  matches.value = m.matches; venues.value = v.venues; referees.value = r.referees; posts.value = p.posts;
  city.value = c.cities.find((x: any) => x.id === event.value.city_id);
}
onMounted(async () => {
  await load();
  if (route.query.pago === 'ok') show('Pago recibido. Si el evento aún no aparece activo, actualiza en unos segundos.');
});

const steps = ['registration', 'pending_payment', 'active'];
const stepIndex = computed(() => steps.indexOf(event.value?.status));
const publicUrl = computed(() => `${location.origin}/eventos/${id}`);
const estimate = computed(() => regs.value.length * (event.value?.team_fee_cents ?? 0));
const act = (fn: () => Promise<any>, ok?: string) => run(async () => { await fn(); await load(); }, ok);

async function copyLink() { await navigator.clipboard?.writeText(publicUrl.value); show('Enlace copiado.'); }
const togglePaid = (r: any) => act(() => api(`/registrations/${r.id}`, { method: 'PATCH', body: { paid_to_organizer: !r.paid_to_organizer } }));
const removeReg = (r: any) => act(() => api(`/registrations/${r.id}`, { method: 'DELETE' }), 'Equipo retirado.');
const closeRegistration = () => act(() => api(`/events/${id}/close-registration`, { method: 'POST' }), 'Inscripción cerrada.');
const cancelEvent = () => act(() => api(`/events/${id}/cancel`, { method: 'POST' }), 'Evento cancelado.');
const pay = () => run(async () => {
  const r = await api(`/events/${id}/checkout`, { method: 'POST' });
  location.href = r.checkout_url;
});

// ── Partidos
const mf = reactive({ home_team_id: null as number | null, away_team_id: null as number | null, venue_id: null as number | null, scheduled_at: '', round: 1 });
const addMatch = () => act(async () => {
  await api(`/events/${id}/matches`, { method: 'POST', body: { ...mf, scheduled_at: mf.scheduled_at ? new Date(mf.scheduled_at).toISOString() : '', round: Number(mf.round) || null } });
}, 'Partido creado.');
const delMatch = (m: any) => act(() => api(`/matches/${m.id}`, { method: 'DELETE' }), 'Partido borrado.');
const assign = (m: any, e: Event) => {
  const user_id = Number((e.target as HTMLSelectElement).value);
  (e.target as HTMLSelectElement).value = '';
  if (user_id) act(() => api(`/matches/${m.id}/referees`, { method: 'POST', body: { user_id } }), 'Árbitro asignado.');
};

// ── Árbitros
const refEmail = ref('');
const addReferee = () => act(async () => { await api('/referees', { method: 'POST', body: { email: refEmail.value } }); refEmail.value = ''; }, 'Árbitro dado de alta.');

// ── Sedes
const vf = reactive({ name: '', address: '', pos: null as { lat: number; lng: number } | null });
const addVenue = () => act(async () => {
  if (!vf.pos) throw new Error('Pulsa en el mapa para marcar dónde está el campo.');
  await api('/venues', { method: 'POST', body: { name: vf.name, address: vf.address || null, ...vf.pos, city_id: event.value.city_id } });
  Object.assign(vf, { name: '', address: '', pos: null });
}, 'Sede creada.');

// ── Publicaciones
const pf = reactive({ body: '' });
const files = ref<File[]>([]);
const publish = () => act(async () => {
  if (!pf.body.trim() && !files.value.length) throw new Error('Escribe algo o añade una foto.');
  const { post } = await api(`/events/${id}/posts`, { method: 'POST', body: { body: pf.body || null } });
  for (const f of files.value) {
    const fd = new FormData(); fd.append('file', f);
    await api(`/posts/${post.id}/media`, { method: 'POST', body: fd });
  }
  pf.body = ''; files.value = [];
}, 'Publicado.');
const delPost = (p: any) => act(() => api(`/posts/${p.id}`, { method: 'DELETE' }), 'Publicación borrada.');
</script>

<template>
  <div v-if="denied" class="page"><div class="empty">No tienes acceso a este evento.</div></div>
  <div v-else-if="event" class="page">
    <header class="stack">
      <NuxtLink to="/organizador" class="eyebrow">← Mis eventos</NuxtLink>
      <div class="row between"><h1>{{ event.name }}</h1><StatusBadge :status="event.status" /></div>
      <ol v-if="event.status !== 'cancelled'" class="steps">
        <li v-for="(s, i) in ['Inscripción', 'Pago', 'Activo']" :key="s" :class="{ done: i < stepIndex, on: i === stepIndex }">{{ s }}</li>
      </ol>
    </header>

    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-if="event.status === 'cancelled'" class="empty">Este evento está cancelado y ya no es visible para el público.</div>

    <!-- ── 1. INSCRIPCIÓN ─────────────────────────────────────────────────── -->
    <template v-if="event.status === 'registration'">
      <section class="card stack">
        <h2>Comparte la inscripción</h2>
        <p class="small muted">Los capitanes entran en este enlace, crean su equipo y lo inscriben.</p>
        <div class="row"><input class="input grow" :value="publicUrl" readonly><button class="btn ghost" @click="copyLink">Copiar</button></div>
      </section>
      <section class="card stack">
        <h2>Cerrar inscripción</h2>
        <p>
          {{ regs.length }} equipos × {{ money(event.team_fee_cents, event.currency) }} =
          <strong class="lime">{{ money(estimate, event.currency) }}</strong>
        </p>
        <p class="small muted">Al cerrar tendrás {{ event.payment_days }} días para pagar. Con el pago se desbloquean calendario, árbitros, actas, fotos, stickers y mapa. Si no pagas a tiempo, el evento se cancela.</p>
        <div class="row wrap">
          <button class="btn" :disabled="busy || regs.length < 2" @click="closeRegistration">Cerrar inscripción</button>
          <button v-if="!confirmCancel" class="btn danger" @click="confirmCancel = true">Cancelar evento</button>
          <button v-else class="btn danger" :disabled="busy" @click="cancelEvent">Sí, cancelar definitivamente</button>
        </div>
        <p v-if="regs.length < 2" class="small muted">Necesitas al menos 2 equipos inscritos.</p>
      </section>
    </template>

    <!-- ── 2. PAGO ────────────────────────────────────────────────────────── -->
    <section v-if="event.status === 'pending_payment'" class="card stack">
      <p class="eyebrow">Importe a pagar</p>
      <p class="score lime" style="font-size: 2.6rem">{{ money(event.amount_cents, event.currency) }}</p>
      <p>{{ event.teams_count }} equipos × {{ money(event.team_fee_cents, event.currency) }}</p>
      <p class="small" style="color: var(--warn)">Fecha límite: {{ fmtLong(event.payment_due_at) }}. Pasado ese momento el evento se cancela automáticamente.</p>
      <div class="row wrap">
        <button class="btn" :disabled="busy" @click="pay">{{ driver === 'fake' ? 'Pagar (simulado)' : 'Pagar ahora' }}</button>
        <button v-if="!confirmCancel" class="btn danger" @click="confirmCancel = true">Cancelar evento</button>
        <button v-else class="btn danger" :disabled="busy" @click="cancelEvent">Sí, cancelar definitivamente</button>
      </div>
    </section>

    <!-- ── EQUIPOS INSCRITOS (todas las fases) ────────────────────────────── -->
    <section v-if="event.status !== 'cancelled' && (event.status !== 'active' || tab === 'teams')" class="stack">
      <h2>Equipos inscritos ({{ regs.length }})</h2>
      <div v-if="regs.length" class="card list">
        <div v-for="r in regs" :key="r.id" class="row wrap">
          <span class="dot" :style="{ background: r.team_color }" />
          <div class="grow">
            <NuxtLink :to="`/equipos/${r.team_id}`">{{ r.team_name }}</NuxtLink>
            <p class="small muted">{{ r.captain_name }} · {{ r.captain_email }} · {{ r.players_count }} jugadores</p>
          </div>
          <button class="btn sm" :class="{ ghost: !r.paid_to_organizer }" :disabled="busy" @click="togglePaid(r)">{{ r.paid_to_organizer ? 'Te ha pagado' : 'Marcar pagado' }}</button>
          <button v-if="event.status === 'registration'" class="btn sm danger" :disabled="busy" @click="removeReg(r)">Retirar</button>
        </div>
      </div>
      <div v-else class="empty">Todavía no se ha inscrito ningún equipo.</div>
      <p class="small muted">El cobro a los equipos lo gestionas tú fuera de la app; aquí solo llevas la cuenta de quién te ha pagado.</p>
    </section>

    <!-- ── 3. ACTIVO ──────────────────────────────────────────────────────── -->
    <template v-if="event.status === 'active'">
      <div class="tabs">
        <button v-for="[k, l] in [['matches', 'Partidos'], ['teams', 'Equipos'], ['referees', 'Árbitros'], ['venues', 'Sedes'], ['posts', 'Publicar']]" :key="k" :class="{ on: tab === k }" @click="tab = k">{{ l }}</button>
      </div>

      <template v-if="tab === 'matches'">
        <form class="card stack" @submit.prevent="addMatch">
          <h2>Nuevo partido</h2>
          <div class="grid-2">
            <label class="field"><span>Local</span><select v-model="mf.home_team_id" class="input" required><option v-for="r in regs" :key="r.team_id" :value="r.team_id">{{ r.team_name }}</option></select></label>
            <label class="field"><span>Visitante</span><select v-model="mf.away_team_id" class="input" required><option v-for="r in regs" :key="r.team_id" :value="r.team_id">{{ r.team_name }}</option></select></label>
            <label class="field"><span>Fecha y hora</span><input v-model="mf.scheduled_at" class="input" type="datetime-local" required></label>
            <label class="field"><span>Jornada</span><input v-model="mf.round" class="input" type="number" min="1" max="999"></label>
            <label class="field"><span>Sede</span><select v-model="mf.venue_id" class="input"><option :value="null">Sin sede</option><option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option></select></label>
          </div>
          <button class="btn" :disabled="busy">Añadir al calendario</button>
        </form>
        <div v-if="matches.length" class="stack">
          <div v-for="m in matches" :key="m.id" class="card stack">
            <MatchRow :match="m" />
            <div class="row wrap" style="justify-content: center">
              <NuxtLink :to="`/arbitro/partidos/${m.id}`" class="btn sm">{{ m.report_status === 'closed' ? 'Ver acta' : 'Abrir acta' }}</NuxtLink>
              <select v-if="m.report_status !== 'closed'" class="input" style="width: auto; min-height: 36px; padding: 4px 10px" aria-label="Asignar árbitro" @change="assign(m, $event)">
                <option value="">Asignar árbitro…</option><option v-for="r in referees" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
              <button v-if="m.report_status !== 'closed'" class="btn sm danger" :disabled="busy" @click="delMatch(m)">Borrar</button>
            </div>
          </div>
        </div>
        <div v-else class="empty">Aún no hay partidos. Crea el primero arriba.</div>
      </template>

      <template v-if="tab === 'referees'">
        <form class="card stack" @submit.prevent="addReferee">
          <h2>Dar de alta un árbitro</h2>
          <p class="small muted">Primero tiene que crearse una cuenta en Sportryn. Después escribe aquí su email y asígnale partidos: solo podrá editar el acta de los partidos que tú le asignes.</p>
          <div class="row"><input v-model="refEmail" class="input grow" type="email" required placeholder="arbitro@ejemplo.com"><button class="btn" :disabled="busy">Añadir</button></div>
        </form>
        <div v-if="referees.length" class="card list">
          <div v-for="r in referees" :key="r.id"><p>{{ r.name }}</p><p class="small muted">{{ r.email }}</p></div>
        </div>
        <div v-else class="empty">Todavía no has dado de alta árbitros.</div>
      </template>

      <template v-if="tab === 'venues'">
        <form class="card stack" @submit.prevent="addVenue">
          <h2>Nueva sede</h2>
          <div class="grid-2">
            <label class="field"><span>Nombre del campo</span><input v-model="vf.name" class="input" required minlength="2" maxlength="120"></label>
            <label class="field"><span>Dirección (opcional)</span><input v-model="vf.address" class="input" maxlength="200"></label>
          </div>
          <p class="small muted">Pulsa en el mapa para marcar la ubicación exacta: así aparecerá en el mapa público.</p>
          <div style="height: 300px"><MapView v-if="city" v-model="vf.pos" :center="[city.lat, city.lng]" pick /></div>
          <p v-if="vf.pos" class="small lime">Ubicación marcada: {{ vf.pos.lat }}, {{ vf.pos.lng }}</p>
          <button class="btn" :disabled="busy">Guardar sede</button>
        </form>
        <div v-if="venues.length" class="card list">
          <div v-for="v in venues" :key="v.id"><p>{{ v.name }}</p><p class="small muted">{{ v.address || 'Sin dirección' }}</p></div>
        </div>
      </template>

      <template v-if="tab === 'posts'">
        <form class="card stack" @submit.prevent="publish">
          <h2>Publicar en el feed</h2>
          <textarea v-model="pf.body" class="input" maxlength="1000" placeholder="Cuenta cómo ha ido la jornada…" />
          <label class="field"><span>Fotos (JPG, PNG o WebP)</span>
            <input class="input" type="file" accept="image/jpeg,image/png,image/webp" multiple @change="files = Array.from(($event.target as HTMLInputElement).files ?? [])">
          </label>
          <p class="small muted">Antes de publicar se eliminan los metadatos de las fotos (ubicación GPS incluida). Publica solo fotos para las que tengas permiso, sobre todo si aparecen menores.</p>
          <button class="btn" :disabled="busy">{{ busy ? 'Publicando…' : 'Publicar' }}</button>
        </form>
        <article v-for="p in posts" :key="p.id" class="card stack">
          <div class="row between"><p class="small muted">{{ fmtLong(p.created_at) }}</p><button class="btn sm danger" :disabled="busy" @click="delPost(p)">Borrar</button></div>
          <p v-if="p.body">{{ p.body }}</p>
          <div v-if="p.media.length" class="row wrap"><img v-for="m in p.media" :key="m.id" :src="localToHost(m.url)" alt="" style="width: 96px; height: 96px; object-fit: cover; border-radius: 10px"></div>
        </article>
      </template>
    </template>
  </div>
</template>

<style scoped>
.steps { list-style: none; display: flex; gap: var(--s-2); padding: 0; margin: 0; }
.steps li { flex: 1; padding-top: 10px; border-top: 3px solid var(--line); font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.steps li.done { border-color: var(--lime); color: var(--text); } .steps li.on { border-color: var(--lime); color: var(--lime); }
</style>
