<script setup lang="ts">
const route = useRoute();
const api = useApi();
const auth = useAuth();
const { t } = useT();
const { show } = useToast();
const id = route.params.id;

const event = ref<any>(null);
const teams = ref<any[]>([]);
const matches = ref<any[]>([]);
const standings = ref<any[]>([]);
const scorers = ref<any[]>([]);
const posts = ref<any[]>([]);
const myTeams = ref<any[]>([]);
const teamId = ref<number | null>(null);
const tab = ref('summary');
const missing = ref(false);
const { busy, error, run } = useAction();

async function load() {
  try {
    event.value = (await api(`/events/${id}`)).event;
  } catch { missing.value = true; return; }
  const get = (p: string) => api(`/events/${id}/${p}`).catch(() => ({}));
  const [a, b, c, d, e] = await Promise.all([get('teams'), get('matches'), get('standings'), get('scorers'), get('posts')]);
  teams.value = a.teams ?? []; matches.value = b.matches ?? []; standings.value = c.standings ?? [];
  scorers.value = d.scorers ?? []; posts.value = e.posts ?? [];
  if (auth.token.value && event.value.status === 'registration') {
    myTeams.value = (await api('/me/teams')).teams.filter((m: any) => !teams.value.some((x) => x.id === m.id));
    teamId.value = myTeams.value[0]?.id ?? null;
  }
}
onMounted(load);

const isLive = computed(() => event.value?.status === 'active');
const tabs = computed(() => (isLive.value ? ['summary', 'calendar', 'standings', 'scorers', 'photos'] : ['summary']));
const upcoming = computed(() => matches.value.filter((m) => m.report_status !== 'closed').slice(0, 3));
const recent = computed(() => matches.value.filter((m) => m.report_status === 'closed').slice(-3).reverse());
const rounds = computed(() => {
  const g = new Map<string, any[]>();
  for (const m of matches.value) {
    const k = m.round ? `Jornada ${m.round}` : 'Partidos';
    g.set(k, [...(g.get(k) ?? []), m]);
  }
  return [...g.entries()];
});

const toggleFollow = () => run(async () => {
  if (!auth.token.value) return navigateTo({ path: '/login', query: { next: route.fullPath } });
  await api(`/events/${id}/follow`, { method: event.value.following ? 'DELETE' : 'POST' });
  event.value.following = !event.value.following;
});
const register = () => run(async () => {
  await api(`/events/${id}/registrations`, { method: 'POST', body: { team_id: teamId.value } });
  await load();
}, '¡Equipo inscrito!');
async function shareEvent() {
  const data = { title: event.value.name, url: location.href };
  if (navigator.share) await navigator.share(data).catch(() => {});
  else { await navigator.clipboard?.writeText(location.href); show('Enlace copiado.'); }
}
</script>

<template>
  <div v-if="missing" class="page"><div class="empty">Este evento no existe o ya no está disponible.</div></div>
  <div v-else-if="event" class="page">
    <header class="stack">
      <div class="row between">
        <span class="eyebrow">{{ t(`type.${event.type}`) }} · {{ t(`format.${event.format}`) }} · {{ event.city.name }}</span>
        <StatusBadge :status="event.status" />
      </div>
      <h1>{{ event.name }}</h1>
      <p class="muted">{{ event.teams_count }} {{ t('common.teams') }} · Organiza {{ event.organizer_name }}</p>
      <div class="row">
        <button class="btn" :class="{ ghost: event.following }" :disabled="busy" @click="toggleFollow">{{ event.following ? 'Siguiendo' : 'Seguir' }}</button>
        <button class="btn ghost" @click="shareEvent">Compartir</button>
      </div>
    </header>

    <div v-if="tabs.length > 1" class="tabs">
      <button v-for="k in tabs" :key="k" :class="{ on: tab === k }" @click="tab = k">{{ t(`tab.${k}`) }}</button>
    </div>

    <template v-if="tab === 'summary'">
      <p v-if="event.description">{{ event.description }}</p>

      <section v-if="event.status === 'registration'" class="card stack">
        <h2>Inscribe a tu equipo</h2>
        <template v-if="!auth.token.value">
          <p class="muted">Entra con tu cuenta para inscribir a tu equipo en este evento.</p>
          <NuxtLink class="btn" :to="{ path: '/login', query: { next: route.fullPath } }">Entrar para inscribirme</NuxtLink>
        </template>
        <template v-else-if="myTeams.length">
          <label class="field"><span>Equipo</span>
            <select v-model="teamId" class="input"><option v-for="m in myTeams" :key="m.id" :value="m.id">{{ m.name }}</option></select>
          </label>
          <div v-if="error" class="error-box">{{ error }}</div>
          <button class="btn" :disabled="busy" @click="register">Inscribir equipo</button>
        </template>
        <template v-else>
          <p class="muted">No tienes equipos pendientes de inscribir. Crea uno desde tu cuenta y vuelve aquí.</p>
          <NuxtLink class="btn ghost" to="/cuenta">Crear mi equipo</NuxtLink>
        </template>
      </section>

      <section v-if="upcoming.length" class="stack">
        <h2>Próximos partidos</h2>
        <div class="card list"><MatchRow v-for="m in upcoming" :key="m.id" :match="m" :to="`/partidos/${m.id}`" /></div>
      </section>
      <section v-if="recent.length" class="stack">
        <h2>Últimos resultados</h2>
        <div class="card list"><MatchRow v-for="m in recent" :key="m.id" :match="m" :to="`/partidos/${m.id}`" /></div>
      </section>

      <section class="stack">
        <h2>Equipos</h2>
        <div v-if="teams.length" class="card list">
          <NuxtLink v-for="tm in teams" :key="tm.id" :to="`/equipos/${tm.id}`" class="row">
            <span class="dot" :style="{ background: tm.color }" /><span class="grow">{{ tm.name }}</span><span class="muted small">Ver plantilla</span>
          </NuxtLink>
        </div>
        <div v-else class="empty">Aún no hay equipos inscritos. ¡Sé el primero!</div>
      </section>
    </template>

    <template v-if="tab === 'calendar'">
      <section v-for="[name, list] in rounds" :key="name" class="stack">
        <h2>{{ name }}</h2>
        <div class="card list"><MatchRow v-for="m in list" :key="m.id" :match="m" :to="`/partidos/${m.id}`" /></div>
      </section>
      <div v-if="!matches.length" class="empty">El organizador todavía no ha publicado el calendario.</div>
    </template>

    <template v-if="tab === 'standings'">
      <div class="card" style="overflow-x: auto">
        <table class="table">
          <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th></tr></thead>
          <tbody>
            <tr v-for="r in standings" :key="r.team_id">
              <td>{{ r.position }}</td><td><NuxtLink :to="`/equipos/${r.team_id}`">{{ r.team_name }}</NuxtLink></td>
              <td>{{ r.played }}</td><td>{{ r.won }}</td><td>{{ r.drawn }}</td><td>{{ r.lost }}</td>
              <td>{{ r.goal_diff > 0 ? '+' : '' }}{{ r.goal_diff }}</td><td class="pts">{{ r.points }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small muted">Solo cuentan los partidos con el acta cerrada por el árbitro.</p>
    </template>

    <template v-if="tab === 'scorers'">
      <div v-if="scorers.length" class="card list">
        <div v-for="(s, i) in scorers" :key="s.player_id" class="row">
          <span class="muted" style="width: 24px">{{ i + 1 }}</span>
          <div class="grow"><p>{{ s.first_name }} {{ s.last_name }}</p><p class="small muted">{{ s.team_name }}</p></div>
          <span class="score lime" style="font-size: 1.3rem">{{ s.goals }}</span>
        </div>
      </div>
      <div v-else class="empty">Todavía no hay goles registrados.</div>
    </template>

    <template v-if="tab === 'photos'">
      <article v-for="p in posts" :key="p.id" class="card stack">
        <p class="small muted">{{ fmtLong(p.created_at) }}</p>
        <p v-if="p.body">{{ p.body }}</p>
        <div v-if="p.media.length" class="photos">
          <img v-for="m in p.media" :key="m.id" :src="localToHost(m.url)" :width="m.width" :height="m.height" alt="Foto del evento" loading="lazy">
        </div>
      </article>
      <div v-if="!posts.length" class="empty">El organizador aún no ha publicado fotos.</div>
    </template>
  </div>
</template>

<style scoped>
.photos { display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.photos img { width: 100%; height: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--r-sm); }
</style>
